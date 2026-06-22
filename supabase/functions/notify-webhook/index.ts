import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  failure_count: number;
}

async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { pedido_id, estado_anterior, estado_nuevo, numero_guia, client_user_id } = await req.json();

    if (!pedido_id || !estado_nuevo || !client_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Webhook-Out] Status change: pedido ${pedido_id} ${estado_anterior} -> ${estado_nuevo}`);

    // Fetch active webhook endpoints for this client
    const { data: endpoints, error: epError } = await supabase
      .from("webhook_endpoints")
      .select("id, url, secret, events, is_active, failure_count")
      .eq("client_user_id", client_user_id)
      .eq("is_active", true);

    if (epError) {
      console.error("[Webhook-Out] Error fetching endpoints:", epError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch endpoints" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!endpoints || endpoints.length === 0) {
      console.log("[Webhook-Out] No active endpoints for client:", client_user_id);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active endpoints" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver dominio white-label si la credencial del pedido lo tiene configurado
    let trackingDomain = "logistica.komprasplus.com";
    let referenciaExterna: string | null = null;
    try {
      const { data: pedidoData } = await supabase
        .from("pedidos")
        .select("api_credential_id, id_externo")
        .eq("id", pedido_id)
        .maybeSingle();
      referenciaExterna = (pedidoData?.id_externo as string) || null;
      if (pedidoData?.api_credential_id) {
        const { data: credData } = await supabase
          .from("api_credentials")
          .select("tracking_white_label_domain")
          .eq("id", pedidoData.api_credential_id)
          .maybeSingle();
        if (credData?.tracking_white_label_domain && credData.tracking_white_label_domain.trim()) {
          trackingDomain = credData.tracking_white_label_domain
            .trim()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
        }
      }
    } catch (e) {
      console.warn("[Webhook-Out] No pude resolver white-label domain:", e);
    }

    const payload = {
      event: "status_change",
      timestamp: new Date().toISOString(),
      data: {
        pedido_id,
        numero_guia: numero_guia || null,
        referencia_externa: referenciaExterna,
        estado_anterior: estado_anterior || null,
        estado_nuevo,
        tracking_url: `https://${trackingDomain}/rastreo/${numero_guia || pedido_id}`,
      },
    };

    const payloadStr = JSON.stringify(payload);
    let sentCount = 0;

    // Fire webhooks in parallel
    const results = await Promise.allSettled(
      endpoints.map(async (ep: WebhookEndpoint) => {
        // Skip if too many failures (circuit breaker: 10 consecutive failures)
        if (ep.failure_count >= 10) {
          console.log(`[Webhook-Out] Skipping ${ep.url} (circuit breaker: ${ep.failure_count} failures)`);
          return;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "PlusEnvios-Webhook/1.0",
          "X-Webhook-Event": "status_change",
          "X-Webhook-Delivery": crypto.randomUUID(),
        };

        // Add HMAC signature if secret is configured
        if (ep.secret) {
          const signature = await generateHmacSignature(payloadStr, ep.secret);
          headers["X-Webhook-Signature"] = `sha256=${signature}`;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(ep.url, {
            method: "POST",
            headers,
            body: payloadStr,
            signal: controller.signal,
          });

          clearTimeout(timeout);

          // Update endpoint status
          await supabase
            .from("webhook_endpoints")
            .update({
              last_triggered_at: new Date().toISOString(),
              last_status_code: response.status,
              failure_count: response.ok ? 0 : ep.failure_count + 1,
            })
            .eq("id", ep.id);

          if (response.ok) {
            sentCount++;
            console.log(`[Webhook-Out] ✓ Sent to ${ep.url} (${response.status})`);
          } else {
            console.warn(`[Webhook-Out] ✗ Failed ${ep.url} (${response.status})`);
          }
        } catch (fetchError) {
          console.error(`[Webhook-Out] ✗ Error calling ${ep.url}:`, fetchError);
          await supabase
            .from("webhook_endpoints")
            .update({
              last_triggered_at: new Date().toISOString(),
              last_status_code: 0,
              failure_count: ep.failure_count + 1,
            })
            .eq("id", ep.id);
        }
      })
    );

    console.log(`[Webhook-Out] Completed: ${sentCount}/${endpoints.length} sent`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: endpoints.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Webhook-Out] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

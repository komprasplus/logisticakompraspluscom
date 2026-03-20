import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST requests are accepted" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse body
    const rawBody = await req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect source from header or payload
    const sourceHeader = req.headers.get("x-webhook-source") ?? "";
    const url = new URL(req.url);
    const sourceParam = url.searchParams.get("source") ?? "";
    const source = sourceHeader || sourceParam || "unknown";

    // Use service role to bypass RLS for inserting
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("webhook_logs_incoming")
      .insert({
        source: source.toLowerCase().slice(0, 50),
        payload: payload as Record<string, unknown>,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[receive-webhook] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store webhook", detail: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[receive-webhook] Stored webhook from "${source}" → ${data.id}`);

    return new Response(
      JSON.stringify({ success: true, id: data.id, message: "Webhook received and queued" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[receive-webhook] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

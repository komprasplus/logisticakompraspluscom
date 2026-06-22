// Edge Function: cancel-order
// Cancela un pedido del partner. Solo si el estado NO es final (entregado/pagado/devuelto/etc).
// Requiere x-api-key. Body: { numero_guia: string, motivo?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINAL_STATES = new Set([
  "entregado",
  "pagado",
  "liquidado",
  "devuelto",
  "cancelado",
  "anulado",
  "rechazado",
]);

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key required", code: "MISSING_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyHash = await hashApiKey(apiKey);
    const { data: cred } = await supabase
      .from("api_credentials")
      .select("id, client_user_id, is_active")
      .eq("api_key_hash", keyHash)
      .maybeSingle();

    if (!cred || !cred.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const numeroGuia = String(body?.numero_guia || "").trim();
    const motivo = body?.motivo ? String(body.motivo).trim() : null;

    if (!numeroGuia) {
      return new Response(
        JSON.stringify({ error: "numero_guia is required", code: "MISSING_GUIA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar el pedido y validar ownership
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, numero_guia, estado, client_user_id, observaciones, id_externo")
      .eq("numero_guia", numeroGuia)
      .maybeSingle();

    if (!pedido) {
      return new Response(
        JSON.stringify({ error: "Pedido no encontrado", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (pedido.client_user_id !== cred.client_user_id) {
      return new Response(
        JSON.stringify({ error: "Pedido no pertenece a tu cuenta", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentEstado = String(pedido.estado || "").toLowerCase();
    if (FINAL_STATES.has(currentEstado)) {
      return new Response(
        JSON.stringify({
          error: `No se puede cancelar un pedido en estado '${currentEstado}'`,
          code: "INVALID_STATE",
          current_state: currentEstado,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newObservaciones = [
      pedido.observaciones,
      `[Cancelado vía API ${new Date().toISOString()}${motivo ? " · motivo: " + motivo : ""}]`,
    ].filter(Boolean).join("\n");

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({
        estado: "cancelado",
        observaciones: newObservaciones,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", pedido.id);

    if (updateError) {
      console.error("cancel-order update error:", updateError);
      return new Response(
        JSON.stringify({ error: "DB error al cancelar", code: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Disparar webhook de cambio de estado para notificar al partner
    try {
      await supabase.functions.invoke("notify-webhook", {
        body: {
          pedido_id: pedido.id,
          numero_guia: pedido.numero_guia,
          estado_anterior: currentEstado,
          estado_nuevo: "cancelado",
          client_user_id: cred.client_user_id,
        },
      });
    } catch (e) {
      console.warn("cancel-order: notify-webhook falló (no bloqueante):", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        numero_guia: pedido.numero_guia,
        referencia_externa: pedido.id_externo ?? null,
        previous_state: currentEstado,
        new_state: "cancelado",
        motivo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cancel-order error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

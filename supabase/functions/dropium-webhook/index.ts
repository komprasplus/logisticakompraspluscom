// Dropium inbound webhook — receives status updates from Dropium and updates pedidos
// Responds 200 immediately; processing happens inline (fast) but errors are caught silently.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-logi-fleet-authorization, x-logi-fleet-sign",
};

const ENTREGADO_CODES = new Set([
  "RECP", "RMTE", "MBOX", "NBHR", "DRMN", "RCPT",
]);
const NOVEDAD_CODES = new Set([
  "ABS", "FABS", "SABS", "INCADDR", "INCCADDR", "CRP", "HLD", "OOH", "UNRC", "OFR", "MLAT",
]);
const CANCELADO_CODES = new Set(["CNL"]);

function mapDetailCodeToInternal(detailCode: string | null | undefined): string | null {
  if (!detailCode) return null;
  const code = String(detailCode).toUpperCase().trim();
  if (ENTREGADO_CODES.has(code)) return "Entregado";
  if (NOVEDAD_CODES.has(code)) return "Novedad";
  if (CANCELADO_CODES.has(code)) return "Anulado";
  return null;
}

async function processPayload(payload: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Reference resolution: prefer referenceSecondary (our pedido id), fallback to reference (numero_guia)
  const referenceSecondary = payload?.referenceSecondary ?? payload?.reference_secondary;
  const reference = payload?.reference ?? payload?.tracking ?? payload?.guia;
  const detailCode: string = payload?.detailCode ?? payload?.detail_code ?? "";
  const code: string = payload?.code ?? "";
  const note: string = payload?.note ?? "";
  const dateTime: string = payload?.dateTime ?? payload?.date_time ?? new Date().toISOString();

  const internalState = mapDetailCodeToInternal(detailCode);

  const baseLog = {
    action: "webhook_received",
    detail_code: detailCode || null,
    external_status: code || payload?.name || null,
    internal_status: internalState,
    request_payload: payload as Record<string, unknown>,
  };

  if (!detailCode) {
    await supabase.from("dropium_sync_logs").insert({
      ...baseLog,
      success: false,
      error_message: "Missing detailCode in payload",
    });
    return;
  }

  // Find pedido — try id first (numeric), then numero_guia, then dropi_guia_id
  let pedido: any = null;
  if (referenceSecondary && /^\d+$/.test(String(referenceSecondary))) {
    const { data } = await supabase
      .from("pedidos")
      .select("id, estado, numero_guia, organizacion_id")
      .eq("id", Number(referenceSecondary))
      .maybeSingle();
    pedido = data;
  }
  if (!pedido && reference) {
    const { data } = await supabase
      .from("pedidos")
      .select("id, estado, numero_guia, organizacion_id")
      .eq("numero_guia", String(reference))
      .maybeSingle();
    pedido = data;
  }
  if (!pedido && reference) {
    const { data } = await supabase
      .from("pedidos")
      .select("id, estado, numero_guia, organizacion_id")
      .eq("dropi_guia_id", String(reference))
      .maybeSingle();
    pedido = data;
  }

  if (!pedido) {
    await supabase.from("dropium_sync_logs").insert({
      ...baseLog,
      numero_guia: reference ? String(reference) : null,
      success: false,
      error_message: `Pedido no encontrado (referenceSecondary=${referenceSecondary}, reference=${reference})`,
    });
    return;
  }

  if (!internalState) {
    await supabase.from("dropium_sync_logs").insert({
      ...baseLog,
      pedido_id: pedido.id,
      numero_guia: pedido.numero_guia,
      success: true, // received, but no action required
      error_message: `detailCode "${detailCode}" no mapeado (sin cambio de estado)`,
    });
    return;
  }

  const oldEstado = pedido.estado;

  // Idempotency: skip if already in target state
  if (oldEstado === internalState) {
    await supabase.from("dropium_sync_logs").insert({
      ...baseLog,
      pedido_id: pedido.id,
      numero_guia: pedido.numero_guia,
      success: true,
      error_message: `Sin cambio: pedido ya estaba en "${internalState}"`,
    });
    return;
  }

  // Update pedido state
  const updates: Record<string, unknown> = {
    estado: internalState,
    fecha_actualizacion: new Date().toISOString(),
    dropi_sync_status: "synced",
  };
  if (internalState === "Entregado") {
    updates.fecha_entrega = (dateTime || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  }

  const { error: updErr } = await supabase
    .from("pedidos")
    .update(updates)
    .eq("id", pedido.id);

  if (updErr) {
    await supabase.from("dropium_sync_logs").insert({
      ...baseLog,
      pedido_id: pedido.id,
      numero_guia: pedido.numero_guia,
      success: false,
      error_message: `Update error: ${updErr.message}`,
    });
    return;
  }

  // Log status change
  await supabase.from("pedido_status_logs").insert({
    pedido_id: pedido.id,
    estado_anterior: oldEstado,
    estado_nuevo: internalState,
    motivo: `Webhook Dropium (detailCode=${detailCode})${note ? ` - ${note}` : ""}`,
    usuario_nombre: "Sistema Dropium",
    organizacion_id: pedido.organizacion_id,
  });

  // Audit success
  await supabase.from("dropium_sync_logs").insert({
    ...baseLog,
    pedido_id: pedido.id,
    numero_guia: pedido.numero_guia,
    success: true,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always 200 immediately; if body is invalid we still ack to avoid Dropium retry storms.
  // Spec says "responder HTTP 200 inmediatamente".
  let payload: unknown = null;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("[dropium-webhook] Invalid JSON:", e);
    return new Response(JSON.stringify({ ok: true, warning: "invalid_json" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Process asynchronously without blocking the 200 response
  // EdgeRuntime.waitUntil keeps the worker alive after we send the response
  const work = processPayload(payload).catch((e) => {
    console.error("[dropium-webhook] processPayload error:", e);
  });

  // @ts-ignore Deno Deploy runtime
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Edge Function: order-status
// Devuelve el estado actual de un pedido + tracking + historial.
// GET /functions/v1/order-status?numero_guia=KP123456789
// Header: x-api-key

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TRACKING_DEFAULT_DOMAIN = "logistica.komprasplus.com";
const buildTrackingUrl = (numeroGuia: string, customDomain?: string | null) => {
  const domain = (customDomain && customDomain.trim()) || TRACKING_DEFAULT_DOMAIN;
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${cleanDomain}/rastreo/${numeroGuia}`;
};

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
      .select("id, client_user_id, is_active, tracking_white_label_domain")
      .eq("api_key_hash", keyHash)
      .maybeSingle();

    if (!cred || !cred.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aceptar query param o body { numero_guia / referencia_externa }
    const url = new URL(req.url);
    let numeroGuia = url.searchParams.get("numero_guia");
    let referenciaExterna = url.searchParams.get("referencia_externa");
    if (!numeroGuia && !referenciaExterna && (req.method === "POST")) {
      try {
        const body = await req.json();
        numeroGuia = body?.numero_guia || null;
        referenciaExterna = body?.referencia_externa || body?.id_externo || null;
      } catch { /* ignore */ }
    }

    if (!numeroGuia && !referenciaExterna) {
      return new Response(
        JSON.stringify({ error: "numero_guia o referencia_externa requerido", code: "MISSING_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("pedidos")
      .select("id, numero_guia, estado, client_user_id, fecha_creacion, fecha_actualizacion, fecha_entrega, fecha_recoleccion_real, fecha_cierre_logistico, primer_intento_fecha, valor_recaudar, valor_flete, valor_producto, metodo_pago, cliente_nombre, client_phone, direccion_entrega, municipio, barrio, observaciones, id_externo, indicador_trayecto, tipo_novedad, intentos_entrega")
      .limit(1);
    if (numeroGuia) query = query.eq("numero_guia", numeroGuia);
    else query = query.eq("id_externo", referenciaExterna);
    const { data: pedido } = await query.maybeSingle();

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

    // Historial desde pedido_status_logs
    const { data: history } = await supabase
      .from("pedido_status_logs")
      .select("estado_anterior, estado_nuevo, created_at, motivo, usuario_nombre")
      .eq("pedido_id", pedido.id)
      .order("created_at", { ascending: true });

    return new Response(
      JSON.stringify({
        ok: true,
        numero_guia: pedido.numero_guia,
        referencia_externa: pedido.id_externo ?? null,
        estado: pedido.estado,
        tracking_url: buildTrackingUrl(pedido.numero_guia, cred.tracking_white_label_domain),
        customer: {
          nombre: pedido.cliente_nombre,
          telefono: pedido.client_phone,
        },
        shipping: {
          direccion: pedido.direccion_entrega,
          municipio: pedido.municipio,
          barrio: pedido.barrio,
          indicador_trayecto: pedido.indicador_trayecto,
        },
        amounts: {
          valor_producto: pedido.valor_producto,
          valor_flete: pedido.valor_flete,
          valor_recaudar: pedido.valor_recaudar,
          metodo_pago: pedido.metodo_pago,
          currency: "COP",
        },
        timeline: {
          creado: pedido.fecha_creacion,
          actualizado: pedido.fecha_actualizacion,
          recogido_bodega: pedido.fecha_recoleccion_real,
          primer_intento: pedido.primer_intento_fecha,
          fecha_entrega: pedido.fecha_entrega,
          cerrado: pedido.fecha_cierre_logistico,
        },
        intentos_entrega: pedido.intentos_entrega ?? 0,
        tipo_novedad: pedido.tipo_novedad,
        history: (history ?? []).map((h: any) => ({
          from: h.estado_anterior,
          to: h.estado_nuevo,
          at: h.created_at,
          note: h.motivo,
          by: h.usuario_nombre,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("order-status error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

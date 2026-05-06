// Mercado Libre Flex — Confirma recolección de un shipment escaneado
// Permite al motorizado/aliado escanear cualquier etiqueta Flex.
// Busca un token activo de ML en integraciones_tiendas, llama a la API oficial,
// y registra el pedido en Supabase. Propaga el error de ML al frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Identify caller (motorizado/aliado)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid_user" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const shipmentId = String(body?.shipment_id ?? "").trim();
    if (!shipmentId) return json({ error: "missing_shipment_id" }, 400);

    console.log("[meli-scan] incoming", { caller: callerId, shipmentId });

    // 1) Buscar cualquier token activo de ML en la plataforma (MVP)
    const { data: tokenData, error: tokenErr } = await supabaseAdmin
      .from("integraciones_tiendas")
      .select("user_id, access_token, refresh_token, user_id_externo, organizacion_id")
      .eq("plataforma", "mercado_libre")
      .not("access_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenErr) {
      console.error("[meli-scan] token query failed", tokenErr);
      return json({ error: "token_query_failed", detail: tokenErr.message }, 500);
    }
    if (!tokenData?.access_token || !tokenData?.user_id_externo) {
      return json({
        error: "no_meli_store_connected",
        message: "No hay ninguna tienda de Mercado Libre conectada en la plataforma.",
      }, 400);
    }

    const accessToken = tokenData.access_token as string;
    const courierUserId = String(tokenData.user_id_externo);

    // 2) POST a Mercado Libre Flex
    const meliUrl = `https://api.mercadolibre.com/flex/sites/MCO/users/${courierUserId}/courier-shipment/v1`;
    const meliRes = await fetch(meliUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shipment_id: shipmentId }),
    });

    const meliText = await meliRes.text();
    let meliData: any = null;
    try { meliData = meliText ? JSON.parse(meliText) : null; } catch { /* ignore */ }

    if (!meliRes.ok) {
      const meliMsg =
        meliData?.error?.message ||
        meliData?.message ||
        meliData?.cause?.[0]?.message ||
        meliText ||
        "Error desconocido de Mercado Libre";
      console.warn("[meli-scan] ML error", meliRes.status, meliMsg);
      return json({
        error: "meli_api_error",
        status: meliRes.status,
        message: meliMsg,
        detail: meliData ?? meliText,
      }, meliRes.status === 400 || meliRes.status === 403 ? 200 : 502);
      // NB: returning 200 con error para que el frontend lo muestre como warning
    }

    // 3) Insertar pedido (idempotente por id_externo)
    const idExterno = `MELI-${shipmentId}`;
    const { data: existing } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .eq("id_externo", idExterno)
      .maybeSingle();

    if (existing) {
      return json({ ok: true, success: true, duplicate: true, pedido_id: existing.id, meli: meliData });
    }

    const { data: nextIdRow } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (nextIdRow?.id ?? 0) + 1;

    const { data: pedido, error: insErr } = await supabaseAdmin
      .from("pedidos")
      .insert({
        id: nextId,
        id_externo: idExterno,
        numero_guia: `MELI-${shipmentId.slice(-8)}`,
        canal: "MELI_FLEX",
        integration_partner: "mercado_libre",
        estado: "recolectado",
        client_user_id: tokenData.user_id,
        proveedor_logistico_id: callerId,
        aliado_logistico_id: callerId,
        organizacion_id: tokenData.organizacion_id,
        cliente_nombre: meliData?.receiver?.name ?? null,
        client_phone: meliData?.receiver?.phone ?? null,
        direccion_entrega: meliData?.receiver_address?.address_line ?? null,
        municipio: meliData?.receiver_address?.city?.name ?? null,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        fecha_recoleccion_real: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[meli-scan] insert failed", insErr);
      return json({ error: "insert_failed", message: insErr.message }, 500);
    }

    return json({ ok: true, success: true, pedido_id: pedido.id, meli: meliData });
  } catch (e) {
    console.error("[meli-scan] exception", e);
    return json({ error: "exception", message: String(e) }, 500);
  }
});

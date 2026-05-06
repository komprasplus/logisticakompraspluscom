// Mercado Libre Flex — Confirma recolección de un shipment escaneado
// Recibe shipment_id, llama a la API oficial de ML, e inserta el pedido en Supabase.
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

    // Auth: who is calling?
    const supaUser = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid_user" }, 401);
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const shipmentId = String(body?.shipment_id ?? "").trim();
    if (!shipmentId) return json({ error: "missing_shipment_id" }, 400);

    // Service-role client (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find the most recent active ML store. Prefer caller's, fallback to any.
    const { data: ownStore } = await supabase
      .from("connected_stores")
      .select("id, user_id, organizacion_id, api_access_token, meli_user_id, meli_token_expires_at, meli_refresh_token")
      .eq("plataforma", "mercado_libre")
      .eq("estado", "Activo")
      .eq("user_id", callerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let store = ownStore;
    if (!store) {
      const { data: anyStore } = await supabase
        .from("connected_stores")
        .select("id, user_id, organizacion_id, api_access_token, meli_user_id, meli_token_expires_at, meli_refresh_token")
        .eq("plataforma", "mercado_libre")
        .eq("estado", "Activo")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      store = anyStore;
    }

    if (!store?.api_access_token || !store?.meli_user_id) {
      return json({ error: "no_meli_store_connected" }, 400);
    }

    // Refresh token if expired
    let accessToken = store.api_access_token as string;
    const expiresAt = store.meli_token_expires_at ? new Date(store.meli_token_expires_at).getTime() : 0;
    if (expiresAt && expiresAt - Date.now() < 60_000 && store.meli_refresh_token) {
      const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: Deno.env.get("MELI_APP_ID")!,
          client_secret: Deno.env.get("MELI_SECRET_KEY")!,
          refresh_token: store.meli_refresh_token as string,
        }).toString(),
      });
      if (refreshRes.ok) {
        const t = await refreshRes.json();
        accessToken = t.access_token;
        await supabase.from("connected_stores").update({
          api_access_token: t.access_token,
          meli_refresh_token: t.refresh_token ?? store.meli_refresh_token,
          meli_token_expires_at: new Date(Date.now() + (Number(t.expires_in) || 21600) * 1000).toISOString(),
        }).eq("id", store.id);
      }
    }

    // Call Mercado Libre Flex API
    const courierUserId = String(store.meli_user_id);
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
      console.error("meli_api_error", meliRes.status, meliText);
      return json({ error: "meli_api_error", status: meliRes.status, detail: meliData ?? meliText }, 502);
    }

    // Insert pedido (avoid duplicates by id_externo)
    const idExterno = `MELI-${shipmentId}`;
    const { data: existing } = await supabase
      .from("pedidos")
      .select("id")
      .eq("id_externo", idExterno)
      .maybeSingle();

    if (existing) {
      return json({ ok: true, duplicate: true, pedido_id: existing.id, meli: meliData });
    }

    const { data: nextIdRow } = await supabase
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (nextIdRow?.id ?? 0) + 1;

    const { data: pedido, error: insErr } = await supabase
      .from("pedidos")
      .insert({
        id: nextId,
        id_externo: idExterno,
        numero_guia: `MELI-${shipmentId.slice(-8)}`,
        canal: "MELI_FLEX",
        integration_partner: "mercado_libre",
        estado: "recolectado",
        client_user_id: store.user_id,
        proveedor_logistico_id: callerId,
        aliado_logistico_id: callerId,
        organizacion_id: store.organizacion_id,
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
      console.error("insert_pedido_failed", insErr);
      return json({ error: "insert_failed", detail: insErr.message }, 500);
    }

    return json({ ok: true, pedido_id: pedido.id, meli: meliData });
  } catch (e) {
    console.error("meli-scan-shipment exception:", e);
    return json({ error: "exception", detail: String(e) }, 500);
  }
});

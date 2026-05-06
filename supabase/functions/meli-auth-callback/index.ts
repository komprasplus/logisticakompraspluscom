// Mercado Libre OAuth — callback as JSON API.
// Frontend captures ?code from ML redirect and POSTs { code, state } here.
// We exchange for tokens and upsert into integraciones_tiendas + connected_stores
// using SERVICE_ROLE_KEY to bypass RLS. Returns plain JSON.
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

  const CLIENT_ID = Deno.env.get("MELI_APP_ID")!;
  const CLIENT_SECRET = Deno.env.get("MELI_SECRET_KEY")!;
  const REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI")!;

  try {
    const body = await req.json().catch(() => ({}));
    const code = body?.code;
    const state = body?.state;

    console.log("[meli-callback] incoming", { hasCode: !!code, hasState: !!state });
    if (!code || !state) return json({ success: false, error: "missing_params" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("oauth_states")
      .select("state, user_id, nombre_tienda, expires_at, provider")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow || stateRow.provider !== "mercado_libre") {
      console.error("[meli-callback] invalid_state", { stateErr, stateRow });
      return json({ success: false, error: "invalid_state" }, 400);
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("oauth_states").delete().eq("state", state);
      return json({ success: false, error: "state_expired" }, 400);
    }
    await supabaseAdmin.from("oauth_states").delete().eq("state", state);

    // Exchange code → token
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error("[meli-callback] token_exchange_failed", tokenRes.status, errTxt);
      return json({ success: false, error: "token_exchange", detail: errTxt }, 400);
    }

    const tokenJson = await tokenRes.json();
    console.log("Tokens recibidos de ML:", {
      has_access: !!tokenJson.access_token,
      has_refresh: !!tokenJson.refresh_token,
      meli_user_id: tokenJson.user_id,
      expires_in: tokenJson.expires_in,
    });

    const { access_token, refresh_token, expires_in, user_id: meli_user_id } = tokenJson;
    if (!access_token) return json({ success: false, error: "no_token" }, 400);

    const expiresAt = new Date(Date.now() + (Number(expires_in) || 21600) * 1000).toISOString();
    const meliUserIdStr = meli_user_id ? String(meli_user_id) : null;

    // 1) UPSERT canonical: integraciones_tiendas
    const { error: integErr } = await supabaseAdmin
      .from("integraciones_tiendas")
      .upsert(
        {
          user_id: stateRow.user_id,
          plataforma: "mercado_libre",
          access_token,
          refresh_token: refresh_token ?? null,
          user_id_externo: meliUserIdStr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,plataforma" },
      );

    if (integErr) {
      console.error("Error guardando en BD:", integErr);
      return json({ success: false, error: "db_save_integ", detail: integErr.message }, 500);
    }

    // 2) Mirror to legacy connected_stores (non-fatal)
    const urlTienda = `meli:${meliUserIdStr ?? stateRow.user_id}`;
    const { error: csErr } = await supabaseAdmin
      .from("connected_stores")
      .upsert(
        {
          user_id: stateRow.user_id,
          plataforma: "mercado_libre",
          nombre_tienda: stateRow.nombre_tienda || "Mercado Libre",
          url_tienda: urlTienda,
          api_access_token: access_token,
          meli_user_id: meliUserIdStr,
          meli_refresh_token: refresh_token ?? null,
          meli_token_expires_at: expiresAt,
          estado: "Activo",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "url_tienda" },
      );

    if (csErr) {
      console.error("[meli-callback] connected_stores warn (non-fatal):", csErr);
    }

    console.log("[meli-callback] success", { user: stateRow.user_id, meli_user_id: meliUserIdStr });
    return json({ success: true, meli_user_id: meliUserIdStr });
  } catch (e) {
    console.error("[meli-callback] exception:", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

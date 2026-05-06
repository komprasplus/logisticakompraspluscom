// Mercado Libre OAuth — Step 2: callback. Exchanges code → access_token,
// persists tokens in BOTH `integraciones_tiendas` (canonical token store) and
// `connected_stores` (legacy). Uses SERVICE_ROLE_KEY to bypass RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const CLIENT_ID = Deno.env.get("MELI_APP_ID")!;
  const CLIENT_SECRET = Deno.env.get("MELI_SECRET_KEY")!;
  const REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI")!;
  const APP_RETURN_URL =
    Deno.env.get("MELI_APP_RETURN_URL") ??
    "https://logistica.komprasplus.com/cliente?view=integraciones";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    console.log("[meli-callback] incoming", { hasCode: !!code, hasState: !!state, errorParam });

    if (errorParam) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !state) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=missing_params`);
    }

    // ✅ SERVICE ROLE client — bypasses RLS for token persistence
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
      return redirect(`${APP_RETURN_URL}&meli=error&reason=invalid_state`);
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("oauth_states").delete().eq("state", state);
      return redirect(`${APP_RETURN_URL}&meli=error&reason=state_expired`);
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
      return redirect(`${APP_RETURN_URL}&meli=error&reason=token_exchange`);
    }

    const tokenJson = await tokenRes.json();
    console.log("[meli-callback] Tokens recibidos de ML:", {
      has_access: !!tokenJson.access_token,
      has_refresh: !!tokenJson.refresh_token,
      meli_user_id: tokenJson.user_id,
      expires_in: tokenJson.expires_in,
    });

    const { access_token, refresh_token, expires_in, user_id: meli_user_id } = tokenJson;
    if (!access_token) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=no_token`);
    }

    const expiresAt = new Date(Date.now() + (Number(expires_in) || 21600) * 1000).toISOString();
    const meliUserIdStr = meli_user_id ? String(meli_user_id) : null;

    // ── 1. UPSERT canonical: integraciones_tiendas ─────────────────────────
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
      console.error("[meli-callback] Error guardando en BD (integraciones_tiendas):", integErr);
      return redirect(`${APP_RETURN_URL}&meli=error&reason=db_save_integ`);
    }
    console.log("[meli-callback] integraciones_tiendas OK", { user_id: stateRow.user_id });

    // ── 2. UPSERT legacy mirror: connected_stores ──────────────────────────
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
      console.error("[meli-callback] Warning guardando connected_stores (no fatal):", csErr);
    }

    console.log("[meli-callback] meli_oauth_success", { user: stateRow.user_id, meli_user_id: meliUserIdStr });
    return redirect(`${APP_RETURN_URL}&meli=success`);
  } catch (e) {
    console.error("[meli-callback] exception:", e);
    return redirect(`${APP_RETURN_URL}&meli=error&reason=exception`);
  }
});

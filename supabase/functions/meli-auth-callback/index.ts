// Mercado Libre OAuth — Step 2: callback. Exchanges code → access_token, persists in connected_stores
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

    if (errorParam) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !state) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=missing_params`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("state, user_id, nombre_tienda, expires_at, provider")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow || stateRow.provider !== "mercado_libre") {
      console.error("invalid_state", { stateErr, stateRow });
      return redirect(`${APP_RETURN_URL}&meli=error&reason=invalid_state`);
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return redirect(`${APP_RETURN_URL}&meli=error&reason=state_expired`);
    }
    await supabase.from("oauth_states").delete().eq("state", state);

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
      console.error("token_exchange_failed", tokenRes.status, errTxt);
      return redirect(`${APP_RETURN_URL}&meli=error&reason=token_exchange`);
    }

    const tokenJson = await tokenRes.json();
    const { access_token, refresh_token, expires_in, user_id: meli_user_id } = tokenJson;
    if (!access_token) {
      return redirect(`${APP_RETURN_URL}&meli=error&reason=no_token`);
    }

    const expiresAt = new Date(Date.now() + (Number(expires_in) || 21600) * 1000).toISOString();
    const meliUserIdStr = meli_user_id ? String(meli_user_id) : null;
    const urlTienda = `meli:${meliUserIdStr ?? stateRow.user_id}`;

    const { error: upsertErr } = await supabase
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

    if (upsertErr) {
      console.error("upsert_failed", upsertErr);
      return redirect(`${APP_RETURN_URL}&meli=error&reason=db_save`);
    }

    console.log("meli_oauth_success", { user: stateRow.user_id, meli_user_id: meliUserIdStr });
    return redirect(`${APP_RETURN_URL}&meli=success`);
  } catch (e) {
    console.error("meli-auth-callback error:", e);
    return redirect(`${APP_RETURN_URL}&meli=error&reason=exception`);
  }
});

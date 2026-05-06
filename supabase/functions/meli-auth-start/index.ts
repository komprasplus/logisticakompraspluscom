// Mercado Libre OAuth — Step 1: build authorization URL with DB-backed state.
// Modes:
//  - GET ?token=<jwt>  → HTTP 302 redirect directly to Mercado Libre (top-level)
//  - POST { nombre_tienda } with Authorization header → JSON { url } (legacy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Strict env read + validation
    const clientId = Deno.env.get("MELI_APP_ID");
    const redirectUri = Deno.env.get("MELI_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      console.error("[meli-auth-start] MISSING ENV", {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri,
      });
      return jsonError(
        "Server configuration error: Missing MELI_APP_ID or MELI_REDIRECT_URI",
        500,
      );
    }

    const url = new URL(req.url);
    const isGet = req.method === "GET";

    // Resolve user from Authorization header (POST) or ?token= (GET top-level)
    let authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader && isGet) {
      const tok = url.searchParams.get("token");
      if (tok) authHeader = `Bearer ${tok}`;
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      if (isGet) {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://logistica.komprasplus.com/auth?meli=error&reason=unauth" },
        });
      }
      return jsonError("No autenticado", 401);
    }

    let nombre = "Mercado Libre";
    if (!isGet) {
      const body = await req.json().catch(() => ({}));
      nombre = String(body?.nombre_tienda || "").trim().slice(0, 120) || "Mercado Libre";
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabaseAdmin.from("oauth_states").delete().lt("expires_at", new Date().toISOString());

    const state = crypto.randomUUID();
    const { error: insErr } = await supabaseAdmin.from("oauth_states").insert({
      state,
      user_id: user.id,
      shop_domain: "mercadolibre",
      nombre_tienda: nombre,
      provider: "mercado_libre",
    });
    if (insErr) {
      console.error("[meli-auth-start] insert oauth_states failed:", insErr);
      return jsonError("No se pudo iniciar OAuth (state)", 500);
    }

    // 2) Strict URL construction with URLSearchParams (proper encoding)
    const authUrl = new URL("https://auth.mercadolibre.com.co/authorization");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);

    const finalUrl = authUrl.toString();
    console.log("[meli-auth-start] OK", {
      mode: req.method,
      state,
      redirect_uri: redirectUri,
      client_id_len: clientId.length,
      authUrl: finalUrl,
    });

    if (isGet) {
      return new Response(null, { status: 302, headers: { Location: finalUrl } });
    }

    return new Response(JSON.stringify({ url: finalUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meli-auth-start error:", e);
    return jsonError((e as Error).message, 500);
  }
});

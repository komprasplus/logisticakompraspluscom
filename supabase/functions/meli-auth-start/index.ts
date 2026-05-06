// Mercado Libre OAuth — Step 1: build authorization URL with DB-backed state
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("MELI_APP_ID");
    const REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI");
    if (!CLIENT_ID || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Faltan MELI_APP_ID / MELI_REDIRECT_URI en secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre_tienda || "").trim().slice(0, 120) || "Mercado Libre";

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
      return new Response(JSON.stringify({ error: "No se pudo iniciar OAuth (state)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state,
    });
    const url = `https://auth.mercadolibre.com.co/authorization?${params.toString()}`;

    console.log("[meli-auth-start] OK", { state, redirect_uri: REDIRECT_URI });

    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meli-auth-start error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

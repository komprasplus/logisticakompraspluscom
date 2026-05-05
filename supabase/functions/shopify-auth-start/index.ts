// Shopify OAuth — Step 1: build authorization URL using DB-backed state (no cookies)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCOPES = "write_products,read_products,read_orders,write_orders";

function normalizeShopDomain(raw: string): string {
  let d = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (d && !d.includes(".myshopify.com")) d = `${d}.myshopify.com`;
  return d;
}

function isValidShopDomain(d: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID");
    const REDIRECT_URI = Deno.env.get("SHOPIFY_REDIRECT_URI");
    if (!CLIENT_ID || !REDIRECT_URI) {
      return new Response(JSON.stringify({ error: "Faltan SHOPIFY_CLIENT_ID / SHOPIFY_REDIRECT_URI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const shop = normalizeShopDomain(body.shop_domain);
    const nombre = String(body.nombre_tienda || "").trim().slice(0, 120);

    if (!isValidShopDomain(shop)) {
      return new Response(JSON.stringify({ error: "URL inválida. Debe ser tu-tienda.myshopify.com" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist state in DB (bypass cookies)
    const state = crypto.randomUUID();
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Best-effort cleanup of expired states
    await supabaseAdmin.from("oauth_states").delete().lt("expires_at", new Date().toISOString());

    const { error: insErr } = await supabaseAdmin.from("oauth_states").insert({
      state,
      user_id: user.id,
      shop_domain: shop,
      nombre_tienda: nombre || shop,
      provider: "shopify",
    });
    if (insErr) {
      console.error("[shopify-auth-start] insert oauth_states failed:", insErr);
      return new Response(JSON.stringify({ error: "No se pudo iniciar OAuth (state)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
    });
    const url = `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    console.log("[shopify-auth-start] OK", { shop, state, redirect_uri: REDIRECT_URI });

    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shopify-auth-start error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Shopify OAuth flow — Step 1: build authorization URL
// Called from the client with a JWT. Returns { url } to redirect the user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCOPES = "write_products,read_products,read_orders,write_orders";

function normalizeShopDomain(raw: string): string {
  let cleanDomain = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com.*$/, ".myshopify.com");

  // Auto-append .myshopify.com if missing
  if (cleanDomain && !cleanDomain.includes(".myshopify.com")) {
    cleanDomain = `${cleanDomain}.myshopify.com`;
  }
  return cleanDomain;
}

function isValidShopDomain(domain: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain);
}

async function signState(payload: object, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${b64}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET");
    const REDIRECT_URI = Deno.env.get("SHOPIFY_REDIRECT_URI");

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno SHOPIFY_*" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authenticate caller via JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const shop = normalizeShopDomain(body.shop_domain);
    const nombre = String(body.nombre_tienda || "").trim().slice(0, 120);

    if (!isValidShopDomain(shop)) {
      return new Response(
        JSON.stringify({ error: "URL inválida. Debe ser tu-tienda.myshopify.com" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sign state (no DB needed). Expires in 10 minutes.
    const nonce = crypto.randomUUID();
    const state = await signState(
      {
        u: user.id,
        s: shop,
        n: nombre || shop,
        x: Date.now() + 10 * 60 * 1000,
        r: nonce,
      },
      CLIENT_SECRET,
    );

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
    });

    const url = `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shopify-auth-start error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Edge Function: export-to-shopify
// Recibe { product_id } de marketplace_products, busca la tienda Shopify activa
// del usuario autenticado y crea el producto vía Admin API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    // Identify user from JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const productId: string | undefined = body?.product_id;
    const storeId: string | undefined = body?.store_id; // opcional
    if (!productId) return json({ error: "product_id requerido" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Producto
    const { data: product, error: prodErr } = await admin
      .from("marketplace_products")
      .select("id, product_name, description, sku, suggested_price, stock_available, image_url, category, weight_kg")
      .eq("id", productId)
      .maybeSingle();
    if (prodErr || !product) return json({ error: "Producto no encontrado" }, 404);

    // 2. Tienda Shopify activa del usuario
    let storeQuery = admin
      .from("connected_stores")
      .select("id, url_tienda, api_access_token, nombre_tienda")
      .eq("user_id", userId)
      .eq("plataforma", "shopify")
      .eq("estado", "Activo");
    if (storeId) storeQuery = storeQuery.eq("id", storeId);

    const { data: stores, error: storeErr } = await storeQuery.limit(1);
    if (storeErr) return json({ error: "Error consultando tiendas" }, 500);
    const store = stores?.[0];
    if (!store) {
      return json(
        { error: "No tienes una tienda Shopify activa vinculada. Ve a Integraciones para conectar una." },
        400,
      );
    }

    // 3. Construir payload Shopify
    const shopifyPayload = {
      product: {
        title: product.product_name,
        body_html: product.description ? `<p>${product.description.replace(/\n/g, "<br/>")}</p>` : "",
        vendor: "Plus Envíos",
        product_type: product.category ?? "",
        status: "active",
        images: product.image_url ? [{ src: product.image_url }] : [],
        variants: [
          {
            price: String(product.suggested_price ?? 0),
            sku: product.sku ?? "",
            inventory_quantity: product.stock_available ?? 0,
            inventory_management: "shopify",
            weight: product.weight_kg ?? 0,
            weight_unit: "kg",
            requires_shipping: true,
          },
        ],
      },
    };

    // 4. POST a Shopify
    const shopUrl = `https://${store.url_tienda}/admin/api/2024-01/products.json`;
    const shopifyRes = await fetch(shopUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": store.api_access_token,
      },
      body: JSON.stringify(shopifyPayload),
    });

    const shopifyJson = await shopifyRes.json().catch(() => ({}));
    if (!shopifyRes.ok) {
      console.error("Shopify error", shopifyRes.status, shopifyJson);
      return json(
        {
          error: "Shopify rechazó el producto",
          details: shopifyJson?.errors ?? shopifyJson,
          status: shopifyRes.status,
        },
        502,
      );
    }

    return json({
      success: true,
      shopify_product_id: shopifyJson?.product?.id,
      shopify_handle: shopifyJson?.product?.handle,
      store_name: store.nombre_tienda,
      shop_domain: store.url_tienda,
    });
  } catch (err) {
    console.error("export-to-shopify exception:", err);
    return json({ error: (err as Error).message ?? "Error interno" }, 500);
  }
});

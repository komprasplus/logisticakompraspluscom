// Edge Function: export-to-shopify
// Recibe { product_id } de marketplace_products, busca la tienda Shopify activa
// del usuario autenticado y crea el producto vía Admin API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const storeId: string | undefined = body?.store_id;
    if (!productId) return json({ error: "product_id requerido" }, 400);

    // Service role client → bypass RLS para lectura del producto maestro
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Producto (sólo columnas existentes en marketplace_products)
    const { data: product, error: prodErr } = await admin
      .from("marketplace_products")
      .select(
        "id, product_name, description, sku, suggested_price, stock_available, image_url, image_url_2, image_url_3, category, product_type",
      )
      .eq("id", productId)
      .maybeSingle();

    if (prodErr) {
      console.error("DB error producto:", prodErr);
      return json({ error: "Error consultando producto: " + prodErr.message }, 500);
    }
    if (!product) {
      return json({ error: "El producto ya no existe en la Mega Bodega." }, 404);
    }

    // 2. Tienda Shopify activa del usuario
    let storeQuery = admin
      .from("connected_stores")
      .select("id, url_tienda, api_access_token, nombre_tienda")
      .eq("user_id", userId)
      .eq("plataforma", "shopify")
      .eq("estado", "Activo");
    if (storeId) storeQuery = storeQuery.eq("id", storeId);

    const { data: stores, error: storeErr } = await storeQuery.limit(1);
    if (storeErr) return json({ error: "Error consultando tiendas: " + storeErr.message }, 500);
    const store = stores?.[0];
    if (!store) {
      return json(
        { error: "Credenciales de Shopify no encontradas. Conecta tu tienda en Integraciones." },
        400,
      );
    }

    // 3. Construir payload Shopify
    const images = [product.image_url, product.image_url_2, product.image_url_3]
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .map((src) => ({ src }));

    const shopifyPayload = {
      product: {
        title: product.product_name,
        body_html: product.description
          ? `<p>${String(product.description).replace(/\n/g, "<br/>")}</p>`
          : "",
        vendor: "Plus Envíos",
        product_type: product.category ?? product.product_type ?? "",
        status: "active",
        images,
        variants: [
          {
            price: String(product.suggested_price ?? 0),
            sku: product.sku ?? "",
            inventory_quantity: product.stock_available ?? 0,
            inventory_management: "shopify",
            requires_shipping: true,
          },
        ],
      },
    };

    // 4. Sanitizar dominio (quitar protocolo, slashes, paths, espacios)
    const cleanDomain = String(store.url_tienda || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\s+/g, "");

    if (!cleanDomain || !cleanDomain.includes(".")) {
      return json({ error: `Dominio Shopify inválido: "${store.url_tienda}". Debe ser tu-tienda.myshopify.com` }, 400);
    }

    const token = String(store.api_access_token || "").trim();
    if (!token) {
      return json({ error: "Access Token de Shopify vacío. Reconecta tu tienda en Integraciones." }, 400);
    }

    const shopUrl = `https://${cleanDomain}/admin/api/2024-01/products.json`;
    const maskedToken = token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : "***";
    console.log("Shopify request →", { endpoint: shopUrl, token: maskedToken, title: shopifyPayload.product.title });

    const shopifyRes = await fetch(shopUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (shopifyRes.status !== 201) {
      const errText = await shopifyRes.text();
      console.error("Shopify error", shopifyRes.status, errText);
      return json(
        { error: `Shopify rechazó el producto (${shopifyRes.status}): ${errText.slice(0, 500)}` },
        502,
      );
    }

    const shopifyJson = await shopifyRes.json().catch(() => ({}));
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

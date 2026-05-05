// Shopify OAuth — Step 2: callback handler with DB-backed state validation (no cookies)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeShopDomain(raw: string): string {
  let d = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "");
  if (d && !d.includes(".myshopify.com")) d = `${d}.myshopify.com`;
  return d;
}

function htmlRedirect(url: string, message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Conectando con Shopify…</title>
<meta http-equiv="refresh" content="1;url=${url}">
<body style="font-family:system-ui;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
<div><h2>${message}</h2><p>Redirigiendo… <a style="color:#00D1FF" href="${url}">Continuar</a></p></div>
</body>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
  const APP_RETURN_URL =
    Deno.env.get("SHOPIFY_APP_RETURN_URL") ??
    "https://logistica.komprasplus.com/cliente?view=integraciones";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const shopParam = url.searchParams.get("shop");
    const hmacParam = url.searchParams.get("hmac");

    if (!code || !state || !shopParam || !hmacParam) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=missing_params`, "❌ Parámetros incompletos");
    }

    // Sanitización extrema del shop recibido
    const cleanShop = normalizeShopDomain(shopParam);
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleanShop)) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=invalid_shop`, "❌ Dominio inválido");
    }

    // Validar HMAC de Shopify (autenticidad del callback)
    const params = new URLSearchParams(url.search);
    params.delete("hmac");
    params.delete("signature");
    const sortedKeys = [...params.keys()].sort();
    const message = sortedKeys.map((k) => `${k}=${params.get(k)}`).join("&");
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CLIENT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(message));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (computed !== hmacParam.toLowerCase()) {
      console.error("invalid_hmac", { computed, hmacParam });
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=invalid_hmac`, "❌ Firma de Shopify inválida");
    }

    // Recuperar state de la BD
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("state, user_id, shop_domain, nombre_tienda, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow) {
      console.error("state_not_found", { state, stateErr });
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=invalid_state`, "❌ Estado inválido o expirado");
    }

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=state_expired`, "❌ Sesión OAuth expirada");
    }

    const expectedShop = normalizeShopDomain(stateRow.shop_domain);
    if (expectedShop !== cleanShop) {
      console.error("shop_mismatch", { expectedShop, cleanShop });
      await supabase.from("oauth_states").delete().eq("state", state);
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=shop_mismatch`, "❌ Tienda no coincide");
    }

    // Estado validado — borrar registro temporal
    await supabase.from("oauth_states").delete().eq("state", state);

    // Intercambio code → access_token
    const tokenRes = await fetch(`https://${cleanShop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error("token_exchange_failed", tokenRes.status, errTxt);
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=token_exchange`, "❌ Shopify rechazó el intercambio de token");
    }

    const { access_token, scope } = await tokenRes.json();
    if (!access_token) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=no_token`, "❌ Token vacío");
    }

    // Persistir en connected_stores
    const { error: upsertErr } = await supabase
      .from("connected_stores")
      .upsert(
        {
          user_id: stateRow.user_id,
          plataforma: "shopify",
          nombre_tienda: stateRow.nombre_tienda || cleanShop,
          url_tienda: cleanShop,
          api_access_token: access_token,
          estado: "Activo",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "url_tienda" },
      );

    if (upsertErr) {
      console.error("upsert_failed", upsertErr);
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=db_save`, "❌ No se pudo guardar la tienda");
    }

    console.log("shopify_oauth_success", { user: stateRow.user_id, shop: cleanShop, scope });
    return htmlRedirect(
      `${APP_RETURN_URL}&shopify=success&shop=${encodeURIComponent(cleanShop)}`,
      "✅ Tienda conectada con éxito",
    );
  } catch (e) {
    console.error("shopify-auth-callback error:", e);
    return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=exception`, "❌ Error inesperado");
  }
});

// Shopify OAuth flow — Step 2: callback handler
// Shopify redirects the browser here with ?code=...&state=...&shop=...
// We exchange the code for an access_token, persist it, and redirect to the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b);
}

async function verifyState(token: string, secret: string): Promise<any | null> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecode(payloadB64));
    if (typeof payload.x !== "number" || payload.x < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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

    if (!code || !state || !shopParam) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=missing_params`, "❌ Parámetros incompletos");
    }

    const payload = await verifyState(state, CLIENT_SECRET);
    if (!payload) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=invalid_state`, "❌ Estado inválido o expirado");
    }
    if (payload.s !== shopParam.toLowerCase()) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=shop_mismatch`, "❌ Dominio no coincide");
    }

    // Exchange code → access token
    const tokenRes = await fetch(`https://${shopParam}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error("Shopify token exchange failed:", tokenRes.status, errTxt);
      return htmlRedirect(
        `${APP_RETURN_URL}&shopify=error&reason=token_exchange`,
        "❌ Shopify rechazó el intercambio de token",
      );
    }

    const { access_token, scope } = await tokenRes.json();
    if (!access_token) {
      return htmlRedirect(`${APP_RETURN_URL}&shopify=error&reason=no_token`, "❌ Token vacío");
    }

    // Persist using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upsertErr } = await supabase
      .from("connected_stores")
      .upsert(
        {
          user_id: payload.u,
          plataforma: "shopify",
          nombre_tienda: payload.n || shopParam,
          url_tienda: shopParam.toLowerCase(),
          api_access_token: access_token,
          estado: "Activo",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "url_tienda" },
      );

    if (upsertErr) {
      console.error("Upsert connected_stores failed:", upsertErr);
      return htmlRedirect(
        `${APP_RETURN_URL}&shopify=error&reason=db_save`,
        "❌ No se pudo guardar la tienda",
      );
    }

    console.log(`Shopify OAuth success for user=${payload.u} shop=${shopParam} scope=${scope}`);
    return htmlRedirect(
      `${APP_RETURN_URL}&shopify=success&shop=${encodeURIComponent(shopParam)}`,
      "✅ Tienda conectada con éxito",
    );
  } catch (e) {
    console.error("shopify-auth-callback error:", e);
    return htmlRedirect(
      `${APP_RETURN_URL}&shopify=error&reason=exception`,
      "❌ Error inesperado",
    );
  }
});

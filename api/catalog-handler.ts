/**
 * Vercel Serverless Function: catalog-handler
 *
 * SOLO se llama cuando Vercel detecta que el visitante es un crawler
 * (WhatsApp, FB, Twitter, etc.) via header has-rule en vercel.json.
 *
 * Para crawlers: devuelve HTML con meta tags Open Graph correctos para
 * que la preview muestre el logo + nombre + foto del producto.
 *
 * Usuarios normales NUNCA tocan este endpoint — Vercel les sirve el SPA
 * directo y el path se preserva.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://hhjygradtikonvfzarrn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoanlncmFkdGlrb252ZnphcnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTE5MjAsImV4cCI6MjA4NDA4NzkyMH0.x6TESBKDKcgHvv8U0CkoxpTRewSLWrcGxCc-uLDU4Mw";

const PROD_DOMAIN = "https://logistica.komprasplus.com";
const FALLBACK_IMG = `${PROD_DOMAIN}/og-default.jpg`;

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const trimDescription = (raw: unknown, max = 200): string => {
  if (!raw) return "";
  const plain = String(raw).replace(/[#*`>_~]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > max ? plain.slice(0, max - 1) + "…" : plain;
};

const fetchProvider = async (slug: string) => {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_provider_catalog_v2`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_slug: slug, p_lista_slug: null, p_codigo_acceso: null }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
};

const fetchProduct = async (slug: string, productId: string) => {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_product_detail`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ slug, product_id: productId }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
};

interface MetaPayload {
  title: string;
  description: string;
  image: string;
  type: "product" | "website";
  url: string;
}

const renderHtml = (meta: MetaPayload): string => {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const i = escapeHtml(meta.image || FALLBACK_IMG);
  const u = escapeHtml(meta.url);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:secure_url" content="${i}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${u}" />
<meta property="og:type" content="${meta.type}" />
<meta property="og:locale" content="es_CO" />
<meta property="og:site_name" content="Plus Envíos" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<img src="${i}" alt="${t}" style="max-width:600px;" />
<p><a href="${u}">Abrir catálogo</a></p>
</body>
</html>`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rawUrl = req.url || "/";
    const pathOnly = rawUrl.split("?")[0];
    const match = pathOnly.match(/^\/([^/]+)\/catalogo(?:\/(?:lista\/[^/]+|([^/]+)))?\/?$/);

    let meta: MetaPayload = {
      title: "Plus Envíos · Catálogos B2B",
      description: "Plataforma de logística y catálogos B2B para Colombia.",
      image: FALLBACK_IMG,
      type: "website",
      url: PROD_DOMAIN + pathOnly,
    };

    if (match) {
      const providerSlug = decodeURIComponent(match[1]);
      const productKey = match[2] ? decodeURIComponent(match[2]) : null;
      const fullUrl = PROD_DOMAIN + pathOnly;

      const catalog = await fetchProvider(providerSlug);
      const provider = catalog?.provider ?? null;

      if (productKey && provider) {
        const detail = await fetchProduct(providerSlug, productKey);
        const p = detail?.found ? detail.product : null;
        if (p) {
          const price = p.price ? ` · $${Number(p.price).toLocaleString("es-CO")} COP` : "";
          meta = {
            title: `${p.product_name}${price} | ${provider.store_name ?? "Catálogo"}`,
            description:
              trimDescription(p.description_md || p.description) ||
              `${p.product_name} disponible en ${provider.store_name}.`,
            image:
              (Array.isArray(p.image_urls) && p.image_urls[0]) ||
              p.image_url ||
              provider.logo_url ||
              provider.avatar_url ||
              FALLBACK_IMG,
            type: "product",
            url: fullUrl,
          };
        }
      } else if (provider) {
        meta = {
          title: provider.hero_title
            ? `${provider.hero_title} | ${provider.store_name}`
            : `${provider.store_name} | Catálogo B2B`,
          description:
            provider.hero_subtitle ||
            trimDescription(provider.description) ||
            `Conoce los productos de ${provider.store_name}.`,
          image:
            provider.hero_image_url ||
            provider.logo_url ||
            provider.avatar_url ||
            FALLBACK_IMG,
          type: "website",
          url: fullUrl,
        };
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(renderHtml(meta));
  } catch (e) {
    console.error("catalog-handler error:", e);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html><html><head><title>Plus Envíos</title></head><body>Plus Envíos</body></html>`);
  }
}

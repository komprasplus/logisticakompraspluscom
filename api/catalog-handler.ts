/**
 * Vercel Serverless Function: catalog-handler
 *
 * Intercepta visitas a /:slug/catalogo y /:slug/catalogo/:product, consulta
 * Supabase, y devuelve el index.html del SPA pero con meta tags Open Graph
 * (og:title, og:description, og:image) rellenados con la data real.
 *
 * Esto hace que cuando alguien comparte el link por WhatsApp / Facebook /
 * Telegram / etc, la preview muestre el logo + nombre + foto del producto,
 * en vez de una preview genérica de "Plus Envíos".
 *
 * Para usuarios normales: el SPA se monta encima sin cambio visible.
 */

import { readFile } from "fs/promises";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://hhjygradtikonvfzarrn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoanlncmFkdGlrb252ZnphcnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTE5MjAsImV4cCI6MjA4NDA4NzkyMH0.x6TESBKDKcgHvv8U0CkoxpTRewSLWrcGxCc-uLDU4Mw";

const PROD_DOMAIN = "https://logistica.komprasplus.com";
const FALLBACK_IMG = `${PROD_DOMAIN}/og-default.jpg`;

interface ProviderShape {
  store_name?: string;
  description?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
  hero_image_url?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
}

interface ProductShape {
  product_name?: string;
  description?: string | null;
  description_md?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  price?: number | null;
}

const escapeHtml = (s: string): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const trimDescription = (raw?: string | null, max = 200): string => {
  if (!raw) return "";
  const plain = String(raw).replace(/[#*`>_~]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > max ? plain.slice(0, max - 1) + "…" : plain;
};

const fetchProvider = async (slug: string) => {
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
};

const fetchProduct = async (slug: string, productId: string) => {
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
};

interface MetaPayload {
  title: string;
  description: string;
  image: string;
  type: "product" | "website";
  url: string;
}

const buildMetaTags = (m: MetaPayload): string => {
  const t = escapeHtml(m.title);
  const d = escapeHtml(m.description);
  const i = escapeHtml(m.image || FALLBACK_IMG);
  const u = escapeHtml(m.url);
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />

    <!-- Open Graph (Facebook, WhatsApp, LinkedIn, etc.) -->
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${i}" />
    <meta property="og:image:secure_url" content="${i}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${u}" />
    <meta property="og:type" content="${m.type}" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:site_name" content="Plus Envíos" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${i}" />`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = req.url || "/";
    // Parsear /{provider}/catalogo o /{provider}/catalogo/{product_id_or_slug}
    const match = url.match(/^\/([^/?#]+)\/catalogo(?:\/(?:lista\/[^/?#]+|([^/?#]+)))?/);

    // Leer el SPA shell (build de Vite)
    const htmlPath = path.join(process.cwd(), "dist", "index.html");
    let shell: string;
    try {
      shell = await readFile(htmlPath, "utf-8");
    } catch {
      // Fallback: si dist no existe (preview de dev), entregar HTML mínimo
      shell = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"></head><body><div id=\"root\"></div></body></html>";
    }

    let meta: MetaPayload = {
      title: "Plus Envíos · Catálogos B2B",
      description: "Plataforma de logística y catálogos B2B para Colombia.",
      image: FALLBACK_IMG,
      type: "website",
      url: PROD_DOMAIN + url,
    };

    if (match) {
      const [, providerSlug, productKey] = match;
      const fullUrl = PROD_DOMAIN + url;

      try {
        const catalog = await fetchProvider(providerSlug);
        const provider: ProviderShape | null = catalog?.provider ?? null;

        if (productKey && provider) {
          const detail = await fetchProduct(providerSlug, productKey);
          const p: ProductShape | null = detail?.found ? detail.product : null;
          if (p) {
            const price = p.price ? ` · $${Number(p.price).toLocaleString("es-CO")} COP` : "";
            meta = {
              title: `${p.product_name}${price} | ${provider.store_name ?? "Catálogo"}`,
              description: trimDescription(p.description_md || p.description) ||
                `${p.product_name} disponible en ${provider.store_name}.`,
              image: (p.image_urls && p.image_urls[0]) || p.image_url || provider.logo_url || provider.avatar_url || FALLBACK_IMG,
              type: "product",
              url: fullUrl,
            };
          } else if (provider) {
            meta = {
              title: `${provider.store_name ?? "Catálogo"} | Plus Envíos`,
              description: trimDescription(provider.description) || "Conoce nuestros productos.",
              image: provider.hero_image_url || provider.logo_url || provider.avatar_url || FALLBACK_IMG,
              type: "website",
              url: fullUrl,
            };
          }
        } else if (provider) {
          meta = {
            title: provider.hero_title
              ? `${provider.hero_title} | ${provider.store_name}`
              : `${provider.store_name} | Catálogo B2B`,
            description: provider.hero_subtitle ||
              trimDescription(provider.description) ||
              `Conoce los productos de ${provider.store_name}.`,
            image: provider.hero_image_url || provider.logo_url || provider.avatar_url || FALLBACK_IMG,
            type: "website",
            url: fullUrl,
          };
        }
      } catch (e) {
        console.warn("catalog-handler: error obteniendo meta", e);
      }
    }

    // Inyectar meta tags antes de </head>, removiendo los tags previos que choquen
    const newMeta = buildMetaTags(meta);
    let finalHtml = shell;
    // Quitar title y description existentes del shell para que los nuestros tomen prioridad
    finalHtml = finalHtml.replace(/<title>[^<]*<\/title>/i, "");
    finalHtml = finalHtml.replace(/<meta\s+name="description"[^>]*>/gi, "");
    finalHtml = finalHtml.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "");
    finalHtml = finalHtml.replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");
    finalHtml = finalHtml.replace("</head>", `${newMeta}\n  </head>`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache 5 min para evitar pegarle a Supabase cada visita
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(finalHtml);
  } catch (e) {
    console.error("catalog-handler error:", e);
    res.status(500).send("Internal error");
  }
}

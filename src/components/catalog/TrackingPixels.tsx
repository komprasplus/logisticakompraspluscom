/**
 * TrackingPixels — Inyecta scripts de Meta Pixel, TikTok Pixel y Google
 * Analytics 4 SOLO en el catálogo público del proveedor que los configuró.
 *
 * Idempotente: si los IDs no cambian, no reinyecta. Los pixeles permanecen
 * cargados durante la sesión del visitante para que los eventos posteriores
 * (AddToCart, Purchase, etc.) los reciban.
 */
import { useEffect } from "react";

interface PixelIds {
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
  ga4Id?: string | null;
}

// Singleton: nunca re-inicializar el mismo ID
const initialized = {
  meta: new Set<string>(),
  tiktok: new Set<string>(),
  ga4: new Set<string>(),
};

const injectScript = (src: string, id: string) => {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
};

const injectInlineScript = (id: string, code: string) => {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
};

const initMetaPixel = (pixelId: string) => {
  if (initialized.meta.has(pixelId)) return;
  initialized.meta.add(pixelId);

  injectInlineScript(
    "pls-meta-pixel-base",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`,
  );

  // Inicializar el pixel + PageView
  injectInlineScript(
    `pls-meta-pixel-init-${pixelId}`,
    `fbq('init', '${pixelId}'); fbq('track', 'PageView');`,
  );
};

const initTikTokPixel = (pixelId: string) => {
  if (initialized.tiktok.has(pixelId)) return;
  initialized.tiktok.add(pixelId);

  injectInlineScript(
    "pls-tiktok-pixel-base",
    `!function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}; ttq.load('${pixelId}'); ttq.page(); }(window, document, 'ttq');`,
  );
};

const initGA4 = (measurementId: string) => {
  if (initialized.ga4.has(measurementId)) return;
  initialized.ga4.add(measurementId);

  injectScript(
    `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    `pls-ga4-base-${measurementId}`,
  );
  injectInlineScript(
    `pls-ga4-init-${measurementId}`,
    `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} window.gtag = window.gtag || gtag; gtag('js', new Date()); gtag('config', '${measurementId}');`,
  );
};

const TrackingPixels = ({ metaPixelId, tiktokPixelId, ga4Id }: PixelIds) => {
  useEffect(() => {
    if (metaPixelId) initMetaPixel(metaPixelId);
  }, [metaPixelId]);
  useEffect(() => {
    if (tiktokPixelId) initTikTokPixel(tiktokPixelId);
  }, [tiktokPixelId]);
  useEffect(() => {
    if (ga4Id) initGA4(ga4Id);
  }, [ga4Id]);
  return null;
};

export default TrackingPixels;

// ── Helpers de eventos ──────────────────────────────────────────────
// Cada helper revisa que el pixel correspondiente esté disponible (no
// bloquea si el proveedor no lo configuró). Acepta valores opcionales.

interface ProductEventPayload {
  productId: string;
  productName: string;
  sku?: string;
  price?: number | null;
  currency?: string;
  category?: string | null;
}

interface CartEventPayload extends ProductEventPayload {
  qty: number;
}

interface PurchaseEventPayload {
  orderId: string | number;
  total: number;
  currency?: string;
  itemsCount?: number;
  coupon?: string | null;
}

const w = (typeof window !== "undefined" ? window : ({} as any)) as any;

export const trackViewContent = (p: ProductEventPayload) => {
  try {
    w.fbq?.("track", "ViewContent", {
      content_ids: [p.productId],
      content_name: p.productName,
      content_type: "product",
      value: p.price ?? undefined,
      currency: p.currency ?? "COP",
    });
    w.ttq?.track?.("ViewContent", {
      content_id: p.productId,
      content_name: p.productName,
      value: p.price ?? undefined,
      currency: p.currency ?? "COP",
    });
    w.gtag?.("event", "view_item", {
      currency: p.currency ?? "COP",
      value: p.price ?? undefined,
      items: [{ item_id: p.productId, item_name: p.productName, price: p.price ?? undefined }],
    });
  } catch {
    /* swallow */
  }
};

export const trackAddToCart = (p: CartEventPayload) => {
  try {
    const value = (p.price ?? 0) * p.qty;
    w.fbq?.("track", "AddToCart", {
      content_ids: [p.productId],
      content_name: p.productName,
      content_type: "product",
      value,
      currency: p.currency ?? "COP",
    });
    w.ttq?.track?.("AddToCart", {
      content_id: p.productId,
      content_name: p.productName,
      quantity: p.qty,
      value,
      currency: p.currency ?? "COP",
    });
    w.gtag?.("event", "add_to_cart", {
      currency: p.currency ?? "COP",
      value,
      items: [
        { item_id: p.productId, item_name: p.productName, quantity: p.qty, price: p.price ?? undefined },
      ],
    });
  } catch {
    /* swallow */
  }
};

export const trackInitiateCheckout = (total: number, itemsCount: number, currency = "COP") => {
  try {
    w.fbq?.("track", "InitiateCheckout", { value: total, currency, num_items: itemsCount });
    w.ttq?.track?.("InitiateCheckout", { value: total, currency });
    w.gtag?.("event", "begin_checkout", { currency, value: total });
  } catch {
    /* swallow */
  }
};

export const trackPurchase = (p: PurchaseEventPayload) => {
  try {
    const currency = p.currency ?? "COP";
    w.fbq?.("track", "Purchase", {
      value: p.total,
      currency,
      num_items: p.itemsCount,
      transaction_id: String(p.orderId),
    });
    w.ttq?.track?.("PlaceAnOrder", { value: p.total, currency });
    w.gtag?.("event", "purchase", {
      transaction_id: String(p.orderId),
      value: p.total,
      currency,
      coupon: p.coupon ?? undefined,
    });
  } catch {
    /* swallow */
  }
};

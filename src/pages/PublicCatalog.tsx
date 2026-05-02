import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Loader2,
  Phone,
  Printer,
  Package,
  Hash,
  MessageCircle,
  Search,
  ArrowLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  List,
  ShieldCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

// ── Types ─────────────────────────────────────────────────────────────
type Template = "minimal" | "professional" | "premium";

interface Provider {
  user_id: string;
  slug?: string;
  full_name?: string;
  store_name: string;
  phone: string | null;
  logo_url: string | null;
  avatar_url: string | null;
  description?: string | null;
  template?: Template;
  color_primary: string;
  color_secondary: string;
  mostrar_precios_catalogo?: boolean;
}

interface CatalogProduct {
  id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  stock_available: number;
  price: number | null;
  category?: string | null;
  short_id: string;
  description?: string | null;
  especificaciones?: string | null;
  garantia?: string | null;
}

const ALL_CATEGORIES = "__all__";

// ── Helpers ───────────────────────────────────────────────────────────
const buildWhatsAppLink = (
  phone: string | null,
  product: CatalogProduct,
  showPrices = true,
): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 7) return null;
  const intl = clean.length === 10 ? `57${clean}` : clean;
  const priceTxt = showPrices && product.price
    ? `Precio mayorista: ${formatCOP(product.price)}. `
    : "";
  const greeting = showPrices
    ? "Hola, vengo del catálogo y quiero hacer un pedido mayorista."
    : "Hola, vengo del catálogo y quisiera cotizar este producto.";
  const text = encodeURIComponent(
    `${greeting} Producto: ${product.product_name} (Ref: ${product.short_id}). ${priceTxt}` +
      `Stock visto: ${product.stock_available}.`,
  );
  return `https://wa.me/${intl}?text=${text}`;
};

// ── Page (router) ─────────────────────────────────────────────────────
const PublicCatalog = () => {
  const params = useParams<{ slug?: string; proveedorId?: string; productId?: string }>();
  const isLegacy = !!params.proveedorId;
  const isDetail = !!params.productId;

  if (isDetail && params.slug) {
    return <ProductDetailView slug={params.slug} productId={params.productId!} />;
  }

  return <CatalogListView slug={params.slug} legacyId={isLegacy ? params.proveedorId : undefined} />;
};

// ── List View ─────────────────────────────────────────────────────────
const CatalogListView = ({
  slug,
  legacyId,
}: {
  slug?: string;
  legacyId?: string;
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let payload: any = null;
        if (slug) {
          const { data, error } = await supabase.rpc(
            "get_public_provider_catalog_by_slug",
            { slug },
          );
          if (error) throw error;
          payload = data;
        } else if (legacyId) {
          const { data, error } = await supabase.rpc(
            "get_public_provider_catalog",
            { provider_id: legacyId },
          );
          if (error) throw error;
          payload = data;
        }
        if (cancelled) return;
        if (!payload?.found) {
          setError("Este catálogo no está disponible o el proveedor lo desactivó.");
          return;
        }
        setProvider(payload.provider ?? null);
        setProducts(payload.products ?? []);
        setCategories(payload.categories ?? []);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError("No se pudo cargar el catálogo. Intenta de nuevo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug, legacyId]);

  // SEO title
  useEffect(() => {
    if (provider?.store_name) {
      document.title = `Catálogo | ${provider.store_name}`;
    }
    return () => {
      document.title = "Logística";
    };
  }, [provider?.store_name]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== ALL_CATEGORIES && (p.category ?? "") !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.product_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.short_id.toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCategory]);

  const goToProduct = useCallback(
    (productId: string) => {
      if (!provider) return;
      const useSlug = provider.slug ?? slug;
      if (useSlug) {
        navigate(`/${useSlug}/catalogo/${productId}`);
      }
    },
    [navigate, provider, slug],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Package className="h-16 w-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Catálogo no disponible</h1>
        <p className="text-sm text-slate-500 max-w-md">{error}</p>
      </div>
    );
  }

  const colorPrimary = provider.color_primary;
  const colorSecondary = provider.color_secondary;
  const logo = provider.logo_url || provider.avatar_url;

  return (
    <div
      className="min-h-screen catalog-root"
      style={
        {
          backgroundColor: "#f8fafc",
          ["--catalog-primary" as string]: colorPrimary,
          ["--catalog-secondary" as string]: colorSecondary,
        } as React.CSSProperties
      }
    >
      <PrintStyles />

      {/* ── Sticky Header ──────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 shadow-md"
        style={{
          background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {logo ? (
              <img
                src={logo}
                alt={provider.store_name}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover bg-white p-1 shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/90 flex items-center justify-center shadow-lg flex-shrink-0">
                <Package className="h-6 w-6 text-slate-700" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black text-white truncate drop-shadow leading-tight">
                {provider.store_name}
              </h1>
              {provider.description && (
                <p className="text-[11px] sm:text-sm text-white/90 line-clamp-1 max-w-xl">
                  {provider.description}
                </p>
              )}
              {provider.phone && (
                <p className="text-[10px] sm:text-xs text-white/80 mt-0.5 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {provider.phone}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={() => window.print()}
            size="sm"
            className="no-print bg-white text-slate-900 hover:bg-white/90 font-semibold gap-2 shadow-lg flex-shrink-0"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="no-print bg-black/10 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto px-2 py-2 flex overflow-x-auto gap-2 scrollbar-hide">
              <CategoryChip
                label="Todos"
                active={activeCategory === ALL_CATEGORIES}
                onClick={() => setActiveCategory(ALL_CATEGORIES)}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={cat}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Search ───────────────────────────────────────────── */}
      <div className="no-print max-w-6xl mx-auto px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="pl-10 rounded-2xl bg-white shadow-sm"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2 px-1">
          {filtered.length} de {products.length} productos
        </p>
      </div>

      {/* ── Mobile-first 2-col grid ──────────────────────────── */}
      <main className="max-w-6xl mx-auto px-3 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No se encontraron productos.</p>
          </div>
        ) : (
          <div className="catalog-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                provider={provider}
                onClick={() => goToProduct(product.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-[11px] text-slate-500">
        Catálogo generado con <strong>Plus Envíos</strong>
      </footer>
    </div>
  );
};

// ── Category Chip ─────────────────────────────────────────────────────
const CategoryChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0",
      active
        ? "bg-white text-slate-900 shadow-md"
        : "bg-white/30 text-white hover:bg-white/50 backdrop-blur-sm",
    )}
  >
    {label}
  </button>
);

// ── Product Card (mobile-first) ───────────────────────────────────────
const ProductCard = ({
  product,
  provider,
  onClick,
}: {
  product: CatalogProduct;
  provider: Provider;
  onClick: () => void;
}) => {
  const lowStock = product.stock_available > 0 && product.stock_available < 5;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="product-card group cursor-pointer overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
    >
      <div className="relative w-full bg-slate-100 aspect-square overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Package className="h-10 w-10" />
          </div>
        )}
        <Badge
          className="absolute top-1.5 left-1.5 font-mono text-[9px] gap-1 shadow px-1.5 py-0.5"
          style={{ backgroundColor: "var(--catalog-primary)", color: "white" }}
        >
          <Hash className="h-2.5 w-2.5" />
          {product.short_id}
        </Badge>
        {lowStock && (
          <Badge variant="destructive" className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5">
            ¡{product.stock_available}!
          </Badge>
        )}
      </div>

      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.product_name}
        </h3>

        {product.price !== null && (
          <p
            className="text-lg font-black leading-none"
            style={{ color: "var(--catalog-primary)" }}
          >
            {formatCOP(product.price)}
          </p>
        )}

        <p className="text-[10px] text-slate-500 truncate">SKU: {product.sku}</p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="mt-auto w-full no-print py-2 rounded-xl font-bold text-xs text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--catalog-primary)" }}
        >
          Ver detalle
        </button>
      </div>
    </article>
  );
};

// ── Product Detail View (PDP) ─────────────────────────────────────────
const ProductDetailView = ({ slug, productId }: { slug: string; productId: string }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [related, setRelated] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc("get_public_product_detail", {
          slug,
          product_id: productId,
        });
        if (cancelled) return;
        if (error) throw error;
        const payload = data as any;
        if (!payload?.found) {
          setError("Este producto no está disponible.");
          return;
        }
        setProvider(payload.provider ?? null);
        setProduct(payload.product ?? null);
        setRelated(payload.related ?? []);
        setImgIdx(0);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError("No se pudo cargar el producto.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug, productId]);

  useEffect(() => {
    if (product?.product_name && provider?.store_name) {
      document.title = `${product.product_name} | ${provider.store_name}`;
    }
    return () => {
      document.title = "Logística";
    };
  }, [product?.product_name, provider?.store_name]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product || !provider) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Package className="h-16 w-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Producto no disponible</h1>
        <p className="text-sm text-slate-500 max-w-md">{error}</p>
        <Button onClick={() => navigate(`/${slug}/catalogo`)} className="mt-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo
        </Button>
      </div>
    );
  }

  const images = [product.image_url, product.image_url_2, product.image_url_3].filter(
    (s): s is string => !!s,
  );
  const hasMultiple = images.length > 1;
  const currentImg = images[imgIdx] ?? null;
  const colorPrimary = provider.color_primary;
  const colorSecondary = provider.color_secondary;
  const showPrices = provider.mostrar_precios_catalogo !== false;
  const waLink = buildWhatsAppLink(provider.phone, product, showPrices);
  const lowStock = product.stock_available > 0 && product.stock_available < 5;

  const downloadImage = async () => {
    if (!currentImg) return;
    try {
      const res = await fetch(currentImg);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${product.short_id}-${product.sku}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(currentImg, "_blank");
    }
  };

  return (
    <div
      className="min-h-screen pb-28 catalog-root bg-gray-50"
      style={
        {
          ["--catalog-primary" as string]: colorPrimary,
          ["--catalog-secondary" as string]: colorSecondary,
        } as React.CSSProperties
      }
    >
      <PrintStyles />

      {/* ── Top bar ───────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 shadow-md"
        style={{ background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})` }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/${slug}/catalogo`)}
            className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition"
            aria-label="Volver al catálogo"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/80 truncate">{provider.store_name}</p>
            <h1 className="text-sm font-bold text-white truncate">Detalle del producto</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto">
        {/* ── Full-bleed Image ───────────────────────────── */}
        <div className="relative w-full aspect-square bg-gray-100">
          {currentImg ? (
            <img
              src={currentImg}
              alt={product.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Package className="h-20 w-20" />
            </div>
          )}

          {hasMultiple && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === imgIdx ? "w-6 bg-white" : "w-1.5 bg-white/60",
                    )}
                    aria-label={`Imagen ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Floating download icon */}
          {currentImg && (
            <button
              onClick={downloadImage}
              aria-label="Descargar imagen"
              className="no-print absolute top-3 right-3 h-10 w-10 rounded-full bg-white/85 hover:bg-white backdrop-blur-sm flex items-center justify-center shadow-lg text-gray-800 transition"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <Badge
            className="absolute top-3 left-3 font-mono gap-1 shadow"
            style={{ backgroundColor: colorPrimary, color: "white" }}
          >
            <Hash className="h-3 w-3" />
            {product.short_id}
          </Badge>
          {lowStock && (
            <Badge variant="destructive" className="absolute bottom-3 right-3">
              ¡Últimas {product.stock_available}!
            </Badge>
          )}
        </div>

        {/* ── White content card overlapping image ───────── */}
        <section className="bg-white rounded-t-3xl shadow-lg mt-[-20px] relative z-10 p-6">
          {product.category && (
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1"
              style={{
                backgroundColor: `${colorPrimary}1A`,
                color: colorSecondary,
              }}
            >
              {product.category}
            </span>
          )}

          <h2 className="text-2xl font-black text-gray-900 leading-tight mt-2">
            {product.product_name}
          </h2>

          {showPrices && product.price !== null && (
            <div className="mt-2">
              <p
                className="text-3xl font-bold leading-none"
                style={{ color: colorPrimary }}
              >
                {formatCOP(product.price)}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mt-1">
                Precio Mayorista
              </p>
            </div>
          )}

          <div className="text-sm text-gray-500 mt-3 flex justify-between items-center">
            <span className="font-mono">SKU: {product.sku}</span>
            <span
              className={cn(
                "font-semibold",
                product.stock_available < 5 ? "text-amber-600" : "text-emerald-600",
              )}
            >
              Stock: {product.stock_available}
            </span>
          </div>

          {product.description && product.description.trim() && (
            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
                Descripción
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
        </section>

        {/* ── Related products ───────────────────────────── */}
        {related.length > 0 && (
          <section className="px-3 pt-6 pb-6">
            <h3 className="text-sm font-bold text-gray-700 px-1 mb-3">Más productos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  provider={provider}
                  onClick={() => navigate(`/${slug}/catalogo/${p.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Sticky CTA ─────────────────────────────────────── */}
      {waLink ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="no-print fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 shadow-2xl"
        >
          <div className="max-w-3xl mx-auto">
            <div
              className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white shadow-lg text-lg"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle className="h-5 w-5" />
              {showPrices ? "Hacer pedido mayorista" : "Cotizar este producto"}
            </div>
          </div>
        </a>
      ) : (
        <div className="no-print fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3">
          <p className="text-[11px] text-amber-600 text-center bg-amber-50 rounded-lg py-2">
            ⚠️ Proveedor sin teléfono configurado
          </p>
        </div>
      )}
    </div>
  );
};

// ── Print + scrollbar styles ──────────────────────────────────────────
const PrintStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; }
      .catalog-root { background: white !important; }
      .product-card {
        break-inside: avoid;
        page-break-inside: avoid;
        box-shadow: none !important;
        border: 1px solid #e2e8f0 !important;
      }
      .catalog-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }
      @page { size: A4; margin: 12mm; }
    }
  `}</style>
);

export default PublicCatalog;

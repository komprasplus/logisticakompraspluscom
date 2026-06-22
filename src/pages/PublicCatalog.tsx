import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  SlidersHorizontal,
  Lock,
  Tag,
  X,
  ZoomIn,
  Check,
  Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { useCart } from "@/hooks/useCart";
import PublicCartUI from "@/components/catalog/PublicCartUI";
import TrackingPixels, {
  trackAddToCart,
  trackViewContent,
} from "@/components/catalog/TrackingPixels";
import AIChatPanel from "@/components/catalog/AIChatPanel";

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
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  ga4_id?: string | null;
}

interface ProductVariant {
  id: string;
  variant_name: string;
  sku: string;
  attributes: Record<string, string> | null;
  stock_available: number;
  price: number | null;
  image_url: string | null;
}

interface CatalogProduct {
  id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  image_urls?: string[] | null;
  stock_available: number;
  price: number | null;
  category?: string | null;
  subcategory?: string | null;
  short_id: string;
  description?: string | null;
  description_md?: string | null;
  especificaciones?: string | null;
  garantia?: string | null;
  min_quantity?: number | null;
  unidades_vendidas?: number | null;
  created_at?: string | null;
  variants?: ProductVariant[] | null;
}

interface CategoryWithCount {
  category: string;
  count: number;
}

interface PriceListSummary {
  slug: string;
  nombre: string;
  descripcion: string | null;
  es_default: boolean;
  requires_code: boolean;
  moq_lista: number;
}

interface ActiveList {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  moq_lista: number;
  es_default: boolean;
  es_publica: boolean;
}

const ALL_CATEGORIES = "__all__";

// ── Session ID estable por visitante (para tracking de views) ─────────
const SESSION_KEY = "pls-catalog-session";
const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
};

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
  const params = useParams<{
    slug?: string;
    proveedorId?: string;
    productId?: string;
    listaSlug?: string;
  }>();
  const isLegacy = !!params.proveedorId;
  const isDetail = !!params.productId;

  if (isDetail && params.slug) {
    return <ProductDetailView slug={params.slug} productId={params.productId!} />;
  }

  return (
    <CatalogListView
      slug={params.slug}
      listaSlug={params.listaSlug}
      legacyId={isLegacy ? params.proveedorId : undefined}
    />
  );
};

// ── List View ─────────────────────────────────────────────────────────
type SortKey = "recent" | "price_asc" | "price_desc" | "stock_desc" | "best_sellers";

const CatalogListView = ({
  slug,
  listaSlug,
  legacyId,
}: {
  slug?: string;
  listaSlug?: string;
  legacyId?: string;
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Listas de precios (multi-lista) ─────────────────────────────────
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [activeList, setActiveList] = useState<ActiveList | null>(null);
  const [requiresCode, setRequiresCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Categorías con count autoritativo del backend (todo el catálogo, no filtrado).
  const [serverCategories, setServerCategories] = useState<CategoryWithCount[]>([]);

  // ── Filter & Sort state ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [priceRange, setPriceRange] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Cart ──────────────────────────────────────────────────────────────
  const cart = useCart(slug, listaSlug ?? null);

  const handleQuickAdd = useCallback(
    (p: CatalogProduct) => {
      if (p.price === null || p.stock_available <= 0) return;
      cart.add({
        productId: p.id,
        variantId: null,
        productName: p.product_name,
        variantName: null,
        sku: p.sku,
        unitPrice: p.price,
        imageUrl: p.image_url ?? null,
        stockAtAdd: p.stock_available,
        minQuantity: p.min_quantity ?? 1,
      });
      trackAddToCart({
        productId: p.id,
        productName: p.product_name,
        sku: p.sku,
        price: p.price,
        category: p.category ?? null,
        qty: 1,
      });
      toast.success(`${p.product_name} agregado al carrito`, { duration: 1500 });
    },
    [cart],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let payload: any = null;
        if (slug) {
          const { data, error } = await (supabase.rpc as any)(
            "get_public_provider_catalog_v2",
            {
              p_slug: slug,
              p_lista_slug: listaSlug ?? null,
              p_codigo_acceso: appliedCode ?? null,
            },
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
        // Gate de código de acceso para listas privadas.
        if (payload.requires_code) {
          setRequiresCode(true);
          if (appliedCode) {
            setCodeError("Código incorrecto. Verifica con el proveedor.");
          }
          setProvider(null);
          setProducts([]);
          setPriceLists([]);
          setActiveList(null);
          return;
        }
        setRequiresCode(false);
        setCodeError(null);
        setProvider(payload.provider ?? null);
        setProducts(payload.products ?? []);
        setPriceLists(payload.price_lists ?? []);
        setActiveList(payload.active_list ?? null);
        // Categorías con count (RPC v2 los devuelve como objetos; legacy = strings).
        const rawCats: any = payload.categories ?? [];
        if (Array.isArray(rawCats) && rawCats.length > 0 && typeof rawCats[0] === "object") {
          setServerCategories(rawCats as CategoryWithCount[]);
        } else if (Array.isArray(rawCats)) {
          setServerCategories(
            (rawCats as string[]).map((c) => ({ category: c, count: 0 })),
          );
        } else {
          setServerCategories([]);
        }
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
  }, [slug, listaSlug, appliedCode, legacyId]);

  useEffect(() => {
    if (provider?.store_name) {
      document.title = `Catálogo | ${provider.store_name}`;
    }
    return () => {
      document.title = "Logística";
    };
  }, [provider?.store_name]);

  // ── Derived: categorías para el panel (server autoritativo, fallback a derivado) ─
  const availableCategories = useMemo((): CategoryWithCount[] => {
    if (serverCategories.length > 0) return serverCategories;
    const map = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category?.trim();
      if (cat) map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }, [serverCategories, products]);

  // Top 5 productos más vendidos del catálogo (con unidades_vendidas > 0).
  const topSellerIds = useMemo(() => {
    return new Set(
      [...products]
        .filter((p) => Number(p.unidades_vendidas ?? 0) > 0)
        .sort(
          (a, b) =>
            Number(b.unidades_vendidas ?? 0) - Number(a.unidades_vendidas ?? 0),
        )
        .slice(0, 5)
        .map((p) => p.id),
    );
  }, [products]);

  const NEW_PRODUCT_DAYS = 30;
  const isNewProduct = useCallback((p: CatalogProduct): boolean => {
    if (!p.created_at) return false;
    const created = new Date(p.created_at).getTime();
    if (!Number.isFinite(created)) return false;
    const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return days <= NEW_PRODUCT_DAYS;
  }, []);

  // ── Derived: filtered + sorted products ──────────────────────────────
  const filteredAndSortedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      // 1. Text search
      if (q) {
        const hay =
          p.product_name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.short_id.toLowerCase().includes(q);
        if (!hay) return false;
      }
      // 2. Categories (multi)
      if (selectedCategories.length > 0) {
        if (!p.category || !selectedCategories.includes(p.category)) return false;
      }
      // 3. Price range
      const price = p.price ?? 0;
      if (priceRange.min !== null && price < priceRange.min) return false;
      if (priceRange.max !== null && price > priceRange.max) return false;
      // 4. Stock
      if (inStockOnly && p.stock_available <= 0) return false;
      return true;
    });

    // 5. Sort
    list = [...list];
    switch (sortBy) {
      case "price_asc":
        list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case "price_desc":
        list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "stock_desc":
        list.sort((a, b) => b.stock_available - a.stock_available);
        break;
      case "best_sellers":
        // Mock: until we have a sales column, fallback to lowest stock (most rotated)
        list.sort((a, b) => a.stock_available - b.stock_available);
        break;
      case "recent":
      default:
        // Preserve API order (assumed recent-first)
        break;
    }
    return list;
  }, [products, searchQuery, selectedCategories, priceRange, inStockOnly, sortBy]);

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

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const applyPriceRange = () => {
    const min = priceMinInput.trim() ? Number(priceMinInput.replace(/\D/g, "")) : null;
    const max = priceMaxInput.trim() ? Number(priceMaxInput.replace(/\D/g, "")) : null;
    setPriceRange({
      min: min !== null && !isNaN(min) ? min : null,
      max: max !== null && !isNaN(max) ? max : null,
    });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setPriceMinInput("");
    setPriceMaxInput("");
    setPriceRange({ min: null, max: null });
    setInStockOnly(false);
  };

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    selectedCategories.length +
    (priceRange.min !== null || priceRange.max !== null ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (requiresCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 sm:p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-pink/10 text-pink flex items-center justify-center mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Catálogo privado</h1>
          <p className="mt-1 text-sm text-slate-600">
            Esta lista de precios requiere un código de acceso. Pídelo al
            proveedor.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim()) setAppliedCode(codeInput.trim());
            }}
          >
            <Input
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Código de acceso"
              className="text-center font-mono tracking-wider"
            />
            {codeError && (
              <p className="text-xs text-pink font-medium">{codeError}</p>
            )}
            <Button
              type="submit"
              disabled={!codeInput.trim()}
              className="w-full"
            >
              Acceder al catálogo
            </Button>
          </form>
        </div>
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

  // ── Filters Panel (shared between desktop sidebar & mobile sheet) ────
  const FiltersPanel = (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">
          Buscar
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre, SKU, REF..."
            className="pl-10 rounded-xl bg-white"
          />
        </div>
      </div>

      {/* Categories */}
      {availableCategories.length > 0 && (
        <div>
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">
            Categorías
          </Label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {availableCategories.map(({ category: cat, count }) => {
              const checked = selectedCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 hover:text-slate-900"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  <span className="flex-1 truncate">{cat}</span>
                  {count > 0 && (
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {count}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Price */}
      <div>
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">
          Precio (COP)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Mín"
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
            className="rounded-xl bg-white text-sm"
          />
          <span className="text-slate-400">-</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Máx"
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
            className="rounded-xl bg-white text-sm"
          />
        </div>
        <Button
          onClick={applyPriceRange}
          size="sm"
          variant="outline"
          className="w-full mt-2 rounded-xl"
        >
          Aplicar precio
        </Button>
      </div>

      {/* Stock */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
        <Label htmlFor="instock-toggle" className="text-sm font-medium text-slate-700 cursor-pointer">
          Ocultar agotados
        </Label>
        <Switch
          id="instock-toggle"
          checked={inStockOnly}
          onCheckedChange={setInStockOnly}
        />
      </div>

      {activeFilterCount > 0 && (
        <Button
          onClick={clearAllFilters}
          variant="ghost"
          size="sm"
          className="w-full text-slate-600"
        >
          <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros ({activeFilterCount})
        </Button>
      )}
    </div>
  );

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
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
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
              {activeList && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Tag className="h-3 w-3" />
                  {activeList.nombre}
                  {activeList.moq_lista > 1 && (
                    <span className="text-white/70 font-normal">
                      · MOQ {activeList.moq_lista}
                    </span>
                  )}
                </div>
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
      </header>

      {/* ── Main Layout: Sidebar + Grid ───────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-3 md:px-6 py-6">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="no-print hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-28 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </h2>
              {FiltersPanel}
            </div>
          </aside>

          {/* Right column: toolbar + grid */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="no-print flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                {/* Mobile filters trigger */}
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="md:hidden rounded-xl gap-2 bg-white"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtros
                      {activeFilterCount > 0 && (
                        <Badge
                          className="ml-1 h-5 min-w-5 px-1.5 text-[10px]"
                          style={{ backgroundColor: colorPrimary, color: "white" }}
                        >
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] sm:w-96 overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        Filtros y Ordenar
                      </SheetTitle>
                    </SheetHeader>
                    {FiltersPanel}
                    <div className="mt-6">
                      <Button
                        onClick={() => setFiltersOpen(false)}
                        className="w-full rounded-xl"
                        style={{ backgroundColor: colorPrimary, color: "white" }}
                      >
                        Ver {filteredAndSortedProducts.length} productos
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <p className="text-sm text-slate-600">
                  Mostrando <strong className="text-slate-900">{filteredAndSortedProducts.length}</strong>{" "}
                  <span className="hidden sm:inline">de {products.length} </span>productos
                </p>

                <button
                  type="button"
                  onClick={() => setInStockOnly((v) => !v)}
                  className={cn(
                    "no-print hidden sm:inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors",
                    inStockOnly
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-600",
                  )}
                >
                  ✅ Disponibles ahora
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {priceLists.length > 1 && (
                  <Select
                    value={activeList?.slug ?? ""}
                    onValueChange={(v) => {
                      if (!slug || !v) return;
                      const target = priceLists.find((l) => l.slug === v);
                      // Reset código si cambias a otra lista
                      if (target && target.requires_code) {
                        setAppliedCode(null);
                        setCodeInput("");
                      }
                      navigate(`/${slug}/catalogo/lista/${v}`);
                    }}
                  >
                    <SelectTrigger className="w-[200px] rounded-xl bg-white text-sm">
                      <Tag className="h-3.5 w-3.5 text-slate-500 mr-1" />
                      <SelectValue placeholder="Ver precios..." />
                    </SelectTrigger>
                    <SelectContent>
                      {priceLists.map((l) => (
                        <SelectItem key={l.slug} value={l.slug}>
                          {l.nombre}
                          {l.es_default && " · Default"}
                          {l.requires_code && " · 🔒"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="w-[200px] rounded-xl bg-white text-sm">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Más Recientes</SelectItem>
                    <SelectItem value="price_asc">Precio: Menor a Mayor</SelectItem>
                    <SelectItem value="price_desc">Precio: Mayor a Menor</SelectItem>
                    <SelectItem value="stock_desc">Mayor Stock</SelectItem>
                    <SelectItem value="best_sellers">Más Vendidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chips de filtros activos */}
            {activeFilterCount > 0 && (
              <div className="no-print flex flex-wrap items-center gap-1.5 mb-4">
                <span className="text-[11px] text-slate-500 mr-1">Filtros:</span>
                {searchQuery && (
                  <FilterChip
                    label={`"${searchQuery}"`}
                    onRemove={() => setSearchQuery("")}
                  />
                )}
                {selectedCategories.map((cat) => (
                  <FilterChip
                    key={cat}
                    label={cat}
                    onRemove={() => toggleCategory(cat)}
                  />
                ))}
                {(priceRange.min !== null || priceRange.max !== null) && (
                  <FilterChip
                    label={`${priceRange.min !== null ? formatCOP(priceRange.min) : "$0"} – ${priceRange.max !== null ? formatCOP(priceRange.max) : "∞"}`}
                    onRemove={() => {
                      setPriceMinInput("");
                      setPriceMaxInput("");
                      setPriceRange({ min: null, max: null });
                    }}
                  />
                )}
                {inStockOnly && (
                  <FilterChip
                    label="Disponibles ahora"
                    onRemove={() => setInStockOnly(false)}
                  />
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1"
                >
                  Limpiar todo
                </button>
              </div>
            )}

            {/* Grid */}
            {filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No se encontraron productos</p>
                <p className="text-xs text-slate-400 mt-1">Ajusta los filtros para ver más resultados.</p>
                {activeFilterCount > 0 && (
                  <Button
                    onClick={clearAllFilters}
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="catalog-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start">
                {filteredAndSortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    provider={provider}
                    isNew={isNewProduct(product)}
                    isTopSeller={topSellerIds.has(product.id)}
                    onClick={() => goToProduct(product.id)}
                    onQuickAdd={() => handleQuickAdd(product)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-[11px] text-slate-500">
        Catálogo generado con <strong>Plus Envíos</strong>
      </footer>

      <PublicCartUI
        slug={slug ?? ""}
        listaSlug={listaSlug ?? null}
        codigoAcceso={appliedCode}
        items={cart.items}
        total={cart.total}
        count={cart.count}
        updateQty={cart.updateQty}
        remove={cart.remove}
        clear={cart.clear}
        colorPrimary={colorPrimary}
        colorSecondary={colorSecondary}
        storeName={provider.store_name}
      />

      <TrackingPixels
        metaPixelId={provider.meta_pixel_id ?? null}
        tiktokPixelId={provider.tiktok_pixel_id ?? null}
        ga4Id={provider.ga4_id ?? null}
      />

      <AIChatPanel
        slug={slug ?? ""}
        listaSlug={listaSlug ?? null}
        codigoAcceso={appliedCode}
        colorPrimary={colorPrimary}
        colorSecondary={colorSecondary}
        storeName={provider.store_name}
      />
    </div>
  );
};


// ── Filter Chip ───────────────────────────────────────────────────────
const FilterChip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition-colors">
    <span className="max-w-[180px] truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      className="rounded-full p-0.5 hover:bg-slate-300/70"
      aria-label={`Quitar filtro ${label}`}
    >
      <X className="h-2.5 w-2.5" />
    </button>
  </span>
);

// ── Product Card (mobile-first) ───────────────────────────────────────
const ProductCard = ({
  product,
  provider,
  onClick,
  onQuickAdd,
  isNew = false,
  isTopSeller = false,
}: {
  product: CatalogProduct;
  provider: Provider;
  onClick: () => void;
  onQuickAdd?: () => void;
  isNew?: boolean;
  isTopSeller?: boolean;
}) => {
  const lowStock = product.stock_available > 0 && product.stock_available < 5;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const canQuickAdd = !!onQuickAdd && !hasVariants && product.stock_available > 0 && product.price !== null;

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
        <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
          {isTopSeller && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0 text-[9px] px-1.5 py-0.5 font-bold gap-0.5">
              🔥 Más vendido
            </Badge>
          )}
          {isNew && !isTopSeller && (
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0 text-[9px] px-1.5 py-0.5 font-bold">
              Nuevo
            </Badge>
          )}
          {lowStock && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5">
              ¡{product.stock_available}!
            </Badge>
          )}
        </div>
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

        <div className="mt-auto no-print flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              "py-2 rounded-xl font-bold text-xs shadow-sm transition-opacity",
              canQuickAdd
                ? "flex-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "w-full text-white hover:opacity-90",
            )}
            style={!canQuickAdd ? { backgroundColor: "var(--catalog-primary)" } : undefined}
          >
            {hasVariants ? "Elegir opciones →" : "Ver detalle"}
          </button>
          {canQuickAdd && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd!();
              }}
              className="px-3 py-2 rounded-xl font-bold text-xs text-white shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1"
              style={{ backgroundColor: "var(--catalog-primary)" }}
              aria-label="Agregar al carrito"
            >
              <span className="text-base leading-none">+</span> Agregar
            </button>
          )}
        </div>
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
  const [recommendations, setRecommendations] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const cart = useCart(slug, null);

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

  // Track ViewContent una vez cuando el producto + pixels están listos
  useEffect(() => {
    if (!product || !provider) return;
    // Pequeño delay para que los pixels alcancen a inyectarse
    const t = setTimeout(() => {
      trackViewContent({
        productId: product.id,
        productName: product.product_name,
        sku: product.sku,
        price: product.price ?? null,
        category: product.category ?? null,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [product?.id, provider?.user_id]);

  // Track product view (analytics interno para recomendaciones) + cargar recomendaciones
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    (async () => {
      try {
        await (supabase.rpc as any)("track_product_view", {
          p_slug: slug,
          p_product_id: product.id,
          p_session_id: getOrCreateSessionId(),
        });
      } catch {
        /* ignore */
      }
      try {
        const { data } = await (supabase.rpc as any)("get_product_recommendations", {
          p_slug: slug,
          p_product_id: product.id,
          p_limit: 6,
        });
        if (cancelled) return;
        setRecommendations(Array.isArray(data) ? (data as CatalogProduct[]) : []);
      } catch {
        if (!cancelled) setRecommendations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, slug]);

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

  const images = (() => {
    const fromArray = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
    if (fromArray.length > 0) return fromArray as string[];
    return [product.image_url, product.image_url_2, product.image_url_3].filter(
      (s): s is string => !!s,
    );
  })();
  const hasMultiple = images.length > 1;
  const currentImg = images[imgIdx] ?? null;
  const colorPrimary = provider.color_primary;
  const colorSecondary = provider.color_secondary;
  const showPrices = provider.mostrar_precios_catalogo !== false;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;
  const selectedVariant = hasVariants
    ? variants.find((v) => v.id === selectedVariantId) ?? null
    : null;
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveStock = selectedVariant?.stock_available ?? product.stock_available;
  const variantTextForWA = selectedVariant
    ? ` Variante: ${selectedVariant.variant_name} (SKU ${selectedVariant.sku}).`
    : "";
  const waLink = buildWhatsAppLink(
    provider.phone,
    { ...product, price: effectivePrice, stock_available: effectiveStock } as CatalogProduct,
    showPrices,
  );
  const waLinkFinal = waLink ? `${waLink}${encodeURIComponent(variantTextForWA)}` : null;
  const lowStock = effectiveStock > 0 && effectiveStock < 5;
  const description = product.description_md?.trim() || product.description?.trim() || "";

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
        {/* ── Full-bleed Image (clickeable para abrir lightbox) ─────── */}
        <div className="relative w-full aspect-square bg-gray-100 group">
          {currentImg ? (
            <img
              src={currentImg}
              alt={product.product_name}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
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
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-full">
                <span className="text-[10px] font-bold text-white tabular-nums">
                  {imgIdx + 1} / {images.length}
                </span>
              </div>
            </>
          )}

          {/* Lightbox + Download icons */}
          {currentImg && (
            <div className="no-print absolute top-3 right-3 flex flex-col gap-2">
              <button
                onClick={() => setLightboxOpen(true)}
                aria-label="Ampliar imagen"
                className="h-10 w-10 rounded-full bg-white/85 hover:bg-white backdrop-blur-sm flex items-center justify-center shadow-lg text-gray-800 transition"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={downloadImage}
                aria-label="Descargar imagen"
                className="h-10 w-10 rounded-full bg-white/85 hover:bg-white backdrop-blur-sm flex items-center justify-center shadow-lg text-gray-800 transition"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
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
              ¡Últimas {effectiveStock}!
            </Badge>
          )}
        </div>

        {/* ── Strip de miniaturas (hasta 20 imágenes) ───────── */}
        {hasMultiple && (
          <div className="bg-white px-3 py-2 border-b border-gray-100">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={cn(
                    "flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all",
                    i === imgIdx
                      ? "border-primary shadow-sm scale-105"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                  style={i === imgIdx ? { borderColor: colorPrimary } : undefined}
                  aria-label={`Ver imagen ${i + 1}`}
                >
                  <img src={url} alt={`Miniatura ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Lightbox modal ─────────────────────────────── */}
        {lightboxOpen && currentImg && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 no-print"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={currentImg}
              alt={product.product_name}
              className="max-h-[88vh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx((i) => (i - 1 + images.length) % images.length);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx((i) => (i + 1) % images.length);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-mono">
                  {imgIdx + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── White content card overlapping image ───────── */}
        <section className="bg-white rounded-t-3xl shadow-lg mt-[-20px] relative z-10 p-6">
          {(product.category || product.subcategory) && (
            <div className="flex items-center gap-1.5 flex-wrap">
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
              {product.subcategory && (
                <span className="inline-block text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 bg-slate-100 text-slate-600">
                  {product.subcategory}
                </span>
              )}
            </div>
          )}

          <h2 className="text-2xl font-black text-gray-900 leading-tight mt-2">
            {product.product_name}
          </h2>

          {showPrices && effectivePrice !== null && (
            <div className="mt-2">
              <p
                className="text-3xl font-bold leading-none"
                style={{ color: colorPrimary }}
              >
                {formatCOP(effectivePrice)}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mt-1">
                {selectedVariant ? "Precio de la variante" : "Precio Mayorista"}
              </p>
            </div>
          )}

          <div className="text-sm text-gray-500 mt-3 flex justify-between items-center">
            <span className="font-mono">SKU: {selectedVariant?.sku ?? product.sku}</span>
            <span
              className={cn(
                "font-semibold",
                effectiveStock < 5 ? "text-amber-600" : "text-emerald-600",
              )}
            >
              Stock: {effectiveStock}
            </span>
          </div>

          {/* ── Selector de variantes (talla/color/marca/etc.) ────── */}
          {hasVariants && (() => {
            // Agrupar variantes por atributo: { Color: [Rojo, Azul], Talla: [M, L] }
            const attrGroups: Record<string, Set<string>> = {};
            variants.forEach((v) => {
              if (v.attributes && typeof v.attributes === "object") {
                Object.entries(v.attributes).forEach(([k, val]) => {
                  if (!attrGroups[k]) attrGroups[k] = new Set();
                  attrGroups[k].add(String(val));
                });
              }
            });
            const attrKeys = Object.keys(attrGroups);

            // Si no hay atributos estructurados, mostrar lista plana
            if (attrKeys.length === 0) {
              return (
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                    Variantes disponibles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id === selectedVariantId ? null : v.id)}
                        disabled={v.stock_available <= 0}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                          selectedVariantId === v.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 hover:border-slate-300 text-slate-700",
                          v.stock_available <= 0 && "opacity-40 cursor-not-allowed line-through",
                        )}
                        style={
                          selectedVariantId === v.id
                            ? { borderColor: colorPrimary, color: colorPrimary, backgroundColor: `${colorPrimary}15` }
                            : undefined
                        }
                      >
                        {v.variant_name}
                        {v.stock_available > 0 && v.stock_available < 5 && (
                          <span className="ml-1 text-[9px] text-amber-600">· {v.stock_available} ud</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            // Selector agrupado por atributo
            return (
              <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
                {attrKeys.map((attrKey) => {
                  const values = Array.from(attrGroups[attrKey]);
                  // Estimar la selección actual del attr basado en selectedVariant
                  const currentVal = selectedVariant?.attributes?.[attrKey] ?? null;
                  return (
                    <div key={attrKey}>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                        {attrKey}
                        {currentVal && (
                          <span className="ml-2 font-normal normal-case text-slate-500">
                            {currentVal}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {values.map((val) => {
                          // Encontrar la variante que matchea: usa este val para attrKey y mantiene los demás attrs ya seleccionados
                          const candidate = variants.find((v) => {
                            if (!v.attributes) return false;
                            if (v.attributes[attrKey] !== val) return false;
                            // Si ya hay selectedVariant, intentar mantener sus otros attrs
                            if (selectedVariant && selectedVariant.attributes) {
                              for (const [k, vv] of Object.entries(selectedVariant.attributes)) {
                                if (k !== attrKey && v.attributes[k] !== vv) return false;
                              }
                            }
                            return true;
                          }) ?? variants.find((v) => v.attributes?.[attrKey] === val);
                          const isSelected = currentVal === val;
                          const outOfStock = candidate && candidate.stock_available <= 0;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => candidate && setSelectedVariantId(candidate.id)}
                              disabled={!candidate || outOfStock}
                              className={cn(
                                "px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all min-w-[40px]",
                                isSelected
                                  ? "border-primary text-primary"
                                  : "border-slate-200 hover:border-slate-300 text-slate-700",
                                outOfStock && "opacity-40 cursor-not-allowed line-through",
                              )}
                              style={
                                isSelected
                                  ? { borderColor: colorPrimary, color: colorPrimary, backgroundColor: `${colorPrimary}15` }
                                  : undefined
                              }
                            >
                              {isSelected && <Check className="inline h-3 w-3 mr-1" />}
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {!selectedVariant && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                    Elige una opción para ver el precio y stock final.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ── Descripción (Markdown) + acordeón ────────────────── */}
          {(() => {
            const items: { key: string; title: string; icon: JSX.Element; content: string; isMd?: boolean }[] = [];
            if (description) {
              items.push({
                key: "desc",
                title: "Descripción",
                icon: <FileText className="h-4 w-4" />,
                content: description,
                isMd: true,
              });
            }
            if (product.especificaciones && product.especificaciones.trim()) {
              items.push({
                key: "specs",
                title: "Especificaciones",
                icon: <List className="h-4 w-4" />,
                content: product.especificaciones,
              });
            }
            if (product.garantia && product.garantia.trim()) {
              items.push({
                key: "warranty",
                title: "Garantía",
                icon: <ShieldCheck className="h-4 w-4" />,
                content: product.garantia,
              });
            }
            if (items.length === 0) return null;
            return (
              <div className="mt-4">
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={items[0].key}
                  className="w-full"
                >
                  {items.map((it) => (
                    <AccordionItem
                      key={it.key}
                      value={it.key}
                      className="border-b border-gray-200"
                    >
                      <AccordionTrigger className="text-slate-800 font-medium text-sm hover:no-underline">
                        <span className="flex items-center gap-2">
                          {it.icon}
                          {it.title}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {it.isMd ? (
                          <div className="prose prose-sm prose-neutral max-w-none px-4 pb-2 pt-1 text-gray-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-line text-sm text-gray-600 p-4 pt-2">
                            {it.content}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })()}
        </section>

        {/* ── Recomendaciones IA ───────────────────────────── */}
        {recommendations.length > 0 && (
          <section className="px-3 pt-6 pb-2">
            <h3 className="text-sm font-bold text-gray-700 px-1 mb-3 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" style={{ color: colorPrimary }} /> Te puede interesar
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recommendations.map((p) => (
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

      {/* ── Sticky CTA: Agregar al carrito + WhatsApp ─────────────── */}
      <div className="no-print fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {effectivePrice !== null && effectiveStock > 0 && (hasVariants ? selectedVariant : true) && (
            <button
              type="button"
              onClick={() => {
                cart.add({
                  productId: product.id,
                  variantId: selectedVariant?.id ?? null,
                  productName: product.product_name,
                  variantName: selectedVariant?.variant_name ?? null,
                  sku: selectedVariant?.sku ?? product.sku,
                  unitPrice: effectivePrice!,
                  imageUrl: currentImg ?? product.image_url ?? null,
                  stockAtAdd: effectiveStock,
                  minQuantity: product.min_quantity ?? 1,
                });
                trackAddToCart({
                  productId: product.id,
                  productName: product.product_name,
                  sku: selectedVariant?.sku ?? product.sku,
                  price: effectivePrice,
                  category: product.category ?? null,
                  qty: 1,
                });
                toast.success(`${product.product_name} agregado al carrito`, { duration: 1500 });
              }}
              className="flex-1 py-4 rounded-xl font-bold text-white shadow-lg text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})` }}
            >
              + Agregar al carrito
            </button>
          )}
          {waLinkFinal ? (
            <a
              href={waLinkFinal}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "py-4 rounded-xl font-bold text-white shadow-lg text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity",
                effectivePrice !== null && effectiveStock > 0 && (hasVariants ? selectedVariant : true)
                  ? "px-4"
                  : "flex-1",
              )}
              style={{ backgroundColor: "#25D366" }}
              aria-label="Pedir por WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
              {effectivePrice !== null && effectiveStock > 0 && (hasVariants ? selectedVariant : true)
                ? null
                : hasVariants && !selectedVariant
                  ? "Elige una opción"
                  : showPrices
                    ? "Hacer pedido mayorista"
                    : "Cotizar"}
            </a>
          ) : (
            <p className="flex-1 text-[11px] text-amber-600 text-center bg-amber-50 rounded-lg py-2">
              ⚠️ Sin teléfono configurado
            </p>
          )}
        </div>
      </div>

      <PublicCartUI
        slug={slug}
        listaSlug={null}
        codigoAcceso={null}
        items={cart.items}
        total={cart.total}
        count={cart.count}
        updateQty={cart.updateQty}
        remove={cart.remove}
        clear={cart.clear}
        colorPrimary={colorPrimary}
        colorSecondary={colorSecondary}
        storeName={provider.store_name}
      />

      <TrackingPixels
        metaPixelId={provider.meta_pixel_id ?? null}
        tiktokPixelId={provider.tiktok_pixel_id ?? null}
        ga4Id={provider.ga4_id ?? null}
      />

      <AIChatPanel
        slug={slug}
        listaSlug={null}
        codigoAcceso={null}
        colorPrimary={colorPrimary}
        colorSecondary={colorSecondary}
        storeName={provider.store_name}
      />
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

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
  SlidersHorizontal,
  Lock,
  Tag,
  X,
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
  min_quantity?: number | null;
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

  // ── Derived: dynamic categories from loaded products ─────────────────
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

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
            {availableCategories.map((cat) => {
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
                  <span className="flex-1">{cat}</span>
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
                    onClick={() => goToProduct(product.id)}
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
    </div>
  );
};


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

          {(() => {
            const items: { key: string; title: string; icon: JSX.Element; content: string }[] = [];
            if (product.description && product.description.trim()) {
              items.push({
                key: "desc",
                title: "Descripción",
                icon: <FileText className="h-4 w-4" />,
                content: product.description,
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
                        <div className="whitespace-pre-line text-sm text-gray-600 p-4 pt-2">
                          {it.content}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })()}
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

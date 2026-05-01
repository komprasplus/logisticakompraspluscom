import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Phone, Printer, Package, Hash, MessageCircle, Search } from "lucide-react";
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
  full_name: string;
  store_name: string;
  phone: string | null;
  logo_url: string | null;
  avatar_url: string | null;
  description: string | null;
  template: Template;
  color_primary: string;
  color_secondary: string;
}

interface CatalogProduct {
  id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  stock_available: number;
  price: number | null;
  short_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────
const buildWhatsAppLink = (
  phone: string | null,
  product: CatalogProduct,
): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 7) return null;
  // Default to Colombia (+57) if user only saved 10 digits
  const intl = clean.length === 10 ? `57${clean}` : clean;
  const text = encodeURIComponent(
    `Hola, vengo del catálogo. Me interesa el producto ${product.product_name} ` +
      `(Ref: ${product.short_id}). Precio: ${
        product.price ? formatCOP(product.price) : "a confirmar"
      }. ¿Cuántas unidades te quedan de las ${product.stock_available} que vi disponibles?`,
  );
  return `https://wa.me/${intl}?text=${text}`;
};

// ── Page ──────────────────────────────────────────────────────────────
const PublicCatalog = () => {
  const { proveedorId } = useParams<{ proveedorId: string }>();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!proveedorId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc(
          "get_public_provider_catalog",
          { provider_id: proveedorId },
        );
        if (cancelled) return;
        if (error) throw error;

        const payload = data as {
          found: boolean;
          provider?: Provider;
          products?: CatalogProduct[];
        };

        if (!payload?.found) {
          setError("Este catálogo no está disponible o el proveedor lo desactivó.");
          return;
        }

        setProvider(payload.provider ?? null);
        setProducts(payload.products ?? []);
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
  }, [proveedorId]);

  // Update document title for SEO when provider loads
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
    if (!q) return products;
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.short_id.toLowerCase().includes(q),
    );
  }, [products, search]);

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
        <h1 className="text-xl font-bold text-slate-700 mb-2">
          Catálogo no disponible
        </h1>
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
      {/* Print styles inlined for portability */}
      <style>{`
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

      {/* ── Header ───────────────────────────────────────────── */}
      <header
        className="border-b shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt={provider.store_name}
                className="h-16 w-16 rounded-2xl object-cover bg-white p-1 shadow-lg"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-white/90 flex items-center justify-center shadow-lg">
                <Package className="h-8 w-8 text-slate-700" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-white truncate drop-shadow">
                {provider.store_name}
              </h1>
              {provider.description && (
                <p className="text-sm text-white/90 mt-0.5 line-clamp-2 max-w-xl">
                  {provider.description}
                </p>
              )}
              {provider.phone && (
                <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {provider.phone}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={() => window.print()}
            className="no-print bg-white text-slate-900 hover:bg-white/90 font-semibold gap-2 shadow-lg"
          >
            <Printer className="h-4 w-4" />
            Descargar PDF
          </Button>
        </div>
      </header>

      {/* ── Search ───────────────────────────────────────────── */}
      <div className="no-print max-w-6xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto por nombre, SKU o referencia..."
            className="pl-10"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {filtered.length} de {products.length} productos
        </p>
      </div>

      {/* ── Catalog grid ─────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No se encontraron productos.</p>
          </div>
        ) : (
          <div
            className={cn(
              "catalog-grid grid gap-4",
              provider.template === "minimal" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              provider.template === "professional" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              provider.template === "premium" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                template={provider.template}
                provider={provider}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Catálogo generado con <strong>Plus Envíos</strong>
      </footer>
    </div>
  );
};

// ── ProductCard (template-aware) ──────────────────────────────────────
const ProductCard = ({
  product,
  template,
  provider,
}: {
  product: CatalogProduct;
  template: Template;
  provider: Provider;
}) => {
  const waLink = buildWhatsAppLink(provider.phone, product);
  const lowStock = product.stock_available > 0 && product.stock_available < 5;

  // Variant containers per template
  const cardClass = cn(
    "product-card overflow-hidden bg-white transition-shadow",
    template === "minimal" && "border border-slate-200 rounded-lg hover:shadow-md",
    template === "professional" && "border-2 border-slate-300 rounded-xl hover:shadow-lg",
    template === "premium" && "rounded-3xl shadow-lg hover:shadow-2xl border border-slate-100",
  );

  return (
    <article className={cardClass}>
      {/* Image */}
      <div
        className={cn(
          "relative w-full bg-slate-100",
          template === "premium" ? "aspect-square" : "aspect-[4/3]",
        )}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Package className="h-12 w-12" />
          </div>
        )}
        <Badge
          className="absolute top-2 left-2 font-mono text-[10px] gap-1 shadow"
          style={{ backgroundColor: "var(--catalog-primary)", color: "white" }}
        >
          <Hash className="h-3 w-3" />
          {product.short_id}
        </Badge>
        {lowStock && (
          <Badge variant="destructive" className="absolute top-2 right-2 text-[10px]">
            ¡Últimas {product.stock_available}!
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className={cn("p-4 space-y-2", template === "premium" && "p-5 space-y-3")}>
        <h3
          className={cn(
            "font-bold text-slate-900 line-clamp-2 leading-tight",
            template === "minimal" && "text-sm",
            template === "professional" && "text-base",
            template === "premium" && "text-lg",
          )}
        >
          {product.product_name}
        </h3>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono truncate" title={product.sku}>
            SKU: {product.sku}
          </span>
          <span
            className={cn(
              "font-semibold",
              product.stock_available < 5 ? "text-amber-600" : "text-emerald-600",
            )}
          >
            Stock: {product.stock_available}
          </span>
        </div>

        {product.price !== null && (
          <div
            className={cn(
              "py-2",
              template === "premium" &&
                "text-center bg-slate-50 rounded-xl border border-slate-100",
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Costo mayorista
            </p>
            <p
              className={cn(
                "font-black",
                template === "minimal" && "text-lg",
                template === "professional" && "text-xl",
                template === "premium" && "text-2xl",
              )}
              style={{ color: "var(--catalog-primary)" }}
            >
              {formatCOP(product.price)}
            </p>
          </div>
        )}

        {/* CTA */}
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "no-print w-full inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-transform hover:scale-[1.02] text-white shadow",
              template === "minimal" && "py-2 text-sm",
              template === "professional" && "py-2.5 text-sm",
              template === "premium" && "py-3 text-base",
            )}
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className="h-4 w-4" />
            Contactar Proveedor
          </a>
        ) : (
          <p className="no-print text-[11px] text-amber-600 text-center bg-amber-50 rounded-lg py-2">
            ⚠️ Proveedor sin teléfono configurado
          </p>
        )}
      </div>
    </article>
  );
};

export default PublicCatalog;

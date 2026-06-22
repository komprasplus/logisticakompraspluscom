import { useEffect, useState } from "react";
import { Layers, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface BundleItem {
  product_id: string;
  quantity: number;
  product_name: string;
  sku: string | null;
  image_url: string | null;
  stock: number;
  unit_price: number | null;
}

export interface PublicBundle {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  image_url: string | null;
  descuento_tipo: "percent" | "fixed";
  descuento_valor: number;
  items: BundleItem[];
  precio_normal: number | null;
  precio_descuento: number | null;
  ahorro: number | null;
}

interface AddItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  unitPrice: number;
  imageUrl: string | null;
  stockAtAdd: number;
  minQuantity: number;
  qty?: number;
}

interface BundlesSectionProps {
  slug: string;
  colorPrimary: string;
  colorSecondary: string;
  /** Función del carrito para agregar items (con descuento ya aplicado por item). */
  addToCart: (item: AddItem) => void;
}

const BundlesSection = ({ slug, colorPrimary, colorSecondary, addToCart }: BundlesSectionProps) => {
  const [bundles, setBundles] = useState<PublicBundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_public_bundles", { p_slug: slug });
        if (error) throw error;
        if (cancelled) return;
        setBundles(Array.isArray(data) ? (data as PublicBundle[]) : []);
      } catch {
        if (!cancelled) setBundles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const addBundleToCart = (b: PublicBundle) => {
    if (!b.precio_descuento || b.precio_descuento <= 0 || !b.precio_normal) {
      toast.error("Combo sin precio configurado");
      return;
    }
    // Repartir el descuento proporcionalmente entre los items.
    const totalNormal = b.precio_normal;
    const discountFactor = b.precio_descuento / totalNormal; // 0..1
    b.items.forEach((it) => {
      if (!it.unit_price) return;
      const unitDescuento = Math.round(it.unit_price * discountFactor);
      addToCart({
        productId: it.product_id,
        variantId: null,
        productName: `${it.product_name} (combo: ${b.nombre})`,
        variantName: null,
        sku: it.sku ?? it.product_id.slice(0, 8),
        unitPrice: unitDescuento,
        imageUrl: it.image_url ?? null,
        stockAtAdd: it.stock,
        minQuantity: 1,
        qty: it.quantity,
      });
    });
    toast.success(`Combo "${b.nombre}" agregado al carrito · ahorras ${formatCOP(b.ahorro ?? 0)}`);
  };

  if (loading || bundles.length === 0) return null;

  return (
    <section
      className="mb-6 rounded-xl p-4"
      style={{
        background: `linear-gradient(135deg, ${colorPrimary}10, ${colorSecondary}10)`,
      }}
    >
      <h2 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
        <Layers className="h-4 w-4" style={{ color: colorPrimary }} />
        Combos con descuento
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">
          {bundles.length} disponible{bundles.length !== 1 ? "s" : ""}
        </span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bundles.map((b) => {
          const ahorroPct = b.precio_normal && b.precio_normal > 0
            ? Math.round(((b.ahorro ?? 0) / b.precio_normal) * 100)
            : 0;
          return (
            <article
              key={b.id}
              className="bg-card border-2 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderColor: `${colorPrimary}40` }}
            >
              <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                {b.image_url ? (
                  <img src={b.image_url} alt={b.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid grid-cols-2 gap-px bg-muted">
                    {b.items.slice(0, 4).map((it) => (
                      <div key={it.product_id} className="bg-card flex items-center justify-center overflow-hidden">
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.product_name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Badge
                  className="absolute top-2 right-2 text-[10px] font-bold"
                  style={{ backgroundColor: colorPrimary, color: "white" }}
                >
                  -{ahorroPct}%
                </Badge>
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-white/90 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-bold text-foreground">
                  <Layers className="h-2.5 w-2.5" /> COMBO
                </span>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="text-sm font-bold text-foreground line-clamp-1">{b.nombre}</h3>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Incluye: {b.items.map((it) => `${it.quantity}× ${it.product_name}`).join(", ")}
                </p>
                {b.precio_descuento !== null && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black" style={{ color: colorPrimary }}>
                      {formatCOP(b.precio_descuento)}
                    </span>
                    {b.precio_normal && b.precio_normal !== b.precio_descuento && (
                      <span className="text-xs text-muted-foreground line-through tabular-nums">
                        {formatCOP(b.precio_normal)}
                      </span>
                    )}
                  </div>
                )}
                {b.ahorro && b.ahorro > 0 && (
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    Ahorras {formatCOP(b.ahorro)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => addBundleToCart(b)}
                  className="w-full py-2 rounded-lg text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                  style={{ background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})` }}
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar combo
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default BundlesSection;

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Search, Package, Loader2, ImageIcon, TrendingUp, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface MarketplaceProduct {
  id: string;
  product_name: string;
  description: string | null;
  sku: string;
  cost_price: number;
  suggested_price: number;
  stock_available: number;
  image_url: string | null;
  is_active: boolean;
  product_type?: string;
}

interface MarketplaceCatalogProps {
  onGenerateOrder: (product: {
    productName: string;
    sku: string;
    suggestedPrice: number;
    marketplaceProductId: string;
    productType?: string;
  }) => void;
}

const MarketplaceCatalog = ({ onGenerateOrder }: MarketplaceCatalogProps) => {
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-catalog", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marketplace_products")
        .select("*")
        .eq("organizacion_id", orgId)
        .eq("is_active", true)
        .order("product_name");
      if (error) throw error;
      return data as MarketplaceProduct[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleOrder = async (product: MarketplaceProduct) => {
    if (product.stock_available <= 0) {
      toast.error("Producto agotado");
      return;
    }
    onGenerateOrder({
      productName: product.product_name,
      sku: product.sku,
      suggestedPrice: product.suggested_price,
      marketplaceProductId: product.id,
      productType: product.product_type,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Catálogo de Suministro
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona productos y genera órdenes de envío directamente
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-14 w-14 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay productos disponibles</p>
          <p className="text-xs mt-1">El administrador aún no ha publicado productos en el marketplace</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(product => {
            const margin = product.suggested_price - product.cost_price;
            const outOfStock = product.stock_available <= 0;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className={cn(
                  "rounded-2xl overflow-hidden backdrop-blur-sm border border-border/50",
                  "bg-card/80 shadow-sm hover:shadow-lg transition-all duration-300",
                  outOfStock && "opacity-60",
                )}
              >
                {/* Image */}
                <div className="h-44 bg-muted/50 relative flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <span className="bg-destructive/90 text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Agotado
                      </span>
                    </div>
                  )}
                  {!outOfStock && product.stock_available <= 5 && (
                    <span className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Quedan {product.stock_available}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
                      {product.product_name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1">
                      SKU: {product.sku}
                    </p>
                    <div className="mt-1.5">
                      {(product.product_type || "Simple") === "Variable" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          <Package className="h-2.5 w-2.5" /> Producto con Variantes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <Package className="h-2.5 w-2.5" /> Producto Simple
                        </span>
                      )}
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                  )}

                  {/* Pricing */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      {formatCOP(product.suggested_price)}
                    </span>
                    {margin > 0 && (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        +{formatCOP(margin)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Disponible: {product.stock_available} uds</span>
                  </div>

                  {/* CTA */}
                  <Button
                    className="w-full gap-2"
                    disabled={outOfStock}
                    onClick={() => handleOrder(product)}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Generar Orden
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default MarketplaceCatalog;

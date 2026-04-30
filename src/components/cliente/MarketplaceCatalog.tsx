import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Search, Package, Loader2, ImageIcon, TrendingUp, AlertTriangle,
  Eye, Heart, Tag, Boxes, ShieldCheck, Ruler, Flame, Rocket, Compass,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const TRENDING_THRESHOLD = 50;
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface MarketplaceProduct {
  id: string;
  product_name: string;
  description: string | null;
  sku: string;
  short_id?: string | null;
  cost_price: number;
  suggested_price: number;
  stock_available: number;
  image_url: string | null;
  is_active: boolean;
  product_type?: string;
  weight_kg?: number | null;
  dimensions?: string | null;
  category?: string | null;
  warranty?: string | null;
  created_by?: string | null;
  unidades_vendidas?: number;
}

interface MarketplaceCatalogProps {
  onGenerateOrder: (product: {
    productName: string;
    sku: string;
    suggestedPrice: number;
    marketplaceProductId: string;
    productType?: string;
    costPrice: number;
    supplierUserId: string | null;
  }) => void;
}

interface ProveedorDestacado {
  user_id: string;
  store_name: string | null;
  full_name: string;
  logo_url: string | null;
  avatar_url: string | null;
  product_count: number;
}

const MarketplaceCatalog = ({ onGenerateOrder }: MarketplaceCatalogProps) => {
  const { profile, user } = useAuth();
  const orgId = profile?.organizacion_id;
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailProduct, setDetailProduct] = useState<MarketplaceProduct | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedProveedor, setSelectedProveedor] = useState<string | null>(null);
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "trending" | "price_asc" | "price_desc">("name");
  const [activeTab, setActiveTab] = useState<"explorar" | "favoritos">("explorar");

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

  // Proveedores destacados:
  // FIX: el carrusel ahora se renderiza siempre, incluso si los proveedores
  // aún no tienen productos publicados ("0 Productos"). Antes dependíamos
  // de cruzar `products.created_by`, lo que ocultaba proveedores nuevos
  // (ej. "Tendencias Tiktok") hasta que subieran al menos un producto.
  const { data: proveedores = [] } = useQuery({
    queryKey: ["marketplace-proveedores", orgId, products.length],
    queryFn: async () => {
      const { data: profilesData, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, store_name, full_name, logo_url, avatar_url, tipo_cuenta")
        .eq("tipo_cuenta", "proveedor");
      if (error) throw error;

      // Contar productos activos por proveedor (puede ser 0)
      const counts = new Map<string, number>();
      products.forEach((p) => {
        if (p.created_by) counts.set(p.created_by, (counts.get(p.created_by) ?? 0) + 1);
      });

      return (profilesData ?? [])
        .map((pr: any) => ({
          user_id: pr.user_id,
          store_name: pr.store_name,
          full_name: pr.full_name,
          logo_url: pr.logo_url,
          avatar_url: pr.avatar_url,
          product_count: counts.get(pr.user_id) ?? 0,
        }))
        .sort(
          (a: ProveedorDestacado, b: ProveedorDestacado) =>
            b.product_count - a.product_count,
        );
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Favoritos del usuario actual
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["marketplace-favorites", userId],
    queryFn: async () => {
      if (!userId) return [] as string[];
      const { data, error } = await (supabase as any)
        .from("marketplace_favorites")
        .select("product_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.product_id as string);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const favoritesSet = new Set(favoriteIds);

  const toggleFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) throw new Error("No autenticado");
      const isFav = favoritesSet.has(productId);
      if (isFav) {
        const { error } = await (supabase as any)
          .from("marketplace_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", productId);
        if (error) throw error;
        return { productId, added: false };
      } else {
        const { error } = await (supabase as any)
          .from("marketplace_favorites")
          .insert({ user_id: userId, product_id: productId, organizacion_id: orgId });
        if (error) throw error;
        return { productId, added: true };
      }
    },
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ["marketplace-favorites", userId] });
      const prev = queryClient.getQueryData<string[]>(["marketplace-favorites", userId]) ?? [];
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      queryClient.setQueryData(["marketplace-favorites", userId], next);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["marketplace-favorites", userId], ctx.prev);
      toast.error("No se pudo actualizar favoritos");
    },
    onSuccess: (res) => {
      toast.success(res.added ? "Añadido a favoritos ❤️" : "Eliminado de favoritos");
    },
  });

  const filtered = products
    .filter((p) => {
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        p.product_name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.short_id ?? "").toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term);
      const matchProveedor = !selectedProveedor || p.created_by === selectedProveedor;
      const matchTrending = !trendingOnly || (p.unidades_vendidas ?? 0) > TRENDING_THRESHOLD;
      const matchTab = activeTab === "explorar" || favoritesSet.has(p.id);
      return matchSearch && matchProveedor && matchTrending && matchTab;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "trending":
          return (b.unidades_vendidas ?? 0) - (a.unidades_vendidas ?? 0);
        case "price_asc":
          return a.suggested_price - b.suggested_price;
        case "price_desc":
          return b.suggested_price - a.suggested_price;
        default:
          return a.product_name.localeCompare(b.product_name);
      }
    });

  const trendingCount = products.filter(
    (p) => (p.unidades_vendidas ?? 0) > TRENDING_THRESHOLD,
  ).length;
  const topTrending = [...products]
    .filter((p) => (p.unidades_vendidas ?? 0) > 0)
    .sort((a, b) => (b.unidades_vendidas ?? 0) - (a.unidades_vendidas ?? 0))
    .slice(0, 8);

  const openDetails = (product: MarketplaceProduct) => {
    setDetailProduct(product);
    setActiveImage(product.image_url ?? null);
  };

  const handleGenerateOrder = (product: MarketplaceProduct) => {
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
      costPrice: product.cost_price,
      supplierUserId: product.created_by ?? null,
    });
    setDetailProduct(null);
  };

  const galleryImages = detailProduct
    ? [detailProduct.image_url].filter(Boolean) as string[]
    : [];

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
          Explora los productos disponibles y genera tus órdenes de envío
        </p>
      </div>

      {/* Tabs principales: Explorar / Mis Favoritos */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="explorar" className="gap-1.5">
            <Compass className="h-4 w-4" />
            Explorar
          </TabsTrigger>
          <TabsTrigger value="favoritos" className="gap-1.5">
            <Heart className={cn("h-4 w-4", activeTab === "favoritos" && "fill-current")} />
            Mis Favoritos
            {favoriteIds.length > 0 && (
              <span className="ml-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-primary/15 text-primary">
                {favoriteIds.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU o REF-..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant={trendingOnly ? "default" : "outline"}
          size="sm"
          onClick={() => {
            const next = !trendingOnly;
            setTrendingOnly(next);
            if (next) setSortBy("trending");
          }}
          className={cn(
            "gap-1.5 h-10",
            trendingOnly &&
              "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 border-0",
          )}
        >
          <Flame className="h-4 w-4" />
          En Tendencia
          {trendingCount > 0 && (
            <span
              className={cn(
                "ml-1 text-[10px] font-bold rounded-full px-1.5 py-0.5",
                trendingOnly ? "bg-white/25 text-white" : "bg-primary/15 text-primary",
              )}
            >
              {trendingCount}
            </span>
          )}
        </Button>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[200px] h-10">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre (A-Z)</SelectItem>
            <SelectItem value="trending">🔥 Más vendidos</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Productos en Tendencia – carrusel destacado */}
      {activeTab === "explorar" && !trendingOnly && topTrending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              Productos en Tendencia
              <span className="text-xs font-normal text-muted-foreground">
                · Los más vendidos esta temporada
              </span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setTrendingOnly(true);
                setSortBy("trending");
              }}
              className="text-xs text-primary font-medium hover:underline"
            >
              Ver todos →
            </button>
          </div>
          <div
            className="flex flex-row gap-3 overflow-x-auto py-2 -mx-1 px-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {topTrending.map((p) => {
              const sold = p.unidades_vendidas ?? 0;
              const out = p.stock_available <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openDetails(p)}
                  className={cn(
                    "flex-shrink-0 w-[180px] rounded-xl overflow-hidden border bg-card shadow-sm",
                    "hover:shadow-md hover:border-primary/40 transition-all text-left",
                    out && "opacity-60",
                  )}
                >
                  <div className="h-28 bg-muted/50 relative flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    )}
                    <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                      <Flame className="h-2.5 w-2.5" /> {sold}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                      {p.product_name}
                    </p>
                    <p className="text-sm font-bold text-primary">
                      {formatCOP(p.suggested_price)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Carrusel de Proveedores Destacados — siempre se renderiza,
          incluso si no hay proveedores aún (muestra solo "Todos"). */}
      <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Proveedores destacados</h3>
            {selectedProveedor && (
              <button
                type="button"
                onClick={() => setSelectedProveedor(null)}
                className="text-xs text-primary font-medium hover:underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>

          <div
            className="flex flex-row gap-3 overflow-x-auto py-2 -mx-1 px-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* Tarjeta "Todos" */}
            <button
              type="button"
              onClick={() => setSelectedProveedor(null)}
              className={cn(
                "flex-shrink-0 rounded-xl border shadow-sm p-3 flex items-center gap-3 bg-card transition-all min-w-[200px]",
                !selectedProveedor
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Boxes className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="font-semibold text-sm text-foreground">Todos</span>
                <span className="text-xs text-primary font-medium">
                  {products.length} Productos
                </span>
              </div>
            </button>

            {proveedores.map((prov) => {
              const isSelected = selectedProveedor === prov.user_id;
              const displayName = prov.store_name || prov.full_name;
              const initials = displayName
                .split(" ")
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const avatar = prov.logo_url || prov.avatar_url;

              return (
                <button
                  key={prov.user_id}
                  type="button"
                  onClick={() =>
                    setSelectedProveedor(isSelected ? null : prov.user_id)
                  }
                  className={cn(
                    "flex-shrink-0 rounded-xl border shadow-sm p-3 flex items-center gap-3 bg-card transition-all min-w-[220px]",
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {initials || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate max-w-[140px]">
                      {displayName}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {prov.product_count}{" "}
                      {prov.product_count === 1 ? "Producto" : "Productos"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

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
            const sold = product.unidades_vendidas ?? 0;
            const isTrending = sold > TRENDING_THRESHOLD;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className={cn(
                  "rounded-2xl overflow-hidden backdrop-blur-sm border border-border/50",
                  "bg-card/80 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer",
                  outOfStock && "opacity-60",
                )}
                onClick={() => openDetails(product)}
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
                  {isTrending && (
                    <span
                      className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse"
                      title={`${sold} unidades vendidas`}
                    >
                      <Flame className="h-3 w-3" /> En Tendencia
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

                  {/* CTA → ahora abre detalles */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={(e) => { e.stopPropagation(); openDetails(product); }}
                  >
                    <Eye className="h-4 w-4" />
                    Ver Detalles
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Product Detail Drawer / Full-screen */}
      <Dialog open={!!detailProduct} onOpenChange={(o) => !o && setDetailProduct(null)}>
        <DialogContent
          className={cn(
            "p-0 gap-0 overflow-hidden",
            "max-w-6xl w-[96vw] h-[92vh] sm:rounded-2xl",
            "max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none",
            "flex flex-col",
          )}
        >
          {detailProduct && (
            <>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto pb-28">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
                  {/* Left – Gallery (40%) */}
                  <div className="md:col-span-2 bg-muted/30 p-4 sm:p-6 md:border-r border-border/50">
                    <div className="aspect-square w-full rounded-2xl overflow-hidden bg-muted/60 flex items-center justify-center mb-3">
                      {activeImage ? (
                        <img
                          src={activeImage}
                          alt={detailProduct.product_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-20 w-20 text-muted-foreground/30" />
                      )}
                    </div>
                    {galleryImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {galleryImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImage(img)}
                            className={cn(
                              "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                              activeImage === img ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                            )}
                          >
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right – Info (60%) */}
                  <div className="md:col-span-3 p-5 sm:p-7 space-y-6">
                    {/* Header */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {detailProduct.category && (
                          <Badge variant="secondary" className="gap-1">
                            <Tag className="h-3 w-3" /> {detailProduct.category}
                          </Badge>
                        )}
                        <Badge variant="outline" className="gap-1">
                          {(detailProduct.product_type || "Simple") === "Variable" ? "Con Variantes" : "Simple"}
                        </Badge>
                        {detailProduct.stock_available <= 0 ? (
                          <Badge variant="destructive">Agotado</Badge>
                        ) : detailProduct.stock_available <= 5 ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">
                            Stock bajo
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500 hover:bg-emerald-500/90 text-white">
                            Disponible
                          </Badge>
                        )}
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                        {detailProduct.product_name}
                      </h1>
                      <p className="text-xs font-mono text-muted-foreground">SKU: {detailProduct.sku}</p>
                    </div>

                    {/* Description */}
                    {detailProduct.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {detailProduct.description}
                      </p>
                    )}

                    {/* Financial Block */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          Costo Proveedor
                        </p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {formatCOP(detailProduct.cost_price)}
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-primary font-semibold">
                          Precio Sugerido
                        </p>
                        <p className="text-xl font-bold text-primary mt-1">
                          {formatCOP(detailProduct.suggested_price)}
                        </p>
                        {detailProduct.suggested_price - detailProduct.cost_price > 0 && (
                          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Margen: {formatCOP(detailProduct.suggested_price - detailProduct.cost_price)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Inventory bar */}
                    <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Boxes className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Stock disponible en bodega</p>
                        <p className="text-lg font-bold text-foreground">
                          {detailProduct.stock_available} <span className="text-sm font-normal text-muted-foreground">unidades</span>
                        </p>
                      </div>
                    </div>

                    {/* Prueba social — Tendencia / Top Ventas */}
                    {(detailProduct.unidades_vendidas ?? 0) > 0 && (
                      <div className={cn(
                        "rounded-xl border p-4 space-y-2",
                        (detailProduct.unidades_vendidas ?? 0) > TRENDING_THRESHOLD
                          ? "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-red-500/10"
                          : "border-border/60 bg-muted/40"
                      )}>
                        <div className="flex items-center gap-2">
                          {(detailProduct.unidades_vendidas ?? 0) > TRENDING_THRESHOLD ? (
                            <Flame className="h-5 w-5 text-orange-500" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-primary" />
                          )}
                          <p className="text-sm font-semibold text-foreground">
                            {(detailProduct.unidades_vendidas ?? 0) > TRENDING_THRESHOLD ? (
                              <>¡Producto ganador! <Rocket className="inline h-4 w-4" /> {detailProduct.unidades_vendidas} unidades vendidas recientemente.</>
                            ) : (
                              <>📈 {detailProduct.unidades_vendidas} unidades vendidas hasta ahora.</>
                            )}
                          </p>
                        </div>
                        <Progress
                          value={Math.min(100, ((detailProduct.unidades_vendidas ?? 0) / (TRENDING_THRESHOLD * 2)) * 100)}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Tabs */}
                    <Tabs defaultValue="detalles" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="detalles">Detalles Técnicos</TabsTrigger>
                        <TabsTrigger value="garantias">Garantías / Políticas</TabsTrigger>
                      </TabsList>
                      <TabsContent value="detalles" className="mt-3 rounded-xl border border-border/60 p-4 space-y-2 text-sm">
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> SKU</span>
                          <span className="font-mono font-medium">{detailProduct.sku}</span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" /> Peso</span>
                          <span className="font-medium">{detailProduct.weight_kg ? `${detailProduct.weight_kg} kg` : "N/D"}</span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" /> Dimensiones</span>
                          <span className="font-medium">{detailProduct.dimensions || "N/D"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tipo de producto</span>
                          <span className="font-medium">{detailProduct.product_type || "Simple"}</span>
                        </div>
                      </TabsContent>
                      <TabsContent value="garantias" className="mt-3 rounded-xl border border-border/60 p-4 text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                          <p className="text-muted-foreground">
                            {detailProduct.warranty || "Producto cubierto por garantía estándar de la plataforma. Contraentrega disponible. Devoluciones procesadas según política operativa de Plus Envíos."}
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Action Bar */}
              <div
                className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border z-50 px-4 sm:px-6 py-3 flex items-center gap-3"
                style={{ boxShadow: "0 -4px 12px -2px rgba(0,0,0,0.1)" }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 max-sm:px-3"
                  onClick={() => toast.success("Agregado a favoritos")}
                >
                  <Heart className="h-4 w-4" />
                  <span className="max-sm:hidden">Favoritos</span>
                </Button>
                <Button
                  size="lg"
                  className="flex-1 gap-2 font-semibold"
                  disabled={detailProduct.stock_available <= 0}
                  onClick={() => handleGenerateOrder(detailProduct)}
                >
                  <ShoppingBag className="h-5 w-5" />
                  {detailProduct.stock_available <= 0 ? "Agotado temporalmente" : "Generar Orden"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MarketplaceCatalog;

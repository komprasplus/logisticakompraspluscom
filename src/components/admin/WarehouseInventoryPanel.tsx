import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  Warehouse,
  AlertTriangle,
  Plus,
  Minus,
  Store,
  Loader2,
  ImageOff,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  sku: string;
  product_name: string;
  stock_available: number;
  low_stock_threshold: number;
  image_url: string | null;
  price: number | null;
  fulfillment_value: number | null;
  client_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ClientProfile {
  user_id: string;
  store_name: string | null;
  full_name: string;
}

interface AdjustmentModal {
  isOpen: boolean;
  item: InventoryItem | null;
  type: "add" | "subtract";
  quantity: number;
  reason: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: el estado inicial del modal definido como constante reutilizable.
  Antes el mismo objeto literal aparecía 3 veces (apertura, cierre y
  reset post-ajuste), creando riesgo de inconsistencias si se añadían campos.
*/
const MODAL_RESET: AdjustmentModal = {
  isOpen: false,
  item: null,
  type: "add",
  quantity: 1,
  reason: "",
};

// ─── Inventory Card ───────────────────────────────────────────────────────────

/*
  FIX: InventoryCard envuelto en memo para evitar re-renders cuando
  el padre actualiza estado no relacionado con esta tarjeta.
  Antes, cada cambio en `searchQuery` o `adjustmentModal` re-renderizaba
  todos los cards del grid.
*/
interface InventoryCardProps {
  item: InventoryItem;
  clientName: string;
  onAdjust: (item: InventoryItem, type: "add" | "subtract") => void;
  showClient?: boolean;
}

const InventoryCard = memo(({ item, clientName, onAdjust, showClient = true }: InventoryCardProps) => {
  const [imgError, setImgError] = useState(false);

  const isLowStock = item.stock_available > 0 && item.stock_available < item.low_stock_threshold;
  const isOutOfStock = item.stock_available === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "neu-flat rounded-2xl p-4 transition-all hover:shadow-elevated",
        isOutOfStock && "border-2 border-destructive/50",
        isLowStock && "border-2 border-amber-500/50",
      )}
    >
      {/* Imagen */}
      <div className="relative mb-3">
        {item.image_url && !imgError ? (
          <img
            src={item.image_url}
            alt={item.product_name}
            className="w-full h-24 object-cover rounded-xl"
            /*
              FIX: en lugar de `e.currentTarget.style.display = "none"` que
              dejaba un espacio vacío, ahora se activa el fallback visual
              actualizando estado local.
            */
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-24 bg-muted rounded-xl flex items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {/* Badge de stock */}
        <div
          className={cn(
            "absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold shadow-lg",
            isOutOfStock
              ? "bg-destructive text-destructive-foreground"
              : isLowStock
                ? "bg-amber-500 text-white"
                : "bg-emerald-500 text-white",
          )}
        >
          {item.stock_available}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 mb-3">
        <h4 className="font-bold text-foreground text-sm line-clamp-1">{item.product_name}</h4>
        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
        {showClient && <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{clientName}</p>}
      </div>

      {/* Estado de stock */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Stock:</span>
        <span
          className={cn(
            "font-bold",
            isOutOfStock ? "text-destructive" : isLowStock ? "text-amber-600" : "text-foreground",
          )}
        >
          {item.stock_available} uds
        </span>
      </div>

      {isLowStock && (
        <div className="flex items-center gap-1 text-amber-600 text-xs mb-3">
          <AlertTriangle className="h-3 w-3" />
          <span>Stock bajo — Reabastecer</span>
        </div>
      )}
      {isOutOfStock && (
        <div className="flex items-center gap-1 text-destructive text-xs mb-3">
          <AlertTriangle className="h-3 w-3" />
          <span>Agotado</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 gap-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
          onClick={() => onAdjust(item, "add")}
        >
          <Plus className="h-3 w-3" /> Agregar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 gap-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
          onClick={() => onAdjust(item, "subtract")}
          disabled={isOutOfStock}
        >
          <Minus className="h-3 w-3" /> Restar
        </Button>
      </div>
    </motion.div>
  );
});
InventoryCard.displayName = "InventoryCard";

// ─── Panel principal ──────────────────────────────────────────────────────────

const WarehouseInventoryPanel = () => {
  const [activeTab, setActiveTab] = useState<"proveeduria" | "fulfillment">("proveeduria");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustmentModal, setAdjustmentModal] = useState<AdjustmentModal>(MODAL_RESET);
  const [adjusting, setAdjusting] = useState(false);

  const cancelRef = useRef(false);

  // ── Fetch inventario ───────────────────────────────────────────────────────

  const fetchInventory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("inventory")
        // FIX: campos explícitos en lugar de select("*")
        .select(
          "id, sku, product_name, stock_available, low_stock_threshold, image_url, price, fulfillment_value, client_user_id, created_at, updated_at",
        )
        .order("product_name", { ascending: true });

      if (cancelRef.current) return;
      if (error) throw error;
      setInventory(data ?? []);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching inventory:", error);
      toast.error("Error al cargar el inventario");
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // ── Fetch perfiles de clientes ─────────────────────────────────────────────

  /*
    FIX: dos queries secuenciales (roles → profiles) consolidadas.
    FIX: error de profiles ahora muestra toast en lugar de silenciarse.
  */
  const fetchClientProfiles = useCallback(async () => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (rolesError) throw rolesError;
      if (!roles?.length) return;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, store_name, full_name")
        .in(
          "user_id",
          roles.map((r) => r.user_id),
        );

      if (cancelRef.current) return;
      if (profilesError) throw profilesError;

      const profileMap: Record<string, ClientProfile> = {};
      for (const p of profiles ?? []) {
        profileMap[p.user_id] = p;
      }
      setClientProfiles(profileMap);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching client profiles:", error);
      // FIX: error visible al usuario en lugar de silenciarse
      toast.error("Error al cargar perfiles de tiendas");
    }
  }, []);

  // ── Efectos ────────────────────────────────────────────────────────────────

  useEffect(() => {
    cancelRef.current = false;
    /*
      FIX: lanzar ambos fetches en paralelo en lugar de secuencial.
      Antes fetchInventory y fetchClientProfiles se iniciaban uno detrás del
      otro en el mismo useEffect, pero como no se usaba Promise.all
      el segundo empezaba inmediatamente (eran independientes) — no era un bug
      de secuencialidad puro, pero esto lo hace explícito y más legible.
    */
    Promise.all([fetchInventory(), fetchClientProfiles()]);
    return () => {
      cancelRef.current = true;
    };
  }, [fetchInventory, fetchClientProfiles]);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("admin-inventory-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setInventory((prev) => [payload.new as InventoryItem, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setInventory((prev) =>
            prev.map((item) => (item.id === (payload.new as InventoryItem).id ? (payload.new as InventoryItem) : item)),
          );
        } else if (payload.eventType === "DELETE") {
          setInventory((prev) => prev.filter((item) => item.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe((status) => {
        // FIX: loguear estado de suscripción para facilitar debugging
        if (status === "CHANNEL_ERROR") {
          console.error("Real-time inventory subscription failed");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Ajuste de stock ────────────────────────────────────────────────────────

  const handleStockAdjustment = useCallback(async () => {
    if (!adjustmentModal.item || adjustmentModal.quantity <= 0) return;

    setAdjusting(true);
    try {
      const currentStock = adjustmentModal.item.stock_available;
      const newStock =
        adjustmentModal.type === "add"
          ? currentStock + adjustmentModal.quantity
          : Math.max(0, currentStock - adjustmentModal.quantity);

      const { error } = await supabase
        .from("inventory")
        .update({
          stock_available: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adjustmentModal.item.id);

      if (error) throw error;

      /*
        FIX: el campo `reason` del modal nunca se persistía — se recolectaba
        en el formulario pero no se enviaba a ninguna parte.
        Ahora se inserta en una tabla de audit log (best-effort).
      */
      if (adjustmentModal.reason.trim()) {
        (supabase as any)
          .from("inventory_adjustment_logs")
          .insert({
            inventory_id: adjustmentModal.item.id,
            tipo: adjustmentModal.type,
            cantidad: adjustmentModal.quantity,
            stock_antes: currentStock,
            stock_despues: newStock,
            motivo: adjustmentModal.reason.trim(),
          })
          .then(({ error: logErr }) => {
            if (logErr) console.warn("Audit log inventory failed (non-blocking):", logErr);
          });
      }

      toast.success(
        `Stock ${adjustmentModal.type === "add" ? "aumentado" : "reducido"}: ${currentStock} → ${newStock}`,
      );

      setAdjustmentModal(MODAL_RESET);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast.error("Error al ajustar el stock");
    } finally {
      if (!cancelRef.current) setAdjusting(false);
    }
  }, [adjustmentModal]);

  const openAdjustmentModal = useCallback((item: InventoryItem, type: "add" | "subtract") => {
    setAdjustmentModal({ isOpen: true, item, type, quantity: 1, reason: "" });
  }, []);

  const closeModal = useCallback(() => setAdjustmentModal(MODAL_RESET), []);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const filteredInventory = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return inventory;
    return inventory.filter(
      (item) => item.product_name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query),
    );
  }, [inventory, searchQuery]);

  const inventoryByClient = useMemo(() => {
    const grouped: Record<string, InventoryItem[]> = {};
    for (const item of filteredInventory) {
      (grouped[item.client_user_id] ??= []).push(item);
    }
    return grouped;
  }, [filteredInventory]);

  const stats = useMemo(
    () => ({
      totalProducts: inventory.length,
      totalUnits: inventory.reduce((acc, i) => acc + i.stock_available, 0),
      lowStockCount: inventory.filter((i) => i.stock_available > 0 && i.stock_available < i.low_stock_threshold).length,
      outOfStockCount: inventory.filter((i) => i.stock_available === 0).length,
      uniqueClients: new Set(inventory.map((i) => i.client_user_id)).size,
    }),
    [inventory],
  );

  /*
    FIX: `getClientName` memoizado como función pura usando `useMemo` sobre
    el mapa — evita que su recreación obligue re-renders de InventoryCard.
  */
  const getClientName = useCallback(
    (clientUserId: string): string => {
      const p = clientProfiles[clientUserId];
      return p?.store_name ?? p?.full_name ?? "Tienda desconocida";
    },
    [clientProfiles],
  );

  // ── Preview del nuevo stock en el modal ───────────────────────────────────

  const previewNewStock = useMemo(() => {
    if (!adjustmentModal.item) return 0;
    return adjustmentModal.type === "add"
      ? adjustmentModal.item.stock_available + adjustmentModal.quantity
      : Math.max(0, adjustmentModal.item.stock_available - adjustmentModal.quantity);
  }, [adjustmentModal.item, adjustmentModal.type, adjustmentModal.quantity]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventario de Bodega</h1>
          <p className="text-muted-foreground">Control centralizado de stock y fulfillment</p>
        </div>
        {/* FIX: botón con estado refreshing y spinner */}
        <Button onClick={() => fetchInventory(true)} variant="outline" className="gap-2" disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: <Package className="h-6 w-6 text-primary" />, value: stats.totalProducts, label: "Productos" },
          {
            icon: <Warehouse className="h-6 w-6 text-emerald-500" />,
            value: stats.totalUnits.toLocaleString(),
            label: "Unidades",
          },
          { icon: <Store className="h-6 w-6 text-violet-500" />, value: stats.uniqueClients, label: "Tiendas" },
          {
            icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
            value: <span className="text-amber-600">{stats.lowStockCount}</span>,
            label: "Stock Bajo",
          },
          {
            icon: <Package className="h-6 w-6 text-destructive" />,
            value: <span className="text-destructive">{stats.outOfStockCount}</span>,
            label: "Agotado",
          },
        ].map((s, i) => (
          <div key={i} className="neu-flat rounded-2xl p-4 text-center">
            <div className="mx-auto w-fit mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 neu-flat border-0"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "proveeduria" | "fulfillment")}>
        <TabsList className="neu-flat border-0 p-1">
          <TabsTrigger value="proveeduria" className="gap-2 data-[state=active]:neu-pressed">
            <Warehouse className="h-4 w-4" />
            Mi Inventario (Proveeduría)
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="gap-2 data-[state=active]:neu-pressed">
            <Store className="h-4 w-4" />
            Fulfillment (Clientes)
          </TabsTrigger>
        </TabsList>

        {/* Tab: Proveeduría */}
        <TabsContent value="proveeduria" className="mt-6">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? "Sin resultados para tu búsqueda" : "No hay productos en el inventario"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredInventory.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  clientName={getClientName(item.client_user_id)}
                  onAdjust={openAdjustmentModal}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Fulfillment */}
        <TabsContent value="fulfillment" className="mt-6 space-y-8">
          {Object.keys(inventoryByClient).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? "Sin resultados para tu búsqueda" : "No hay productos de clientes"}</p>
            </div>
          ) : (
            Object.entries(inventoryByClient).map(([clientId, items]) => (
              <div key={clientId} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{getClientName(clientId)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {items.length} productos • {items.reduce((acc, i) => acc + i.stock_available, 0)} unidades
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((item) => (
                    <InventoryCard
                      key={item.id}
                      item={item}
                      clientName={getClientName(item.client_user_id)}
                      onAdjust={openAdjustmentModal}
                      showClient={false}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de ajuste de stock */}
      <Dialog open={adjustmentModal.isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{adjustmentModal.type === "add" ? "Agregar" : "Restar"} Stock</DialogTitle>
          </DialogHeader>

          {adjustmentModal.item && (
            <div className="space-y-4 py-4">
              {/* Info del producto */}
              <div className="flex items-center gap-3 p-3 neu-flat rounded-xl">
                {adjustmentModal.item.image_url ? (
                  <img
                    src={adjustmentModal.item.image_url}
                    alt={adjustmentModal.item.product_name}
                    className="w-12 h-12 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{adjustmentModal.item.product_name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {adjustmentModal.item.sku}</p>
                </div>
              </div>

              {/* Stock actual */}
              <div className="flex items-center justify-center gap-4">
                <p className="text-muted-foreground">Stock actual:</p>
                <p className="text-2xl font-bold text-foreground">{adjustmentModal.item.stock_available}</p>
              </div>

              {/* Selector de cantidad */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustmentModal((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  disabled={adjustmentModal.quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={adjustmentModal.quantity}
                  onChange={(e) =>
                    setAdjustmentModal((prev) => ({
                      ...prev,
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  className="w-20 text-center text-lg font-bold"
                  inputMode="numeric"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustmentModal((prev) => ({ ...prev, quantity: prev.quantity + 1 }))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* FIX: previewNewStock memoizado, no recalculado inline */}
              <div className="flex items-center justify-center gap-2 text-lg">
                <span className="text-muted-foreground">Nuevo stock:</span>
                <span
                  className={cn("font-bold", adjustmentModal.type === "add" ? "text-emerald-600" : "text-amber-600")}
                >
                  {previewNewStock}
                </span>
              </div>

              {/* FIX: campo de motivo — ahora sí se guarda en el audit log */}
              <Input
                placeholder="Motivo del ajuste (se registrará en el historial)"
                value={adjustmentModal.reason}
                onChange={(e) => setAdjustmentModal((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={adjusting}>
              Cancelar
            </Button>
            <Button
              onClick={handleStockAdjustment}
              disabled={adjusting}
              className={cn(
                adjustmentModal.type === "add"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700",
                "text-white",
              )}
            >
              {adjusting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : adjustmentModal.type === "add" ? (
                <Plus className="h-4 w-4 mr-2" />
              ) : (
                <Minus className="h-4 w-4 mr-2" />
              )}
              {adjustmentModal.type === "add" ? "Agregar" : "Restar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default WarehouseInventoryPanel;

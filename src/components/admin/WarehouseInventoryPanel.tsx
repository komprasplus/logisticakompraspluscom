import { useState, useEffect, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

interface StockAdjustmentModal {
  isOpen: boolean;
  item: InventoryItem | null;
  type: "add" | "subtract";
  quantity: number;
  reason: string;
}

const WarehouseInventoryPanel = () => {
  const [activeTab, setActiveTab] = useState<"proveeduria" | "fulfillment">("proveeduria");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustmentModal, setAdjustmentModal] = useState<StockAdjustmentModal>({
    isOpen: false,
    item: null,
    type: "add",
    quantity: 1,
    reason: "",
  });
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    fetchInventory();
    fetchClientProfiles();
  }, []);

  // Real-time subscription for inventory changes
  useEffect(() => {
    const channel = supabase
      .channel("admin-inventory-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setInventory((prev) => [payload.new as InventoryItem, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setInventory((prev) =>
              prev.map((item) =>
                item.id === (payload.new as InventoryItem).id
                  ? (payload.new as InventoryItem)
                  : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setInventory((prev) =>
              prev.filter((item) => item.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("product_name", { ascending: true });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Error al cargar el inventario");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientProfiles = async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, store_name, full_name")
          .in(
            "user_id",
            roles.map((r) => r.user_id)
          );

        if (profiles) {
          const profileMap: Record<string, ClientProfile> = {};
          profiles.forEach((p) => {
            profileMap[p.user_id] = p;
          });
          setClientProfiles(profileMap);
        }
      }
    } catch (error) {
      console.error("Error fetching client profiles:", error);
    }
  };

  const handleStockAdjustment = async () => {
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
        .update({ stock_available: newStock })
        .eq("id", adjustmentModal.item.id);

      if (error) throw error;

      toast.success(
        `Stock ${adjustmentModal.type === "add" ? "aumentado" : "reducido"}: ${currentStock} → ${newStock}`
      );

      setAdjustmentModal({
        isOpen: false,
        item: null,
        type: "add",
        quantity: 1,
        reason: "",
      });
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast.error("Error al ajustar el stock");
    } finally {
      setAdjusting(false);
    }
  };

  const openAdjustmentModal = (item: InventoryItem, type: "add" | "subtract") => {
    setAdjustmentModal({
      isOpen: true,
      item,
      type,
      quantity: 1,
      reason: "",
    });
  };

  // Filter and group inventory
  const filteredInventory = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return inventory.filter(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [inventory, searchQuery]);

  // Group by client for Fulfillment tab
  const inventoryByClient = useMemo(() => {
    const grouped: Record<string, InventoryItem[]> = {};
    filteredInventory.forEach((item) => {
      if (!grouped[item.client_user_id]) {
        grouped[item.client_user_id] = [];
      }
      grouped[item.client_user_id].push(item);
    });
    return grouped;
  }, [filteredInventory]);

  // Stats
  const stats = useMemo(() => {
    const totalProducts = inventory.length;
    const totalUnits = inventory.reduce((acc, item) => acc + item.stock_available, 0);
    const lowStockCount = inventory.filter(
      (item) => item.stock_available < item.low_stock_threshold
    ).length;
    const outOfStockCount = inventory.filter((item) => item.stock_available === 0).length;
    const uniqueClients = new Set(inventory.map((item) => item.client_user_id)).size;

    return { totalProducts, totalUnits, lowStockCount, outOfStockCount, uniqueClients };
  }, [inventory]);

  const getClientName = (clientUserId: string) => {
    const profile = clientProfiles[clientUserId];
    return profile?.store_name || profile?.full_name || "Tienda desconocida";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventario de Bodega</h1>
          <p className="text-muted-foreground">
            Control centralizado de stock y fulfillment
          </p>
        </div>
        <Button onClick={fetchInventory} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="neu-flat rounded-2xl p-4 text-center">
          <Package className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats.totalProducts}</p>
          <p className="text-xs text-muted-foreground">Productos</p>
        </div>
        <div className="neu-flat rounded-2xl p-4 text-center">
          <Warehouse className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {stats.totalUnits.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Unidades</p>
        </div>
        <div className="neu-flat rounded-2xl p-4 text-center">
          <Store className="h-6 w-6 mx-auto text-violet-500 mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats.uniqueClients}</p>
          <p className="text-xs text-muted-foreground">Tiendas</p>
        </div>
        <div className="neu-flat rounded-2xl p-4 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-600">{stats.lowStockCount}</p>
          <p className="text-xs text-muted-foreground">Stock Bajo</p>
        </div>
        <div className="neu-flat rounded-2xl p-4 text-center">
          <Package className="h-6 w-6 mx-auto text-destructive mb-2" />
          <p className="text-2xl font-bold text-destructive">{stats.outOfStockCount}</p>
          <p className="text-xs text-muted-foreground">Agotado</p>
        </div>
      </div>

      {/* Search */}
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
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "proveeduria" | "fulfillment")}
      >
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

        {/* Proveeduria Tab - All products in a grid */}
        <TabsContent value="proveeduria" className="mt-6">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos en el inventario</p>
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

        {/* Fulfillment Tab - Grouped by client */}
        <TabsContent value="fulfillment" className="mt-6 space-y-8">
          {Object.keys(inventoryByClient).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos de clientes</p>
            </div>
          ) : (
            Object.entries(inventoryByClient).map(([clientId, items]) => (
              <div key={clientId} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {getClientName(clientId)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {items.length} productos •{" "}
                      {items.reduce((acc, i) => acc + i.stock_available, 0)} unidades
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

      {/* Stock Adjustment Modal */}
      <Dialog
        open={adjustmentModal.isOpen}
        onOpenChange={(open) =>
          !open &&
          setAdjustmentModal({
            isOpen: false,
            item: null,
            type: "add",
            quantity: 1,
            reason: "",
          })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adjustmentModal.type === "add" ? "Agregar" : "Restar"} Stock
            </DialogTitle>
          </DialogHeader>

          {adjustmentModal.item && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 neu-flat rounded-xl">
                {adjustmentModal.item.image_url ? (
                  <img
                    src={adjustmentModal.item.image_url}
                    alt={adjustmentModal.item.product_name}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {adjustmentModal.item.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {adjustmentModal.item.sku}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <p className="text-muted-foreground">Stock actual:</p>
                <p className="text-2xl font-bold text-foreground">
                  {adjustmentModal.item.stock_available}
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAdjustmentModal((prev) => ({
                      ...prev,
                      quantity: Math.max(1, prev.quantity - 1),
                    }))
                  }
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
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAdjustmentModal((prev) => ({
                      ...prev,
                      quantity: prev.quantity + 1,
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-lg">
                <span className="text-muted-foreground">Nuevo stock:</span>
                <span
                  className={cn(
                    "font-bold",
                    adjustmentModal.type === "add"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  )}
                >
                  {adjustmentModal.type === "add"
                    ? adjustmentModal.item.stock_available + adjustmentModal.quantity
                    : Math.max(
                        0,
                        adjustmentModal.item.stock_available - adjustmentModal.quantity
                      )}
                </span>
              </div>

              <Input
                placeholder="Motivo del ajuste (opcional)"
                value={adjustmentModal.reason}
                onChange={(e) =>
                  setAdjustmentModal((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setAdjustmentModal({
                  isOpen: false,
                  item: null,
                  type: "add",
                  quantity: 1,
                  reason: "",
                })
              }
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStockAdjustment}
              disabled={adjusting}
              className={cn(
                adjustmentModal.type === "add"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
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

// Inventory Card Component
interface InventoryCardProps {
  item: InventoryItem;
  clientName: string;
  onAdjust: (item: InventoryItem, type: "add" | "subtract") => void;
  showClient?: boolean;
}

const InventoryCard = ({
  item,
  clientName,
  onAdjust,
  showClient = true,
}: InventoryCardProps) => {
  const isLowStock = item.stock_available < item.low_stock_threshold;
  const isOutOfStock = item.stock_available === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "neu-flat rounded-2xl p-4 transition-all hover:shadow-elevated",
        isOutOfStock && "border-2 border-destructive/50",
        isLowStock && !isOutOfStock && "border-2 border-amber-500/50"
      )}
    >
      {/* Image */}
      <div className="relative mb-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.product_name}
            className="w-full h-24 object-cover rounded-xl"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-24 bg-muted rounded-xl flex items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {/* Stock Badge */}
        <div
          className={cn(
            "absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold shadow-lg",
            isOutOfStock
              ? "bg-destructive text-destructive-foreground"
              : isLowStock
              ? "bg-amber-500 text-white"
              : "bg-emerald-500 text-white"
          )}
        >
          {item.stock_available}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 mb-3">
        <h4 className="font-bold text-foreground text-sm line-clamp-1">
          {item.product_name}
        </h4>
        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
        {showClient && (
          <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
            {clientName}
          </p>
        )}
      </div>

      {/* Stock Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Stock:</span>
        <span
          className={cn(
            "font-bold",
            isOutOfStock
              ? "text-destructive"
              : isLowStock
              ? "text-amber-600"
              : "text-foreground"
          )}
        >
          {item.stock_available} uds
        </span>
      </div>

      {/* Low Stock Alert */}
      {isLowStock && !isOutOfStock && (
        <div className="flex items-center gap-1 text-amber-600 text-xs mb-3">
          <AlertTriangle className="h-3 w-3" />
          <span>Stock bajo - Reabastecer</span>
        </div>
      )}
      {isOutOfStock && (
        <div className="flex items-center gap-1 text-destructive text-xs mb-3">
          <AlertTriangle className="h-3 w-3" />
          <span>Agotado</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 gap-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
          onClick={() => onAdjust(item, "add")}
        >
          <Plus className="h-3 w-3" />
          Agregar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 gap-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
          onClick={() => onAdjust(item, "subtract")}
          disabled={isOutOfStock}
        >
          <Minus className="h-3 w-3" />
          Restar
        </Button>
      </div>
    </motion.div>
  );
};

export default WarehouseInventoryPanel;

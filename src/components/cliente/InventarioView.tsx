import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  BarChart3,
  TrendingDown,
  Archive,
  ShoppingCart,
  Truck,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { useAuth } from "@/hooks/useAuth";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import CreateProductModal from "./CreateProductModal";

interface InventoryItem {
  id: string;
  client_user_id: string;
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
  low_stock_threshold: number;
  fulfillment_value?: number;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

const InventarioView = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  // Order creation state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<{
    inventoryItemId: string;
    productName: string;
    price: number;
    quantity: number;
    sku: string;
    maxStock: number;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchInventory();
    }
  }, [user?.id]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("*")
        .order("product_name", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const stats = useMemo(() => {
    const totalProducts = items.length;
    const lowStockItems = items.filter(
      (item) => item.stock_available <= item.low_stock_threshold
    );
    const outOfStockItems = items.filter((item) => item.stock_available === 0);
    const totalValue = items.reduce(
      (acc, item) => acc + item.stock_available * item.price,
      0
    );
    return { totalProducts, lowStockItems, outOfStockItems, totalValue };
  }, [items]);

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("inventory")
        .update({
          sku: editingItem.sku.trim().toUpperCase(),
          product_name: editingItem.product_name.trim(),
          stock_available: editingItem.stock_available,
          price: editingItem.price,
          low_stock_threshold: editingItem.low_stock_threshold,
          fulfillment_value: editingItem.fulfillment_value || 1900,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Producto actualizado");
      setEditingItem(null);
      fetchInventory();
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Error al actualizar producto");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("¿Eliminar este producto del inventario?")) return;

    try {
      const { error } = await (supabase as any)
        .from("inventory")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      toast.success("Producto eliminado");
      fetchInventory();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Error al eliminar producto");
    }
  };

  const handleCreateOrder = (item: InventoryItem) => {
    setOrderPrefill({
      inventoryItemId: item.id,
      productName: item.product_name,
      price: item.price,
      quantity: 1,
      sku: item.sku,
      maxStock: item.stock_available,
    });
    setShowOrderModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Mi Inventario</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona tus productos y controla el stock
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30"
        >
          <Plus className="h-4 w-4" />
          Crear Producto
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalProducts}
              </p>
              <p className="text-xs text-muted-foreground">Productos</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatCOP(stats.totalValue)}
              </p>
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <TrendingDown className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">
                {stats.lowStockItems.length}
              </p>
              <p className="text-xs text-muted-foreground">Stock Bajo</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <Archive className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">
                {stats.outOfStockItems.length}
              </p>
              <p className="text-xs text-muted-foreground">Agotados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-orange-700 dark:text-orange-400">
                Alerta de Stock Bajo
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.lowStockItems.map((item) => item.product_name).join(", ")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por SKU o nombre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Inventory Grid - Enhanced Cards */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery
              ? "No hay productos que coincidan"
              : "Aún no tienes productos en inventario"}
          </p>
          {!searchQuery && (
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-primary text-sm font-medium hover:underline"
              whileHover={{ scale: 1.02 }}
            >
              + Agregar tu primer producto
            </motion.button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isLowStock = item.stock_available <= item.low_stock_threshold;
            const isOutOfStock = item.stock_available === 0;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-xl",
                  isOutOfStock
                    ? "border-destructive/50"
                    : isLowStock
                    ? "border-orange-500/50"
                    : "border-border hover:border-primary/30"
                )}
              >
                {/* Product Image */}
                <div className="relative aspect-[16/10] bg-muted/30 overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Stock Badge */}
                  <div
                    className={cn(
                      "absolute top-2 right-2 px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-sm",
                      isOutOfStock
                        ? "bg-destructive/90 text-destructive-foreground"
                        : isLowStock
                        ? "bg-orange-500/90 text-white"
                        : "bg-emerald-500/90 text-white"
                    )}
                  >
                    {item.stock_available} uds
                  </div>

                  {/* Action buttons overlay */}
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm hover:bg-destructive/10 transition-colors shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <p className="text-xs text-muted-foreground font-mono mb-1">
                    {item.sku}
                  </p>
                  <h3 className="font-semibold text-foreground line-clamp-2 min-h-[2.5rem]">
                    {item.product_name}
                  </h3>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {formatCOP(item.price)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Truck className="h-3 w-3" />
                        <span>Fulfillment: {formatCOP(item.fulfillment_value || 1900)}</span>
                      </div>
                    </div>
                  </div>

                  {isLowStock && (
                    <div
                      className={cn(
                        "mt-2 flex items-center gap-1 text-xs font-medium",
                        isOutOfStock ? "text-destructive" : "text-orange-500"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {isOutOfStock ? "¡Agotado!" : "Stock bajo"}
                    </div>
                  )}

                  {/* Generate Shipment Button */}
                  <motion.button
                    onClick={() => handleCreateOrder(item)}
                    disabled={isOutOfStock}
                    className={cn(
                      "w-full mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
                      isOutOfStock
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40"
                    )}
                    whileHover={!isOutOfStock ? { scale: 1.02 } : undefined}
                    whileTap={!isOutOfStock ? { scale: 0.98 } : undefined}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Generar Envío con este Producto
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Product Modal - New Enhanced Version */}
      <CreateProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchInventory();
        }}
        userId={user?.id || ""}
        defaultFulfillmentValue={1900}
      />

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-3xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Editar Producto</h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editingItem.sku}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, sku: e.target.value })
                    }
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    value={editingItem.product_name}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        product_name: e.target.value,
                      })
                    }
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Stock Disponible
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingItem.stock_available}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          stock_available: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Precio (COP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editingItem.price}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Valor Fulfillment (COP)
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[1900, 2000, 2200].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            fulfillment_value: value,
                          })
                        }
                        className={cn(
                          "py-2 rounded-xl text-sm font-semibold transition-all",
                          (editingItem.fulfillment_value || 1900) === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {formatCOP(value)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Umbral de Stock Bajo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.low_stock_threshold}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        low_stock_threshold: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <motion.button
                  onClick={handleUpdateItem}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Actualizar Producto
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Creation Modal */}
      <NuevoPedidoModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setOrderPrefill(null);
        }}
        onSuccess={() => {
          fetchInventory();
        }}
        isAdmin={false}
        inventoryPrefill={orderPrefill || undefined}
      />
    </div>
  );
};

export default InventarioView;

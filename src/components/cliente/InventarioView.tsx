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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { useAuth } from "@/hooks/useAuth";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";

interface InventoryItem {
  id: string;
  client_user_id: string;
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

interface NewItem {
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
  low_stock_threshold: number;
}

const InventarioView = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const [newItem, setNewItem] = useState<NewItem>({
    sku: "",
    product_name: "",
    stock_available: 0,
    price: 0,
    low_stock_threshold: 5,
  });

  // Order creation state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<{
    inventoryItemId: string;
    productName: string;
    price: number;
    quantity: number;
    sku: string;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchInventory();
    }
  }, [user?.id]);

  const fetchInventory = async () => {
    try {
      // Use 'as any' since types may not be updated yet
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

  const handleAddItem = async () => {
    if (!newItem.sku.trim() || !newItem.product_name.trim()) {
      toast.error("SKU y nombre del producto son requeridos");
      return;
    }

    setSaving(true);
    try {
      // Use 'as any' since types may not be updated yet
      const { error } = await (supabase as any).from("inventory").insert({
        client_user_id: user?.id,
        sku: newItem.sku.trim().toUpperCase(),
        product_name: newItem.product_name.trim(),
        stock_available: newItem.stock_available,
        price: newItem.price,
        low_stock_threshold: newItem.low_stock_threshold,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un producto con ese SKU");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Producto agregado al inventario");
      setShowAddModal(false);
      setNewItem({
        sku: "",
        product_name: "",
        stock_available: 0,
        price: 0,
        low_stock_threshold: 5,
      });
      fetchInventory();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Error al agregar producto");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    try {
      // Use 'as any' since types may not be updated yet
      const { error } = await (supabase as any)
        .from("inventory")
        .update({
          sku: editingItem.sku.trim().toUpperCase(),
          product_name: editingItem.product_name.trim(),
          stock_available: editingItem.stock_available,
          price: editingItem.price,
          low_stock_threshold: editingItem.low_stock_threshold,
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
      // Use 'as any' since types may not be updated yet
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
          Agregar Producto
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
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

        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
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

        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
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

        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
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
          className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por SKU o nombre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Inventory Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery ? "No hay productos que coincidan" : "Aún no tienes productos en inventario"}
          </p>
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
                  "rounded-xl border bg-card p-4 transition-all hover:shadow-lg",
                  isOutOfStock
                    ? "border-destructive/50 bg-destructive/5"
                    : isLowStock
                    ? "border-orange-500/50 bg-orange-500/5"
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-mono">
                      {item.sku}
                    </p>
                    <h3 className="font-semibold text-foreground truncate">
                      {item.product_name}
                    </h3>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={cn(
                        "text-2xl font-bold",
                        isOutOfStock
                          ? "text-destructive"
                          : isLowStock
                          ? "text-orange-500"
                          : "text-foreground"
                      )}
                    >
                      {item.stock_available}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      unidades
                    </span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatCOP(item.price)}
                  </span>
                </div>

                {isLowStock && (
                  <div
                    className={cn(
                      "mt-3 flex items-center gap-1 text-xs font-medium",
                      isOutOfStock ? "text-destructive" : "text-orange-500"
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {isOutOfStock ? "¡Agotado!" : "Stock bajo"}
                  </div>
                )}

                {/* Create Order Button */}
                {!isOutOfStock && (
                  <motion.button
                    onClick={() => {
                      setOrderPrefill({
                        inventoryItemId: item.id,
                        productName: item.product_name,
                        price: item.price,
                        quantity: 1,
                        sku: item.sku,
                      });
                      setShowOrderModal(true);
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Crear Orden
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-card shadow-xl p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Agregar Producto</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    SKU *
                  </label>
                  <input
                    type="text"
                    placeholder="ej: CAMISETA-001"
                    value={newItem.sku}
                    onChange={(e) =>
                      setNewItem({ ...newItem, sku: e.target.value })
                    }
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    placeholder="ej: Camiseta Negra Talla M"
                    value={newItem.product_name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, product_name: e.target.value })
                    }
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newItem.stock_available}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          stock_available: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
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
                      value={newItem.price}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Umbral de Stock Bajo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.low_stock_threshold}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        low_stock_threshold: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se mostrará alerta cuando el stock sea menor o igual a este
                    valor
                  </p>
                </div>

                <button
                  onClick={handleAddItem}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Producto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-card shadow-xl p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Editar Producto</h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
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
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
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
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
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
                      className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
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
                      className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                    />
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
                    className="w-full mt-1 rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleUpdateItem}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Actualizar Producto
                </button>
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

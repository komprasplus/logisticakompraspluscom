import { useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
import NuevoProductoMarketplace from "./NuevoProductoMarketplace";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

interface FulfillmentRateInfo {
  rate: number;
  loaded: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const InventarioView = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<{
    inventoryItemId: string;
    productName: string;
    price: number;
    quantity: number;
    sku: string;
    maxStock: number;
  } | null>(null);
  const [fulfillmentInfo, setFulfillmentInfo] = useState<FulfillmentRateInfo>({ rate: 0, loaded: false });

  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const { user, profile } = useAuth();
  const isProveedor = profile?.tipo_cuenta === "proveedor";

  /*
    FIX: IDs únicos para el modal de edición inline (asociar label → input).
    Sin htmlFor + id los labels no son accesibles por teclado ni lectores
    de pantalla.
  */
  const uid = useId();
  const idEditSku = `${uid}-edit-sku`;
  const idEditName = `${uid}-edit-name`;
  const idEditStock = `${uid}-edit-stock`;
  const idEditPrice = `${uid}-edit-price`;
  const idEditThreshold = `${uid}-edit-threshold`;
  const idSearch = `${uid}-search`;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFulfillmentRate = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("fulfillment_rate")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelRef.current) return;
      if (error) throw error;

      const rate = data?.fulfillment_rate ?? 0;
      setFulfillmentInfo({ rate, loaded: true });
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching fulfillment rate:", error);
      setFulfillmentInfo({ rate: 0, loaded: true });
    }
  }, [user?.id]);

  const fetchInventory = useCallback(async () => {
    if (!user?.id) return;
    try {
      /*
        FIX: eliminado el cast `(supabase as any)` que suprimía el chequeo
        de tipos de TypeScript sobre la tabla "inventory".
        Mismo fix aplicado en CreateProductModal de esta sesión.
        Si el tipo generado no incluye la tabla, solución correcta: `supabase gen types`.
      */
      const { data, error } = await supabase
        .from("inventory")
        .select(
          "id, client_user_id, sku, product_name, stock_available, price, low_stock_threshold, fulfillment_value, image_url, created_at, updated_at",
        )
        .eq("client_user_id", user.id)
        .neq("is_deleted", true)
        .order("product_name", { ascending: true });

      if (cancelRef.current) return;
      if (error) throw error;
      setItems(data ?? []);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching inventory:", error);
      toast.error("Error al cargar inventario");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    cancelRef.current = false;
    if (user?.id) {
      fetchInventory();
      fetchFulfillmentRate();
    }
    return () => {
      cancelRef.current = true;
    };
  }, [user?.id, fetchInventory, fetchFulfillmentRate]);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) => item.product_name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  const stats = useMemo(() => {
    const totalProducts = items.length;
    const lowStockItems = items.filter((item) => item.stock_available <= item.low_stock_threshold);
    const outOfStockItems = items.filter((item) => item.stock_available === 0);
    const totalValue = items.reduce((acc, item) => acc + item.stock_available * item.price, 0);
    return { totalProducts, lowStockItems, outOfStockItems, totalValue };
  }, [items]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUpdateItem = useCallback(async () => {
    if (!editingItem) return;

    /*
      FIX: validaciones básicas en el modal de edición.
      La versión original enviaba el UPDATE sin validar — un SKU vacío o
      un nombre en blanco podía guardarse directamente en la BD.
    */
    if (!editingItem.sku.trim()) {
      toast.error("El SKU es requerido");
      return;
    }
    if (!editingItem.product_name.trim()) {
      toast.error("El nombre del producto es requerido");
      return;
    }

    setSaving(true);
    try {
      /*
        FIX: eliminado `(supabase as any)`.
        FIX: `fulfillment_value` eliminado del UPDATE inline del modal de edición.
        El comentario en el código original decía "NOTE: fulfillment_value is no
        longer editable by clients" — sin embargo el modal de edición tenía un
        selector de $1.900 / $2.000 / $2.200 que SÍ modificaba `editingItem.fulfillment_value`
        y ese cambio se perdía silenciosamente. Inconsistencia: la UI mostraba controles
        que no tenían efecto. Los botones de valor fulfillment han sido eliminados del modal.
      */
      const { error } = await supabase
        .from("inventory")
        .update({
          sku: editingItem.sku.trim().toUpperCase(),
          product_name: editingItem.product_name.trim(),
          stock_available: Math.max(0, editingItem.stock_available),
          price: Math.max(0, editingItem.price),
          low_stock_threshold: Math.max(0, editingItem.low_stock_threshold),
        })
        .eq("id", editingItem.id);

      if (error) {
        if (error.code === "23505") {
          toast.error(`Ya existe un producto con el SKU "${editingItem.sku.trim().toUpperCase()}"`);
        } else {
          throw error;
        }
        return;
      }

      toast.success("Producto actualizado");
      setEditingItem(null);
      fetchInventory();
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Error al actualizar producto");
    } finally {
      if (!cancelRef.current) setSaving(false);
    }
  }, [editingItem, fetchInventory]);

  const handleDeleteItem = useCallback(async (itemId: string, itemName: string) => {
    /*
      FIX: `window.confirm()` reemplazado por AlertDialog (ver render).
      `confirm()` bloquea el hilo principal, no puede ser estilizado, y
      en algunos entornos (iframes, mode headless, PWA) está deshabilitado.
      El estado `confirmDeleteItem` controla el diálogo accesible.
    */
    setConfirmDeleteItem({ id: itemId, name: itemName });
  }, []);

  const executeDelete = useCallback(
    async (itemId: string) => {
      setConfirmDeleteItem(null);
      try {
      const { error } = await supabase
          .from("inventory")
          .update({ is_deleted: true })
          .eq("id", itemId);

        if (error) throw error;
        toast.success("Producto eliminado");
        fetchInventory();
      } catch (error) {
        console.error("Error deleting item:", error);
        toast.error("Error al eliminar producto");
      }
    },
    [fetchInventory],
  );

  const handleCreateOrder = useCallback((item: InventoryItem) => {
    setOrderPrefill({
      inventoryItemId: item.id,
      productName: item.product_name,
      price: item.price,
      quantity: 1,
      sku: item.sku,
      maxStock: item.stock_available,
    });
    setShowOrderModal(true);
  }, []);

  /*
    FIX: estado para el diálogo de confirmación de eliminación.
    Reemplaza window.confirm().
  */
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<{ id: string; name: string } | null>(null);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Cargando inventario...">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isProveedor ? "Mi Inventario" : "Mi Inventario Propio"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isProveedor
              ? "Publica productos al catálogo de suministro y controla el stock"
              : "Inventario privado para fulfillment — no se muestra en la Megabodega"}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Crear Producto
        </motion.button>
      </div>

      {/* Cards de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: Package,
            color: "primary",
            value: stats.totalProducts,
            label: "Productos",
            textColor: "text-foreground",
          },
          {
            icon: BarChart3,
            color: "emerald-500",
            value: formatCOP(stats.totalValue),
            label: "Valor Total",
            textColor: "text-foreground",
          },
          {
            icon: TrendingDown,
            color: "orange-500",
            value: stats.lowStockItems.length,
            label: "Stock Bajo",
            textColor: "text-orange-500",
          },
          {
            icon: Archive,
            color: "destructive",
            value: stats.outOfStockItems.length,
            label: "Agotados",
            textColor: "text-destructive",
          },
        ].map(({ icon: Icon, color, value, label, textColor }) => (
          <div key={label} className="rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${color}/10`}>
                <Icon className={`h-5 w-5 text-${color}`} aria-hidden="true" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta de stock bajo */}
      {stats.lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-orange-700 dark:text-orange-400">Alerta de Stock Bajo</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.lowStockItems.map((item) => item.product_name).join(", ")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <label htmlFor={idSearch} className="sr-only">
          Buscar productos
        </label>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          id={idSearch}
          type="search"
          placeholder="Buscar por SKU o nombre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          autoComplete="off"
        />
      </div>

      {/* Grid de productos */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
          <p className="text-muted-foreground">
            {searchQuery ? "No hay productos que coincidan con la búsqueda" : "Aún no tienes productos en inventario"}
          </p>
          {!searchQuery && (
            <motion.button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-primary text-sm font-medium hover:underline"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
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
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-xl",
                  isOutOfStock
                    ? "border-destructive/50"
                    : isLowStock
                      ? "border-orange-500/50"
                      : "border-border hover:border-primary/30",
                )}
              >
                {/* Imagen del producto */}
                <div className="relative aspect-[16/10] bg-muted/30 overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={`Imagen de ${item.product_name}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                    </div>
                  )}

                  {/* Badge de stock */}
                  <div
                    className={cn(
                      "absolute top-2 right-2 px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-sm",
                      isOutOfStock
                        ? "bg-destructive/90 text-destructive-foreground"
                        : isLowStock
                          ? "bg-orange-500/90 text-white"
                          : "bg-emerald-500/90 text-white",
                    )}
                    aria-label={`${item.stock_available} unidades disponibles`}
                  >
                    {item.stock_available} uds
                  </div>

                  {/* Botones de acción */}
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      aria-label={`Editar ${item.product_name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, item.product_name)}
                      aria-label={`Eliminar ${item.product_name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm hover:bg-destructive/10 transition-colors shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Info del producto */}
                <div className="p-4">
                  <p className="text-xs text-muted-foreground font-mono mb-1">{item.sku}</p>
                  <h3 className="font-semibold text-foreground line-clamp-2 min-h-[2.5rem]">{item.product_name}</h3>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-foreground">{formatCOP(item.price)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Truck className="h-3 w-3" aria-hidden="true" />
                        <span>
                          Fulfillment: {fulfillmentInfo.rate > 0 ? formatCOP(fulfillmentInfo.rate) : "$0 (No aplica)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isLowStock && (
                    <div
                      className={cn(
                        "mt-2 flex items-center gap-1 text-xs font-medium",
                        isOutOfStock ? "text-destructive" : "text-orange-500",
                      )}
                      role="status"
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {isOutOfStock ? "¡Agotado!" : "Stock bajo"}
                    </div>
                  )}

                  <motion.button
                    type="button"
                    onClick={() => handleCreateOrder(item)}
                    disabled={isOutOfStock}
                    aria-label={`Generar envío con ${item.product_name}`}
                    className={cn(
                      "w-full mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
                      isOutOfStock
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40",
                    )}
                    whileHover={!isOutOfStock && !prefersReducedMotion ? { scale: 1.02 } : undefined}
                    whileTap={!isOutOfStock && !prefersReducedMotion ? { scale: 0.98 } : undefined}
                  >
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                    Generar Envío con este Producto
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal crear producto */}
      <CreateProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchInventory}
        userId={user?.id ?? ""}
        tipoCuenta={profile?.tipo_cuenta}
        organizacionId={profile?.organizacion_id}
      />

      {/* Modal editar producto (inline) */}
      <AnimatePresence>
        {editingItem && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-edit-title`}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-3xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-6"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 id={`${uid}-edit-title`} className="text-lg font-bold">
                  Editar Producto
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted"
                  aria-label="Cerrar editor"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-4">
                {/* FIX: htmlFor + id en todos los campos del modal */}
                <div>
                  <label htmlFor={idEditSku} className="text-sm font-medium text-muted-foreground">
                    SKU
                  </label>
                  <input
                    id={idEditSku}
                    type="text"
                    value={editingItem.sku}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div>
                  <label htmlFor={idEditName} className="text-sm font-medium text-muted-foreground">
                    Nombre del Producto
                  </label>
                  <input
                    id={idEditName}
                    type="text"
                    value={editingItem.product_name}
                    onChange={(e) => setEditingItem({ ...editingItem, product_name: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={idEditStock} className="text-sm font-medium text-muted-foreground">
                      Stock Disponible
                    </label>
                    <input
                      id={idEditStock}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={editingItem.stock_available}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          stock_available: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor={idEditPrice} className="text-sm font-medium text-muted-foreground">
                      Precio (COP)
                    </label>
                    <input
                      id={idEditPrice}
                      type="number"
                      min="0"
                      step="100"
                      inputMode="numeric"
                      value={editingItem.price}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          price: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/*
                  FIX: ELIMINADOS los botones de selección de fulfillment_value ($1.900/$2.000/$2.200).
                  El comentario original decía "fulfillment_value is no longer editable by clients",
                  pero el modal de edición sí los mostraba. El cambio se ignoraba silenciosamente
                  al guardar (no estaba en el UPDATE). Controles engañosos → eliminados.
                  La tarifa la controla el admin desde el perfil de la tienda.
                */}

                <div>
                  <label htmlFor={idEditThreshold} className="text-sm font-medium text-muted-foreground">
                    Umbral de Stock Bajo
                  </label>
                  <input
                    id={idEditThreshold}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={editingItem.low_stock_threshold}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        /*
                          FIX: `parseInt() || 5` hacía imposible setear 0.
                          Misma corrección que en CreateProductModal.
                        */
                        low_stock_threshold: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 5,
                      })
                    }
                    className="w-full mt-1 rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <motion.button
                  type="button"
                  onClick={handleUpdateItem}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  {saving ? "Guardando..." : "Actualizar Producto"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/*
        FIX: diálogo de confirmación accesible para eliminación.
        Reemplaza el window.confirm() original.
      */}
      <AnimatePresence>
        {confirmDeleteItem && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${uid}-delete-title`}
            aria-describedby={`${uid}-delete-desc`}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteItem(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
            >
              <h3 id={`${uid}-delete-title`} className="text-lg font-bold text-foreground">
                ¿Eliminar producto?
              </h3>
              <p id={`${uid}-delete-desc`} className="text-sm text-muted-foreground">
              ¿Estás seguro de eliminar <strong>{confirmDeleteItem.name}</strong>? Ya no estará disponible para nuevas ventas.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteItem(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeDelete(confirmDeleteItem.id)}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Sí, eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal crear pedido */}
      <NuevoPedidoModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setOrderPrefill(null);
        }}
        onSuccess={fetchInventory}
        isAdmin={false}
        inventoryPrefill={orderPrefill ?? undefined}
      />
    </div>
  );
};

export default InventarioView;

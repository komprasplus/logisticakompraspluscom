import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Store, Package, CheckCircle2, Loader2, AlertCircle, ArrowLeft, User, Phone, Mail, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StoreLiquidacion {
  user_id: string;
  store_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  totalPendiente: number;
  pedidosCount: number;
}

interface PedidoLiquidacion {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  valor_recaudar: number | null;
  utilidad: number | null;
  fecha_creacion: string | null;
  motorizado_asignado: string | null;
}

interface StoreLiquidacionesPanelProps {
  onLiquidacionComplete?: () => void;
}

const StoreLiquidacionesPanel = ({ onLiquidacionComplete }: StoreLiquidacionesPanelProps) => {
  const [stores, setStores] = useState<StoreLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreLiquidacion | null>(null);
  const [storePedidos, setStorePedidos] = useState<PedidoLiquidacion[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoLiquidacion | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      // Get client user IDs
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      const clientIds = roles.map((r) => r.user_id);

      // Get client profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, store_name, email, phone, avatar_url")
        .in("user_id", clientIds)
        .eq("status", "activo");

      if (profilesError) throw profilesError;

      // Get liquidated orders (Entregado but not yet paid to client)
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select("client_user_id, valor_recaudar, utilidad")
        .eq("estado", "Liquidado")
        .in("client_user_id", clientIds);

      if (pedidosError) throw pedidosError;

      // Calculate totals per store
      const storeData: StoreLiquidacion[] = (profiles || []).map((profile) => {
        const clientPedidos = (pedidos || []).filter(
          (p) => p.client_user_id === profile.user_id
        );
        
        // Pending = sum of utilities from liquidated orders
        const totalPendiente = clientPedidos.reduce(
          (sum, p) => sum + (p.utilidad || 0), 
          0
        );

        return {
          user_id: profile.user_id,
          store_name: profile.store_name,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          totalPendiente,
          pedidosCount: clientPedidos.length,
        };
      });

      // Only show stores with pending balance
      setStores(storeData.filter((s) => s.totalPendiente > 0));
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Error al cargar las tiendas");
    } finally {
      setLoading(false);
    }
  };

  const fetchStorePedidos = async (store: StoreLiquidacion) => {
    setLoadingPedidos(true);
    setSelectedStore(store);

    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, valor_recaudar, utilidad, fecha_creacion, motorizado_asignado")
        .eq("client_user_id", store.user_id)
        .eq("estado", "Liquidado")
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setStorePedidos(data || []);
    } catch (error) {
      console.error("Error fetching store pedidos:", error);
      toast.error("Error al cargar los pedidos");
    } finally {
      setLoadingPedidos(false);
    }
  };

  const handleLiquidarPedido = async () => {
    if (!selectedPedido) return;

    setProcessing(selectedPedido.id);
    setConfirmDialogOpen(false);

    try {
      // Mark as "Pagado" (paid to client)
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Pagado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", selectedPedido.id);

      if (error) throw error;

      toast.success(`Pedido ${selectedPedido.numero_guia || selectedPedido.id} liquidado`);
      
      // Refresh data
      setStorePedidos(prev => prev.filter(p => p.id !== selectedPedido.id));
      
      // Update store totals
      if (selectedStore) {
        setSelectedStore({
          ...selectedStore,
          totalPendiente: selectedStore.totalPendiente - (selectedPedido.utilidad || 0),
          pedidosCount: selectedStore.pedidosCount - 1,
        });
      }

      // Refresh stores list
      await fetchStores();
      onLiquidacionComplete?.();
    } catch (error) {
      console.error("Error liquidating:", error);
      toast.error("Error al procesar la liquidación");
    } finally {
      setProcessing(null);
      setSelectedPedido(null);
    }
  };

  const handleLiquidarTodos = async () => {
    if (!selectedStore || storePedidos.length === 0) return;

    setProcessing(-1); // -1 indicates "liquidar todos"

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Pagado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", storePedidos.map(p => p.id));

      if (error) throw error;

      toast.success(`${storePedidos.length} pedidos liquidados para ${selectedStore.store_name || selectedStore.full_name}`);
      
      setStorePedidos([]);
      setSelectedStore(null);
      await fetchStores();
      onLiquidacionComplete?.();
    } catch (error) {
      console.error("Error bulk liquidating:", error);
      toast.error("Error al procesar la liquidación masiva");
    } finally {
      setProcessing(null);
    }
  };

  const totalGlobal = stores.reduce((sum, s) => sum + s.totalPendiente, 0);
  const totalPedidosGlobal = stores.reduce((sum, s) => sum + s.pedidosCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Detail view for a single store
  if (selectedStore) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedStore(null);
            setStorePedidos([]);
          }}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Tiendas
        </Button>

        {/* Store Header Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 border border-primary/20">
          <div className="flex items-center gap-4">
            {selectedStore.avatar_url ? (
              <img
                src={selectedStore.avatar_url}
                alt={selectedStore.store_name || ""}
                className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <Store className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">
                {selectedStore.store_name || selectedStore.full_name}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {selectedStore.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {selectedStore.email}
                  </span>
                )}
                {selectedStore.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {selectedStore.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
              <p className="text-2xl font-bold text-primary">
                ${selectedStore.totalPendiente.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {storePedidos.length > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={handleLiquidarTodos}
              disabled={processing === -1}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              {processing === -1 ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Liquidar Todos ({storePedidos.length})
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pedidos List */}
        {loadingPedidos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : storePedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Todo liquidado</h3>
            <p className="text-muted-foreground mt-1">No hay pedidos pendientes de pago</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storePedidos.map((pedido) => (
              <motion.div
                key={pedido.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {pedido.numero_guia || `#${pedido.id}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pedido.cliente_nombre || "Sin nombre"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pedido.fecha_creacion
                      ? new Date(pedido.fecha_creacion).toLocaleDateString("es-CO")
                      : "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Recaudo: <strong className="text-foreground">${(pedido.valor_recaudar || 0).toLocaleString("es-CO")}</strong>
                    </span>
                    <span className="text-green-600 font-medium">
                      Utilidad: ${(pedido.utilidad || 0).toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedPedido(pedido);
                    setConfirmDialogOpen(true);
                  }}
                  disabled={processing === pedido.id}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {processing === pedido.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Liquidar ${(pedido.utilidad || 0).toLocaleString("es-CO")}
                    </>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-teal-600" />
                Confirmar Pago
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedPedido && (
                  <div className="space-y-2 text-left">
                    <p>¿Confirmas el pago del pedido <strong>{selectedPedido.numero_guia || `#${selectedPedido.id}`}</strong>?</p>
                    <div className="bg-muted rounded-lg p-3">
                      <p><strong>Utilidad a pagar:</strong> ${(selectedPedido.utilidad || 0).toLocaleString("es-CO")}</p>
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLiquidarPedido} className="bg-teal-600 hover:bg-teal-700">
                Confirmar Pago
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    );
  }

  // Main view - Store cards grid
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Total a Pagar</span>
          </div>
          <p className="text-2xl font-bold">${totalGlobal.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Pedidos Pendientes</span>
          </div>
          <p className="text-2xl font-bold">{totalPedidosGlobal}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Tiendas con Saldo</span>
          </div>
          <p className="text-2xl font-bold">{stores.length}</p>
        </div>
      </div>

      {/* Store Cards */}
      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Todo al día</h3>
          <p className="text-muted-foreground mt-1">No hay pagos pendientes a tiendas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => (
            <motion.div
              key={store.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              onClick={() => fetchStorePedidos(store)}
              className="rounded-2xl bg-card border border-border p-5 shadow-md hover:shadow-xl cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                {/* Avatar/Logo */}
                {store.avatar_url ? (
                  <img
                    src={store.avatar_url}
                    alt={store.store_name || ""}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Store className="h-7 w-7 text-primary" />
                  </div>
                )}

                {/* Store Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">
                    {store.store_name || store.full_name}
                  </h3>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {store.full_name}
                    </p>
                    {store.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {store.phone}
                      </p>
                    )}
                    {store.email && (
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {store.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Metrics Row */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {store.pedidosCount} pedido{store.pedidosCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  ${store.totalPendiente.toLocaleString("es-CO")}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default StoreLiquidacionesPanel;

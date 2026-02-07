import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Store, Package, CheckCircle2, Loader2, AlertCircle, ArrowLeft, TrendingUp, Truck, Banknote, RefreshCw } from "lucide-react";
import RegistrarPagoModal from "@/components/admin/RegistrarPagoModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  totalRecaudado: number;
  costoEnvios: number;
  netoAPagar: number;
  pedidosCount: number;
  pedidoIds: number[];
}

interface StoreLiquidacionesPanelProps {
  onLiquidacionComplete?: () => void;
}

const StoreLiquidacionesPanel = ({ onLiquidacionComplete }: StoreLiquidacionesPanelProps) => {
  const [stores, setStores] = useState<StoreLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreLiquidacion | null>(null);
  const [showPagoModal, setShowPagoModal] = useState(false);

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

      // Get liquidated orders (orders ready to be paid to client)
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select("id, client_user_id, valor_recaudar, valor_flete, utilidad")
        .eq("estado", "Liquidado")
        .in("client_user_id", clientIds);

      if (pedidosError) throw pedidosError;

      // Calculate totals per store
      const storeData: StoreLiquidacion[] = (profiles || []).map((profile) => {
        const clientPedidos = (pedidos || []).filter(
          (p) => p.client_user_id === profile.user_id
        );
        
        // Total recaudado de los pedidos
        const totalRecaudado = clientPedidos.reduce(
          (sum, p) => sum + (p.valor_recaudar || 0), 
          0
        );

        // Total costo de envíos (fletes)
        const costoEnvios = clientPedidos.reduce(
          (sum, p) => sum + (p.valor_flete || 0),
          0
        );

        // Neto a pagar = Utilidad de la tienda
        const netoAPagar = clientPedidos.reduce(
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
          totalRecaudado,
          costoEnvios,
          netoAPagar,
          pedidosCount: clientPedidos.length,
          pedidoIds: clientPedidos.map(p => p.id),
        };
      });

      // Only show stores with pending balance
      setStores(storeData.filter((s) => s.netoAPagar > 0));
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast.error("Error al cargar las tiendas");
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidar = async () => {
    if (!selectedStore) return;

    setProcessing(selectedStore.user_id);
    setConfirmDialogOpen(false);

    try {
      // Mark all orders as "Pagado" (paid to client)
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Pagado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", selectedStore.pedidoIds);

      if (error) throw error;

      toast.success(
        `Pago completado para ${selectedStore.store_name || selectedStore.full_name}`,
        {
          description: `${selectedStore.pedidosCount} pedidos - Neto pagado: $${selectedStore.netoAPagar.toLocaleString("es-CO")}`,
        }
      );

      // Refresh data
      await fetchStores();
      onLiquidacionComplete?.();
    } catch (error) {
      console.error("Error liquidating:", error);
      toast.error("Error al procesar el pago");
    } finally {
      setProcessing(null);
      setSelectedStore(null);
    }
  };

  const openConfirmDialog = (store: StoreLiquidacion) => {
    setSelectedStore(store);
    setConfirmDialogOpen(true);
  };

  const totalRecaudadoGlobal = stores.reduce((sum, s) => sum + s.totalRecaudado, 0);
  const totalCostoEnvios = stores.reduce((sum, s) => sum + s.costoEnvios, 0);
  const totalNetoGlobal = stores.reduce((sum, s) => sum + s.netoAPagar, 0);
  const totalPedidosGlobal = stores.reduce((sum, s) => sum + s.pedidosCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Liquidaciones de Tiendas</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); fetchStores(); }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPagoModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Banknote className="h-4 w-4" />
            Registrar Pago Realizado
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Total Recaudado</span>
          </div>
          <p className="text-xl font-bold">${totalRecaudadoGlobal.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Truck className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Costo Envíos</span>
          </div>
          <p className="text-xl font-bold">${totalCostoEnvios.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Neto a Pagar</span>
          </div>
          <p className="text-xl font-bold">${totalNetoGlobal.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Pedidos</span>
          </div>
          <p className="text-xl font-bold">{totalPedidosGlobal}</p>
        </div>
      </div>

      {/* Stores Table */}
      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Todo al día</h3>
          <p className="text-muted-foreground mt-1">No hay pagos pendientes a tiendas</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap">Tienda</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Entregados</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Total Recaudado</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Costo Envíos</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Neto a Pagar</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.user_id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {store.avatar_url ? (
                          <img
                            src={store.avatar_url}
                            alt={store.store_name || ""}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Store className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-foreground block truncate">
                            {store.store_name || store.full_name}
                          </span>
                          {store.email && (
                            <span className="text-xs text-muted-foreground truncate block">{store.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700">
                        <Package className="h-3.5 w-3.5" />
                        {store.pedidosCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                      ${store.totalRecaudado.toLocaleString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-orange-600 font-medium">
                        ${store.costoEnvios.toLocaleString("es-CO")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-lg font-bold text-emerald-600">
                        ${store.netoAPagar.toLocaleString("es-CO")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => openConfirmDialog(store)}
                        disabled={processing === store.user_id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 whitespace-nowrap"
                      >
                        {processing === store.user_id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="hidden sm:inline">Procesando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Cerrar Liquidación</span>
                            <span className="sm:hidden">Cerrar</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Confirmar Pago a Tienda
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedStore && (
                <div className="space-y-3 text-left">
                  <p>¿Confirmas el pago a <strong>{selectedStore.store_name || selectedStore.full_name}</strong>?</p>
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Pedidos entregados:</span>
                      <strong>{selectedStore.pedidosCount}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total recaudado:</span>
                      <strong>${selectedStore.totalRecaudado.toLocaleString("es-CO")}</strong>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>Costo de envíos (-):</span>
                      <strong>${selectedStore.costoEnvios.toLocaleString("es-CO")}</strong>
                    </div>
                    <hr className="border-border" />
                    <div className="flex justify-between text-lg font-bold text-emerald-600">
                      <span>Neto a pagar:</span>
                      <span>${selectedStore.netoAPagar.toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Los pedidos cambiarán a estado "Pagado" y el saldo quedará en cero.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLiquidar} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Registrar Pago Modal */}
      <RegistrarPagoModal
        open={showPagoModal}
        onOpenChange={setShowPagoModal}
        onPaymentComplete={() => {
          fetchStores();
          onLiquidacionComplete?.();
        }}
      />
    </motion.div>
  );
};

export default StoreLiquidacionesPanel;

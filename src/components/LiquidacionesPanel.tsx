import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, User, Package, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
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

interface MotorizadoLiquidacion {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  totalRecaudar: number;
  pedidosCount: number;
  pedidoIds: number[];
}

interface LiquidacionesPanelProps {
  onLiquidacionComplete?: () => void;
}

const LiquidacionesPanel = ({ onLiquidacionComplete }: LiquidacionesPanelProps) => {
  const [liquidaciones, setLiquidaciones] = useState<MotorizadoLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedMotorizado, setSelectedMotorizado] = useState<MotorizadoLiquidacion | null>(null);

  useEffect(() => {
    fetchLiquidaciones();
  }, []);

  const fetchLiquidaciones = async () => {
    try {
      // Get all motorizados
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setLiquidaciones([]);
        setLoading(false);
        return;
      }

      const motorizadoIds = roles.map((r) => r.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", motorizadoIds)
        .eq("status", "activo");

      if (profilesError) throw profilesError;

      // Get pending orders (Entregado with COD, not yet liquidated)
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select("*")
        .eq("estado", "Entregado")
        .eq("metodo_pago", "efectivo")
        .not("motorizado_asignado", "is", null);

      if (pedidosError) throw pedidosError;

      // Calculate totals per motorizado
      const liquidacionData: MotorizadoLiquidacion[] = (profiles || []).map((profile) => {
        const motorizadoPedidos = (pedidos || []).filter(
          (p) => p.motorizado_asignado === profile.full_name
        );
        
        const totalRecaudar = motorizadoPedidos.reduce(
          (sum, p) => sum + (p.valor_recaudar || 0), 
          0
        );

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          totalRecaudar,
          pedidosCount: motorizadoPedidos.length,
          pedidoIds: motorizadoPedidos.map((p) => p.id),
        };
      });

      // Only show motorizados with pending cash
      setLiquidaciones(liquidacionData.filter((l) => l.totalRecaudar > 0));
    } catch (error) {
      console.error("Error fetching liquidaciones:", error);
      toast.error("Error al cargar las liquidaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidar = async () => {
    if (!selectedMotorizado) return;

    setProcessing(selectedMotorizado.id);
    setConfirmDialogOpen(false);

    try {
      // Update all pending orders to "Liquidado" status
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Liquidado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", selectedMotorizado.pedidoIds);

      if (error) throw error;

      toast.success(
        `Liquidación completada para ${selectedMotorizado.full_name}`,
        {
          description: `${selectedMotorizado.pedidosCount} pedidos por $${selectedMotorizado.totalRecaudar.toLocaleString("es-CO")}`,
        }
      );

      // Refresh data
      await fetchLiquidaciones();
      onLiquidacionComplete?.();
    } catch (error) {
      console.error("Error liquidating:", error);
      toast.error("Error al procesar la liquidación");
    } finally {
      setProcessing(null);
      setSelectedMotorizado(null);
    }
  };

  const openConfirmDialog = (motorizado: MotorizadoLiquidacion) => {
    setSelectedMotorizado(motorizado);
    setConfirmDialogOpen(true);
  };

  const totalPendiente = liquidaciones.reduce((sum, l) => sum + l.totalRecaudar, 0);
  const totalPedidosPendientes = liquidaciones.reduce((sum, l) => sum + l.pedidosCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Total Pendiente</span>
          </div>
          <p className="text-2xl font-bold">${totalPendiente.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Pedidos Pendientes</span>
          </div>
          <p className="text-2xl font-bold">{totalPedidosPendientes}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <User className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium opacity-90">Motorizados con Saldo</span>
          </div>
          <p className="text-2xl font-bold">{liquidaciones.length}</p>
        </div>
      </div>

      {/* Motorizados List */}
      {liquidaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Todo al día</h3>
          <p className="text-muted-foreground mt-1">No hay liquidaciones pendientes</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Motorizado</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground hidden sm:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Pedidos</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Total a Liquidar</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {liquidaciones.map((liquidacion) => (
                  <tr key={liquidacion.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-teal-600" />
                        </div>
                        <span className="font-medium text-foreground">{liquidacion.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden sm:table-cell">
                      {liquidacion.phone || "-"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                        <Package className="h-3.5 w-3.5" />
                        {liquidacion.pedidosCount}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-lg font-bold text-teal-600">
                        ${liquidacion.totalRecaudar.toLocaleString("es-CO")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => openConfirmDialog(liquidacion)}
                        disabled={processing === liquidacion.id}
                        className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                      >
                        {processing === liquidacion.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Liquidar
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-teal-600" />
              Confirmar Liquidación
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMotorizado && (
                <div className="space-y-2 text-left">
                  <p>¿Confirmas la liquidación de <strong>{selectedMotorizado.full_name}</strong>?</p>
                  <div className="bg-muted rounded-lg p-3 space-y-1">
                    <p><strong>Pedidos:</strong> {selectedMotorizado.pedidosCount}</p>
                    <p><strong>Total recaudado:</strong> ${selectedMotorizado.totalRecaudar.toLocaleString("es-CO")}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esta acción cambiará el estado de todos los pedidos a "Liquidado" y pondrá el saldo en cero.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLiquidar} className="bg-teal-600 hover:bg-teal-700">
              Confirmar Liquidación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default LiquidacionesPanel;
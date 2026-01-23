import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, User, Package, CheckCircle2, Loader2, AlertCircle, Bike, Banknote, TrendingUp, FileText } from "lucide-react";
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
import { exportLiquidacionPDF } from "@/lib/pdfExport";

interface MotorizadoLiquidacion {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  totalRecaudar: number;
  totalFletes: number;
  saldoABodega: number;
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
        
        // Total recaudado (lo que cobró al cliente)
        const totalRecaudar = motorizadoPedidos.reduce(
          (sum, p) => sum + (p.valor_recaudar || 0), 
          0
        );

        // Total fletes ganados por el motorizado
        const totalFletes = motorizadoPedidos.reduce(
          (sum, p) => sum + (p.valor_flete || 0),
          0
        );

        // Saldo a entregar a bodega = Recaudo Total - Fletes Ganados
        const saldoABodega = totalRecaudar - totalFletes;

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          totalRecaudar,
          totalFletes,
          saldoABodega,
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

      // Export PDF receipt
      exportLiquidacionPDF({
        tipo: "motorizado",
        nombre: selectedMotorizado.full_name,
        telefono: selectedMotorizado.phone,
        pedidosCount: selectedMotorizado.pedidosCount,
        totalRecaudado: selectedMotorizado.totalRecaudar,
        totalFletes: selectedMotorizado.totalFletes,
        saldoNeto: selectedMotorizado.saldoABodega,
        pedidoIds: selectedMotorizado.pedidoIds,
      });

      toast.success(
        `Liquidación completada para ${selectedMotorizado.full_name}`,
        {
          description: `${selectedMotorizado.pedidosCount} pedidos - Entrega a bodega: $${selectedMotorizado.saldoABodega.toLocaleString("es-CO")}`,
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

  const totalPendiente = liquidaciones.reduce((sum, l) => sum + l.saldoABodega, 0);
  const totalRecaudo = liquidaciones.reduce((sum, l) => sum + l.totalRecaudar, 0);
  const totalFletes = liquidaciones.reduce((sum, l) => sum + l.totalFletes, 0);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Recaudo Total</span>
          </div>
          <p className="text-xl font-bold">${totalRecaudo.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Bike className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Fletes Motoriz.</span>
          </div>
          <p className="text-xl font-bold">${totalFletes.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Banknote className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Saldo a Bodega</span>
          </div>
          <p className="text-xl font-bold">${totalPendiente.toLocaleString("es-CO")}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium opacity-90">Pedidos</span>
          </div>
          <p className="text-xl font-bold">{totalPedidosPendientes}</p>
        </div>
      </div>

      {/* Motorizados Table */}
      {liquidaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Todo al día</h3>
          <p className="text-muted-foreground mt-1">No hay liquidaciones pendientes</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap">Motorizado</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Entregados</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Recaudo Total</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Fletes Ganados</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Saldo a Bodega</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.map((liquidacion) => (
                  <TableRow key={liquidacion.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground block truncate">{liquidacion.full_name}</span>
                          {liquidacion.phone && (
                            <span className="text-xs text-muted-foreground">{liquidacion.phone}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700">
                        <Package className="h-3.5 w-3.5" />
                        {liquidacion.pedidosCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                      ${liquidacion.totalRecaudar.toLocaleString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-amber-600 font-medium">
                        ${liquidacion.totalFletes.toLocaleString("es-CO")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-lg font-bold text-teal-600">
                        ${liquidacion.saldoABodega.toLocaleString("es-CO")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => openConfirmDialog(liquidacion)}
                        disabled={processing === liquidacion.id}
                        className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 whitespace-nowrap"
                      >
                        {processing === liquidacion.id ? (
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
              <AlertCircle className="h-5 w-5 text-teal-600" />
              Confirmar Cierre de Liquidación
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMotorizado && (
                <div className="space-y-3 text-left">
                  <p>¿Confirmas el cierre de liquidación de <strong>{selectedMotorizado.full_name}</strong>?</p>
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Pedidos entregados:</span>
                      <strong>{selectedMotorizado.pedidosCount}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Recaudo total:</span>
                      <strong>${selectedMotorizado.totalRecaudar.toLocaleString("es-CO")}</strong>
                    </div>
                    <div className="flex justify-between text-amber-600">
                      <span>Fletes ganados (-):</span>
                      <strong>${selectedMotorizado.totalFletes.toLocaleString("es-CO")}</strong>
                    </div>
                    <hr className="border-border" />
                    <div className="flex justify-between text-lg font-bold text-teal-600">
                      <span>Entrega a bodega:</span>
                      <span>${selectedMotorizado.saldoABodega.toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Los pedidos cambiarán a estado "Liquidado" y el saldo quedará en cero.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLiquidar} className="bg-teal-600 hover:bg-teal-700">
              Confirmar Cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default LiquidacionesPanel;

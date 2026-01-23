import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Users,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Package,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Motorizado {
  user_id: string;
  full_name: string;
  phone: string | null;
  is_online: boolean | null;
}

interface BulkReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPedidoIds: number[];
  onSuccess: () => void;
}

const BulkReassignModal = ({
  isOpen,
  onClose,
  selectedPedidoIds,
  onSuccess,
}: BulkReassignModalProps) => {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [selectedMotorizado, setSelectedMotorizado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchMotorizados();
      setSelectedMotorizado(null);
      setProgress(0);
    }
  }, [isOpen]);

  const fetchMotorizados = async () => {
    setLoading(true);
    try {
      // Get motorizados from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone, is_online")
          .in("user_id", roles.map((r) => r.user_id))
          .eq("status", "activo");

        if (profilesError) throw profilesError;

        // Sort by online status first, then by name
        const sorted = (profiles || []).sort((a, b) => {
          if (a.is_online && !b.is_online) return -1;
          if (!a.is_online && b.is_online) return 1;
          return (a.full_name || "").localeCompare(b.full_name || "");
        });

        setMotorizados(sorted);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReassign = async () => {
    if (!selectedMotorizado) {
      toast.error("Selecciona un motorizado");
      return;
    }

    const moto = motorizados.find((m) => m.user_id === selectedMotorizado);
    if (!moto) return;

    setProcessing(true);
    setProgress(0);

    try {
      const timestamp = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
      });

      let successCount = 0;
      const total = selectedPedidoIds.length;

      for (let i = 0; i < selectedPedidoIds.length; i++) {
        const pedidoId = selectedPedidoIds[i];

        // Get current pedido data
        const { data: pedido } = await supabase
          .from("pedidos")
          .select("estado, motorizado_asignado, observaciones")
          .eq("id", pedidoId)
          .maybeSingle();

        if (!pedido) continue;

        const previousMoto = pedido.motorizado_asignado || "Sin asignar";
        const systemNote = `[SISTEMA ${timestamp}] Reasignación masiva: ${previousMoto} → ${moto.full_name}`;
        const updatedObs = pedido.observaciones
          ? `${pedido.observaciones}\n${systemNote}`
          : systemNote;

        // Keep "En Ruta" if already in transit, otherwise set to "Asignado"
        const newStatus = pedido.estado === "En Ruta" ? "En Ruta" : "Asignado";

        // Update the order
        const { error: updateError } = await supabase
          .from("pedidos")
          .update({
            motorizado_id: moto.user_id,
            motorizado_asignado: moto.full_name,
            estado: newStatus,
            observaciones: updatedObs,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", pedidoId);

        if (!updateError) {
          // Log the status change
          await supabase.from("pedido_status_logs").insert({
            pedido_id: pedidoId,
            estado_anterior: pedido.estado,
            estado_nuevo: newStatus,
            motivo: `Reasignación masiva a ${moto.full_name}`,
            usuario_nombre: "Admin",
          });
          successCount++;
        }

        setProgress(Math.round(((i + 1) / total) * 100));
      }

      toast.success(
        `✅ ${successCount} de ${total} pedidos reasignados a ${moto.full_name}`
      );
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error in bulk reassign:", error);
      toast.error("Error durante la reasignación masiva");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md neu-card border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Transferir Pedidos
          </DialogTitle>
          <DialogDescription>
            Reasignar {selectedPedidoIds.length} pedido(s) a un nuevo motorizado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selected count indicator */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {selectedPedidoIds.length} pedido(s) seleccionado(s)
              </p>
              <p className="text-xs text-muted-foreground">
                Serán transferidos al motorizado seleccionado
              </p>
            </div>
          </div>

          {/* Motorizado selection */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Seleccionar nuevo motorizado:
              </label>
              <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                {motorizados.map((moto) => (
                  <button
                    key={moto.user_id}
                    onClick={() => setSelectedMotorizado(moto.user_id)}
                    disabled={processing}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedMotorizado === moto.user_id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        moto.is_online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {moto.full_name}
                      </p>
                      {moto.phone && (
                        <p className="text-xs text-muted-foreground">
                          {moto.phone}
                        </p>
                      )}
                    </div>
                    {selectedMotorizado === moto.user_id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar during processing */}
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Procesando...</span>
                <span className="font-medium text-primary">{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBulkReassign}
              disabled={!selectedMotorizado || processing}
              className="flex-1 gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Transferir
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkReassignModal;

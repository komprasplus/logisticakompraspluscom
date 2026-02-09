import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, History, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
import { getStatusConfig } from "@/lib/orderStatuses";

// Status options available for admin manual editing
const ADMIN_STATUS_OPTIONS = [
  { value: "Recibido en Bodega", label: "Recibido en Bodega" },
  { value: "Asignado", label: "Asignado" },
  { value: "En Ruta", label: "En Ruta" },
  { value: "Entregado", label: "Entregado" },
  { value: "Novedad", label: "Novedad" },
  { value: "Rechazado", label: "Rechazado" },
  { value: "Devolución", label: "Devolución" },
  { value: "Liquidado", label: "Liquidado" },
  { value: "Anulado", label: "Anulado" },
];

interface AdminStatusEditorProps {
  pedidoId: number;
  currentStatus: string | null;
  onStatusChange: () => void;
}

const AdminStatusEditor = ({ pedidoId, currentStatus, onStatusChange }: AdminStatusEditorProps) => {
  const [newStatus, setNewStatus] = useState(currentStatus || "");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  const isRevertingFromEntregado = currentStatus === "Entregado" && newStatus !== "Entregado";
  const isRevertingFromLiquidado = currentStatus === "Liquidado" && newStatus !== "Liquidado";

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === currentStatus) {
      toast.error("Selecciona un estado diferente");
      return;
    }

    if (!motivo.trim()) {
      toast.error("Debes ingresar un motivo para el cambio");
      return;
    }

    setLoading(true);
    setShowConfirm(false);

    try {
      // Build the system comment for the store
      const systemComment = `[SISTEMA] ${new Date().toLocaleDateString("es-CO", { 
        day: "2-digit", 
        month: "short", 
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })} - Admin cambió estado de "${currentStatus}" a "${newStatus}". Motivo: ${motivo.trim()}`;

      // Update the order status and add system comment to observaciones
      const { data: currentOrder, error: fetchError } = await supabase
        .from("pedidos")
        .select("observaciones")
        .eq("id", pedidoId)
        .single();

      if (fetchError) throw fetchError;

      // Append system comment to existing observaciones
      const existingObs = currentOrder?.observaciones || "";
      const newObservaciones = existingObs 
        ? `${existingObs}\n\n${systemComment}`
        : systemComment;

      const updateData: any = {
        estado: newStatus,
        fecha_actualizacion: new Date().toISOString(),
        observaciones: newObservaciones,
      };

      // Clear delivery-specific fields if reverting from Entregado
      if (isRevertingFromEntregado) {
        updateData.foto_evidencia = null;
        updateData.foto_paquete = null;
        updateData.firma_cliente = null;
      }

      const { error: updateError } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", pedidoId);

      if (updateError) throw updateError;

      // Log the status change for audit
      const { error: logError } = await supabase
        .from("pedido_status_logs")
        .insert({
          pedido_id: pedidoId as unknown as number,
          estado_anterior: currentStatus,
          estado_nuevo: newStatus,
          usuario_id: user?.id,
          usuario_nombre: profile?.full_name || "Administrador",
          motivo: motivo.trim(),
        });

      if (logError) {
        console.error("Error logging status change:", logError);
      }

      // Fire outbound webhook notification (non-blocking)
      const { data: pedidoData } = await supabase
        .from("pedidos")
        .select("numero_guia, client_user_id")
        .eq("id", pedidoId)
        .maybeSingle();

      if (pedidoData?.client_user_id) {
        supabase.functions.invoke("notify-webhook", {
          body: {
            pedido_id: pedidoId,
            estado_anterior: currentStatus,
            estado_nuevo: newStatus,
            numero_guia: pedidoData.numero_guia,
            client_user_id: pedidoData.client_user_id,
          },
        }).catch((err) => console.warn("Webhook notification failed:", err));
      }

      toast.success("Estado actualizado exitosamente", {
        description: `Cambio registrado y notificado a la tienda`,
      });

      setMotivo("");
      onStatusChange();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isRevertingFromEntregado || isRevertingFromLiquidado) {
      setShowConfirm(true);
    } else {
      handleStatusChange();
    }
  };

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-orange-600" />
        <h3 className="font-semibold text-orange-900">Control Manual de Estado (Admin)</h3>
      </div>

      <div className="grid gap-3">
        <div>
          <Label className="text-sm text-orange-800">Nuevo Estado</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_STATUS_OPTIONS.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={option.value === currentStatus}
                >
                  {option.label}
                  {option.value === currentStatus && " (actual)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm text-orange-800">
            Motivo del cambio <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Error del motorizado al marcar como entregado..."
            className="bg-white resize-none"
            rows={2}
          />
        </div>

        {(isRevertingFromEntregado || isRevertingFromLiquidado) && (
          <div className="flex items-start gap-2 rounded-md bg-orange-100 p-2 text-xs text-orange-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {isRevertingFromEntregado 
                ? "Al revertir de 'Entregado', se eliminarán las fotos y firma del pedido. El saldo pendiente del motorizado se ajustará automáticamente."
                : "Al revertir de 'Liquidado', el pedido volverá a aparecer en el saldo pendiente del motorizado."
              }
            </span>
          </div>
        )}

        <Button 
          onClick={handleSubmit}
          disabled={loading || !newStatus || newStatus === currentStatus || !motivo.trim()}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Actualizando...
            </>
          ) : (
            "Guardar Cambio de Estado"
          )}
        </Button>
      </div>

      {/* Confirmation Dialog for Reversions */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Confirmar Reversión de Estado
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de cambiar el estado de <strong>"{currentStatus}"</strong> a <strong>"{newStatus}"</strong>.
              </p>
              {isRevertingFromEntregado && (
                <div className="bg-orange-50 rounded-md p-3 text-sm text-orange-800">
                  <p className="font-medium">Esta acción:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Eliminará las fotos de evidencia y firma del pedido</li>
                    <li>Restará el valor del recaudo del saldo pendiente del motorizado</li>
                    <li>Quedará registrada en el historial de auditoría</li>
                  </ul>
                </div>
              )}
              {isRevertingFromLiquidado && (
                <div className="bg-orange-50 rounded-md p-3 text-sm text-orange-800">
                  <p className="font-medium">Esta acción:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>El pedido volverá a aparecer como pendiente de liquidar</li>
                    <li>Quedará registrada en el historial de auditoría</li>
                  </ul>
                </div>
              )}
              <p className="text-sm font-medium">Motivo: {motivo}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStatusChange}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Confirmar Cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStatusEditor;

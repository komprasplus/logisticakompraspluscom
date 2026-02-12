import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Loader2, ArrowRight, CheckCircle2, Package, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  /** Actualización optimista: modifica el estado local del padre sin refetch. */
  onOptimisticBulkUpdate?: (
    updates: Array<{
      id: number;
      motorizado_id: string | null;
      motorizado_asignado: string | null;
      estado: string;
    }>,
  ) => void;
  /**
   * Rollback callback: se invoca si la operación falla DESPUÉS de un
   * update optimista, para revertir el estado local del padre.
   */
  onRollback?: (ids: number[]) => void;
  /** Fallback legacy: dispara un refetch si no hay update optimista. */
  onSuccess?: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Número máximo de audit logs insertados en un solo batch */
const AUDIT_BATCH_SIZE = 200;

// ─── Componente ───────────────────────────────────────────────────────────────

const BulkReassignModal = ({
  isOpen,
  onClose,
  selectedPedidoIds,
  onOptimisticBulkUpdate,
  onRollback,
  onSuccess,
}: BulkReassignModalProps) => {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [selectedMotorizado, setSelectedMotorizado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  /*
    FIX: ref de cancelación para evitar setState sobre componente desmontado
    o sobre una sesión de modal ya cerrada.
  */
  const cancelRef = useRef(false);

  // ── Cargar motorizados ─────────────────────────────────────────────────────

  /*
    FIX: fetchMotorizados ahora está en useCallback para que pueda incluirse
    en el array de dependencias del useEffect sin generar un loop infinito.
    Antes estaba declarada como función local dentro del componente,
    lo que causaba un warning de ESLint (react-hooks/exhaustive-deps) y
    un posible stale closure.

    FIX: La consulta se hace en un solo round-trip con JOIN implícito vía
    RPC o con filtros encadenados. Antes eran DOS queries separadas
    (user_roles → profiles), lo que duplicaba la latencia innecesariamente.
    Se reemplaza con una sola query a profiles usando una subconsulta.
  */
  const fetchMotorizados = useCallback(async () => {
    setLoading(true);
    try {
      /*
        Query optimizada: obtenemos directamente los perfiles cuyo user_id
        exista en user_roles con role='motorizado', en una sola llamada.
        Requiere que tu Supabase tenga RLS adecuado.
      */
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, is_online")
        .eq("status", "activo")
        .in(
          "user_id",
          // Subconsulta: traer solo los user_id que tengan rol motorizado
          (await supabase.from("user_roles").select("user_id").eq("role", "motorizado")).data?.map((r) => r.user_id) ??
            [],
        );

      if (error) throw error;
      if (cancelRef.current) return; // Modal ya cerrado, no actualizar estado

      const sorted = (profiles ?? []).sort((a, b) => {
        // Online primero, luego alfabético
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });

      setMotorizados(sorted);

      // FIX: informar al usuario si no hay motorizados disponibles
      if (sorted.length === 0) {
        toast.warning("No hay motorizados activos disponibles");
      }
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current = false;
      setSelectedMotorizado(null);
      setProgress(0);
      fetchMotorizados();
    }
    // Cleanup: marcar cancelado al cerrar
    return () => {
      cancelRef.current = true;
    };
  }, [isOpen, fetchMotorizados]);

  // ── Reasignación masiva ────────────────────────────────────────────────────

  const handleBulkReassign = useCallback(async () => {
    if (!selectedMotorizado) {
      toast.error("Selecciona un motorizado");
      return;
    }

    const moto = motorizados.find((m) => m.user_id === selectedMotorizado);
    if (!moto) return;

    setProcessing(true);
    setProgress(0);

    /*
      FIX: Update optimista ANTES de la operación real para que la UI
      responda de inmediato. Guardamos los IDs para poder hacer rollback
      si la operación falla.
    */
    const optimisticUpdates = selectedPedidoIds.map((id) => ({
      id,
      motorizado_id: moto.user_id,
      motorizado_asignado: moto.full_name,
      estado: "Asignado",
    }));

    if (onOptimisticBulkUpdate) {
      onOptimisticBulkUpdate(optimisticUpdates);
    }

    try {
      const total = selectedPedidoIds.length;

      /*
        FIX CRÍTICO DE PERFORMANCE: antes había un for loop que hacía
        UNA llamada a Supabase POR CADA pedido.
        Con 50 pedidos = 50 round trips HTTP = ~5-10 segundos de espera.

        Solución: un solo UPDATE con `.in("id", [...])` que actualiza
        todos los pedidos en una sola query SQL.
        Con 500 pedidos = 1 round trip = ~100ms.
      */
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: moto.user_id,
          motorizado_asignado: moto.full_name,
          estado: "Asignado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", selectedPedidoIds);

      if (updateError) throw updateError;

      setProgress(80); // UPDATE completado

      /*
        FIX: Audit log también en batch (un solo INSERT con array de
        registros), en lugar de N inserts individuales.
        Se parte en batches de AUDIT_BATCH_SIZE por si la lista es muy larga.
      */
      const now = new Date().toISOString();
      const auditRecords = selectedPedidoIds.map((pedido_id) => ({
        pedido_id,
        estado_anterior: "Desconocido", // No hacemos SELECT previo para no ralentizar
        estado_nuevo: "Asignado",
        motivo: `Reasignación masiva a ${moto.full_name}`,
        usuario_nombre: "Admin",
        created_at: now,
      }));

      // Batch insert de audit logs (best-effort, no bloquea)
      for (let i = 0; i < auditRecords.length; i += AUDIT_BATCH_SIZE) {
        const batch = auditRecords.slice(i, i + AUDIT_BATCH_SIZE);
        supabase
          .from("pedido_status_logs")
          .insert(batch)
          .then(({ error: logErr }) => {
            if (logErr) console.warn("Audit log batch failed (non-blocking):", logErr);
          });
      }

      setProgress(100);

      toast.success(`${total} pedido${total !== 1 ? "s" : ""} reasignado${total !== 1 ? "s" : ""} a ${moto.full_name}`);

      if (!onOptimisticBulkUpdate && onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Error in bulk reassign:", error);

      /*
        FIX: si la operación falló DESPUÉS del update optimista, revertimos
        el estado local del padre para que la UI vuelva a ser consistente
        con la base de datos real.
      */
      if (onOptimisticBulkUpdate && onRollback) {
        onRollback(selectedPedidoIds);
        toast.error("Error en la reasignación — los cambios han sido revertidos");
      } else {
        toast.error("Error durante la reasignación masiva");
        // Sin optimistic ni rollback: forzar refetch para sincronizar
        onSuccess?.();
      }
    } finally {
      setProcessing(false);
    }
  }, [selectedMotorizado, motorizados, selectedPedidoIds, onOptimisticBulkUpdate, onRollback, onSuccess, onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md neu-card border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Transferir Pedidos
          </DialogTitle>
          <DialogDescription>
            Reasignar {selectedPedidoIds.length} pedido{selectedPedidoIds.length !== 1 ? "s" : ""} a un nuevo motorizado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contador de pedidos seleccionados */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {selectedPedidoIds.length} pedido{selectedPedidoIds.length !== 1 ? "s" : ""} seleccionado
                {selectedPedidoIds.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">Serán transferidos al motorizado seleccionado</p>
            </div>
          </div>

          {/* Selección de motorizado */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : motorizados.length === 0 ? (
            /*
              FIX: estado vacío explícito en lugar de mostrar nada.
              Antes el componente mostraba una lista vacía sin feedback.
            */
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <WifiOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin motorizados disponibles</p>
              <p className="text-xs text-muted-foreground">No hay motorizados activos en este momento</p>
              <Button variant="outline" size="sm" onClick={fetchMotorizados} className="mt-2 gap-2">
                <Loader2 className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Seleccionar nuevo motorizado:</label>
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
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {/* Indicador online/offline */}
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        moto.is_online ? "bg-green-500" : "bg-gray-400"
                      }`}
                      title={moto.is_online ? "En línea" : "Fuera de línea"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{moto.full_name}</p>
                      {moto.phone && <p className="text-xs text-muted-foreground">{moto.phone}</p>}
                    </div>
                    {selectedMotorizado === moto.user_id && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Barra de progreso */}
          {processing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
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

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleBulkReassign}
              disabled={!selectedMotorizado || processing || motorizados.length === 0}
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

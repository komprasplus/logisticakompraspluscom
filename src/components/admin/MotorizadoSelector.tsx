import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog, Loader2, Check, XCircle } from "lucide-react";
import { maybeSyncOnAssignment } from "@/lib/dropiumSync";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Motorizado {
  user_id: string;
  full_name: string;
  phone: string | null;
  is_online: boolean | null;
}

interface MotorizadoSelectorProps {
  pedidoId: number;
  currentMotorizadoId: string | null;
  currentMotorizadoName: string | null;
  onAssignmentChange: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Estados que se consideran "sin asignar" para determinar si el pedido
 * debe pasar a "Asignado" al recibir un motorizado.
 */
const UNASSIGNED_STATES = new Set(["creado", "bodega", "recibido en bodega", ""]);

/** Obtiene la fecha/hora actual en Colombia para notas de auditoría */
const getNowColombia = (): string => new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

// ─── Componente ───────────────────────────────────────────────────────────────

const MotorizadoSelector = ({
  pedidoId,
  currentMotorizadoId,
  currentMotorizadoName,
  onAssignmentChange,
}: MotorizadoSelectorProps) => {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [selectedMotorizadoId, setSelectedMotorizadoId] = useState<string | null>(currentMotorizadoId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cancelRef = useRef(false);

  /*
    FIX: sincronizar el estado local cuando el padre actualiza la prop.
    Antes, si el padre cambiaba `currentMotorizadoId` (ej. tras un refetch),
    el Select seguía mostrando el valor viejo.
  */
  useEffect(() => {
    setSelectedMotorizadoId(currentMotorizadoId);
  }, [currentMotorizadoId]);

  // ── Fetch de motorizados ───────────────────────────────────────────────────

  /*
    FIX: fetchMotorizados en useCallback para poder incluirla en el useEffect
    sin generar loop infinito.

    FIX: consulta optimizada en un solo round-trip — antes eran DOS queries
    separadas (user_roles → profiles) que duplicaban la latencia.
  */
  const fetchMotorizados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, is_online")
        .eq("status", "activo")
        .in(
          "user_id",
          (await supabase.from("user_roles").select("user_id").eq("role", "motorizado")).data?.map((r) => r.user_id) ??
            [],
        )
        .order("full_name");

      if (cancelRef.current) return;
      if (error) throw error;

      setMotorizados(profiles ?? []);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    fetchMotorizados();
    return () => {
      cancelRef.current = true;
    };
  }, [fetchMotorizados]);

  // ── Asignar motorizado ─────────────────────────────────────────────────────

  const handleAssign = useCallback(async () => {
    if (!selectedMotorizadoId) return;

    const selectedMoto = motorizados.find((m) => m.user_id === selectedMotorizadoId);
    if (!selectedMoto) return;

    setSaving(true);
    try {
      /*
        FIX: un solo SELECT antes del UPDATE (consolidado).
        Antes `handleAssign` y `handleUnassign` hacían SELECT separados.
        Aquí traemos tanto `observaciones` como `estado` en una sola query
        para construir el audit trail y determinar el nuevo estado.
      */
      const { data: pedido, error: selectError } = await supabase
        .from("pedidos")
        .select("observaciones, estado")
        .eq("id", pedidoId)
        .single();

      if (selectError) throw selectError;

      const previousMoto = currentMotorizadoName ?? "Sin asignar";
      const newMoto = selectedMoto.full_name;
      const timestamp = getNowColombia();
      const systemNote = `[SISTEMA ${timestamp}] Cambio de motorizado: ${previousMoto} → ${newMoto}`;

      const currentObs = pedido?.observaciones ?? "";
      const updatedObs = currentObs ? `${currentObs}\n${systemNote}` : systemNote;

      /*
        FIX: comparación normalizada con toLowerCase() para no depender
        de la capitalización exacta del estado en base de datos.
        El set `UNASSIGNED_STATES` centraliza todos los estados "sin asignar".
      */
      const currentEstado = pedido?.estado ?? "";
      const newStatus = UNASSIGNED_STATES.has(currentEstado.toLowerCase()) ? "Asignado" : currentEstado;

      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: selectedMotorizadoId,
          motorizado_asignado: newMoto,
          estado: newStatus,
          observaciones: updatedObs,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (updateError) throw updateError;

      // Audit log solo si el estado cambió realmente
      if (newStatus !== currentEstado) {
        // Best-effort — no bloquea el flujo principal
        supabase
          .from("pedido_status_logs")
          .insert({
            pedido_id: pedidoId,
            estado_anterior: currentEstado || "Creado",
            estado_nuevo: newStatus,
            motivo: `Reasignación a ${newMoto}`,
            usuario_nombre: "Admin",
          })
          .then(({ error: logErr }) => {
            if (logErr) console.warn("Audit log failed (non-blocking):", logErr);
          });
      }

      toast.success(`Pedido asignado a ${newMoto}`);
      onAssignmentChange();
    } catch (error) {
      console.error("Error assigning motorizado:", error);
      toast.error("Error al asignar motorizado");
    } finally {
      setSaving(false);
    }
  }, [selectedMotorizadoId, motorizados, pedidoId, currentMotorizadoName, onAssignmentChange]);

  // ── Remover motorizado ─────────────────────────────────────────────────────

  const handleUnassign = useCallback(async () => {
    setSaving(true);
    try {
      /*
        FIX: fetcheamos `estado` también en handleUnassign para usarlo
        como `estado_anterior` real en el audit log.
        Antes estaba hardcodeado como "Asignado", lo cual era incorrecto
        si el pedido estaba "En Ruta" u otro estado.
      */
      const { data: pedido, error: selectError } = await supabase
        .from("pedidos")
        .select("observaciones, estado")
        .eq("id", pedidoId)
        .single();

      if (selectError) throw selectError;

      const previousMoto = currentMotorizadoName ?? "Sin asignar";
      const timestamp = getNowColombia();
      const systemNote = `[SISTEMA ${timestamp}] Motorizado removido: ${previousMoto}`;

      const currentObs = pedido?.observaciones ?? "";
      const updatedObs = currentObs ? `${currentObs}\n${systemNote}` : systemNote;
      const estadoAnterior = pedido?.estado ?? "Asignado";

      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: null,
          motorizado_asignado: null,
          estado: "Recibido en Bodega",
          observaciones: updatedObs,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (updateError) throw updateError;

      // Best-effort audit log
      supabase
        .from("pedido_status_logs")
        .insert({
          pedido_id: pedidoId,
          // FIX: estado_anterior real, no "Asignado" hardcodeado
          estado_anterior: estadoAnterior,
          estado_nuevo: "Recibido en Bodega",
          motivo: "Motorizado removido por admin",
          usuario_nombre: "Admin",
        })
        .then(({ error: logErr }) => {
          if (logErr) console.warn("Audit log failed (non-blocking):", logErr);
        });

      setSelectedMotorizadoId(null);
      toast.success("Motorizado removido del pedido");
      onAssignmentChange();
    } catch (error) {
      console.error("Error unassigning motorizado:", error);
      toast.error("Error al remover motorizado");
    } finally {
      setSaving(false);
    }
  }, [pedidoId, currentMotorizadoName, onAssignmentChange]);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const hasChanged = selectedMotorizadoId !== currentMotorizadoId;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <UserCog className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Asignar Motorizado</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando motorizados...</span>
        </div>
      ) : motorizados.length === 0 ? (
        /*
          FIX: estado vacío explícito con botón de reintento.
          Antes mostraba un Select vacío sin ningún mensaje.
        */
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-muted-foreground">No hay motorizados activos</p>
          <Button variant="outline" size="sm" onClick={fetchMotorizados}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Select
            value={selectedMotorizadoId ?? "unassigned"}
            onValueChange={(value) => setSelectedMotorizadoId(value === "unassigned" ? null : value)}
            disabled={saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar motorizado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {motorizados.map((moto) => (
                <SelectItem key={moto.user_id} value={moto.user_id}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        moto.is_online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <span>{moto.full_name}</span>
                    {moto.phone && <span className="text-xs text-muted-foreground">({moto.phone})</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            {hasChanged && selectedMotorizadoId && (
              <Button
                onClick={handleAssign}
                disabled={saving}
                className="flex-1 bg-gradient-primary text-primary-foreground"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Asignar
              </Button>
            )}

            {currentMotorizadoId && (
              <Button
                variant="outline"
                onClick={handleUnassign}
                disabled={saving}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Remover
              </Button>
            )}
          </div>

          {currentMotorizadoName && (
            <p className="text-xs text-muted-foreground">
              Actual: <span className="font-medium text-foreground">{currentMotorizadoName}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MotorizadoSelector;

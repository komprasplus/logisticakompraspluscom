import { useState, useEffect, useCallback, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Check, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { maybeSyncOnAssignment } from "@/lib/dropiumSync";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Motorizado {
  user_id: string;
  full_name: string;
  phone: string | null;
  is_online: boolean | null;
}

interface UpdatedPedidoFields {
  motorizado_id: string | null;
  motorizado_asignado: string | null;
  estado: string;
}

interface QuickReassignPopoverProps {
  pedidoId: number;
  currentMotorizadoId: string | null;
  currentMotorizadoName: string | null;
  currentStatus: string | null;
  /** Actualiza el estado local del padre sin refetch */
  onOptimisticUpdate?: (pedidoId: number, updates: UpdatedPedidoFields) => void;
  /** Legado: dispara refetch completo en el padre */
  onReassigned?: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * TTL del caché de motorizados en ms.
 * Evita refetch en cada apertura pero garantiza datos frescos
 * si hay cambios en la lista (nuevos motorizados, cambios de estado).
 */
const MOTO_CACHE_TTL_MS = 5 * 60_000; // 5 minutos

/**
 * Estados finales donde no tiene sentido reasignar.
 * FIX: Set con toLowerCase() para no depender de capitalización exacta.
 */
const FINAL_STATES = new Set(["cancelado", "entregado", "anulado", "liquidado"]);

// ─── Componente ───────────────────────────────────────────────────────────────

const QuickReassignPopover = ({
  pedidoId,
  currentMotorizadoId,
  currentMotorizadoName,
  currentStatus,
  onOptimisticUpdate,
  onReassigned,
}: QuickReassignPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const cancelRef = useRef(false);
  /*
    FIX: caché con TTL en lugar de flag permanente.
    Antes `motorizadosCachedRef.current = true` nunca se reseteaba —
    si un motorizado se conectaba/desconectaba la lista quedaba congelada
    para toda la sesión hasta reload de la página.
  */
  const cacheTimeRef = useRef<number>(0);

  // ── Fetch de motorizados ───────────────────────────────────────────────────

  /*
    FIX: fetchMotorizados en useCallback para incluirla en el useEffect.
    FIX: dos queries secuenciales consolidadas en una — misma optimización
    aplicada en MotorizadoSelector.
  */
  const fetchMotorizados = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const rolesRes = await supabase.from("user_roles").select("user_id").eq("role", "motorizado");

      if (rolesRes.error) throw rolesRes.error;

      const ids = rolesRes.data?.map((r) => r.user_id) ?? [];
      if (ids.length === 0) {
        if (!cancelRef.current) setMotorizados([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, is_online")
        .in("user_id", ids)
        .eq("status", "activo")
        .order("full_name");

      if (cancelRef.current) return;
      if (profilesError) throw profilesError;

      setMotorizados(profiles ?? []);
      cacheTimeRef.current = Date.now(); // Actualizar timestamp del caché
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
      setFetchError(true);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  /*
    FIX: fetchMotorizados incluida en dependencias del useEffect.
    FIX: caché con TTL — recarga si los datos tienen más de 5 minutos.
  */
  useEffect(() => {
    if (!open) return;
    const cacheAge = Date.now() - cacheTimeRef.current;
    const isCacheStale = cacheAge > MOTO_CACHE_TTL_MS || cacheTimeRef.current === 0;
    if (isCacheStale) {
      fetchMotorizados();
    }
  }, [open, fetchMotorizados]);

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, []);

  // ── Acción: reasignar ──────────────────────────────────────────────────────

  const handleReassign = useCallback(
    async (moto: Motorizado) => {
      if (moto.user_id === currentMotorizadoId) {
        setOpen(false);
        return;
      }

      setSaving(moto.user_id);

      const previousMoto = currentMotorizadoName ?? "Sin asignar";
      const newMoto = moto.full_name;
      /*
        FIX: lógica de nuevo estado más completa y normalizada.
        Antes solo preservaba "En Ruta", ignorando otros estados activos
        (ej. "Con Novedad") que tampoco deben resetear a "Asignado".
      */
      const currentNormalized = (currentStatus ?? "").toLowerCase();
      const activeStates = new Set(["en ruta", "con novedad", "intento fallido"]);
      const newStatus = activeStates.has(currentNormalized) ? currentStatus! : "Asignado";

      // Actualización optimista inmediata
      onOptimisticUpdate?.(pedidoId, {
        motorizado_id: moto.user_id,
        motorizado_asignado: moto.full_name,
        estado: newStatus,
      });

      try {
        const { error } = await supabase
          .from("pedidos")
          .update({
            motorizado_id: moto.user_id,
            motorizado_asignado: moto.full_name,
            estado: newStatus,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", pedidoId);

        if (error) throw error;

        // Audit log best-effort
        supabase
          .from("pedido_status_logs")
          .insert({
            pedido_id: pedidoId,
            estado_anterior: currentStatus ?? "Creado",
            estado_nuevo: newStatus,
            motivo: `Reasignado de ${previousMoto} a ${newMoto}`,
            usuario_nombre: "Administrador",
          })
          .then(({ error: logErr }) => {
            if (logErr) console.warn("Audit log insert failed (non-blocking):", logErr);
          });

        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Pedido #{pedidoId} reasignado</span>
            <span className="text-sm opacity-80">
              {previousMoto} → {newMoto}
            </span>
          </div>,
        );

        setOpen(false);
        if (!onOptimisticUpdate && onReassigned) onReassigned();
      } catch (error) {
        console.error("Error reassigning:", error);
        toast.error("Error al reasignar pedido");
        // Rollback optimista
        onOptimisticUpdate?.(pedidoId, {
          motorizado_id: currentMotorizadoId,
          motorizado_asignado: currentMotorizadoName,
          estado: currentStatus ?? "Creado",
        });
      } finally {
        setSaving(null);
      }
    },
    [currentMotorizadoId, currentMotorizadoName, currentStatus, pedidoId, onOptimisticUpdate, onReassigned],
  );

  // ── Acción: desasignar ─────────────────────────────────────────────────────

  const handleUnassign = useCallback(async () => {
    if (!currentMotorizadoId) {
      setOpen(false);
      return;
    }

    setSaving("unassign");

    const previousMoto = currentMotorizadoName ?? "Sin asignar";

    // Actualización optimista inmediata
    onOptimisticUpdate?.(pedidoId, {
      motorizado_id: null,
      motorizado_asignado: null,
      estado: "Recibido en Bodega",
    });

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: null,
          motorizado_asignado: null,
          estado: "Recibido en Bodega",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Audit log best-effort
      supabase
        .from("pedido_status_logs")
        .insert({
          pedido_id: pedidoId,
          /*
            FIX: estado_anterior real en vez de "Asignado" hardcodeado.
            Consistente con el fix aplicado en MotorizadoSelector.
          */
          estado_anterior: currentStatus ?? "Asignado",
          estado_nuevo: "Recibido en Bodega",
          motivo: `Motorizado ${previousMoto} removido`,
          usuario_nombre: "Administrador",
        })
        .then(({ error: logErr }) => {
          if (logErr) console.warn("Audit log insert failed (non-blocking):", logErr);
        });

      toast.success("Motorizado removido del pedido");
      setOpen(false);
      if (!onOptimisticUpdate && onReassigned) onReassigned();
    } catch (error) {
      console.error("Error unassigning:", error);
      toast.error("Error al remover motorizado");
      // Rollback optimista
      onOptimisticUpdate?.(pedidoId, {
        motorizado_id: currentMotorizadoId,
        motorizado_asignado: currentMotorizadoName,
        estado: currentStatus ?? "Asignado",
      });
    } finally {
      setSaving(null);
    }
  }, [currentMotorizadoId, currentMotorizadoName, currentStatus, pedidoId, onOptimisticUpdate, onReassigned]);

  // ── Guard: estado final ────────────────────────────────────────────────────

  /*
    FIX: normalización con toLowerCase() para no depender de capitalización.
    Antes `currentStatus === "Cancelado"` fallaba con "cancelado".
  */
  if (FINAL_STATES.has((currentStatus ?? "").toLowerCase())) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          title="Reasignar motorizado"
          aria-label={`Reasignar motorizado del pedido ${pedidoId}`}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0 neu-card border-0"
        style={{
          zIndex: 10020,
          boxShadow: "0 25px 50px -12px hsl(var(--foreground) / 0.25)",
        }}
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Reasignar Pedido #{pedidoId}
          </h4>
          {currentMotorizadoName && (
            <p className="text-xs text-muted-foreground mt-1">
              Actual: <span className="font-medium text-foreground">{currentMotorizadoName}</span>
            </p>
          )}
        </div>

        {/* Lista de motorizados */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : fetchError ? (
            /*
              FIX: estado de error con botón de reintento.
              Antes mostraba la lista vacía sin contexto de qué falló.
            */
            <div className="flex flex-col items-center justify-center py-6 gap-3 px-4 text-center">
              <p className="text-sm text-muted-foreground">Error al cargar motorizados</p>
              <Button variant="outline" size="sm" onClick={fetchMotorizados} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {motorizados.map((moto) => {
                const isCurrentMoto = moto.user_id === currentMotorizadoId;
                const isSaving = saving === moto.user_id;

                return (
                  <button
                    key={moto.user_id}
                    onClick={() => handleReassign(moto)}
                    disabled={saving !== null}
                    className={cn(
                      "w-full px-4 py-2.5 flex items-center gap-3 transition-colors text-left",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isCurrentMoto ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-foreground",
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                    ) : isCurrentMoto ? (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", isCurrentMoto && "text-primary")}>
                        {moto.full_name}
                      </p>
                      {moto.phone && <p className="text-xs text-muted-foreground truncate">{moto.phone}</p>}
                    </div>

                    {/* Indicador online */}
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full flex-shrink-0",
                        moto.is_online ? "bg-emerald-500" : "bg-muted-foreground/30",
                      )}
                      title={moto.is_online ? "En línea" : "Desconectado"}
                    />
                  </button>
                );
              })}

              {motorizados.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
                  <p className="text-sm text-muted-foreground">No hay motorizados activos</p>
                  <Button variant="outline" size="sm" onClick={fetchMotorizados} className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reintentar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acción: remover motorizado */}
        {currentMotorizadoId && (
          <div className="px-3 py-2 border-t border-border/50 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassign}
              disabled={saving !== null}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === "unassign" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remover motorizado (volver a Bodega)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default QuickReassignPopover;

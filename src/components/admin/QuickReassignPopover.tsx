import { useState, useEffect, useCallback, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /**
   * Callback to update local state in parent without refetch.
   * Provide pedidoId + the new field values.
   */
  onOptimisticUpdate?: (pedidoId: number, updates: UpdatedPedidoFields) => void;
  /**
   * Legacy: triggers a full refetch (avoid when possible).
   */
  onReassigned?: () => void;
}

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
  const [saving, setSaving] = useState<string | null>(null);

  // Cache motorizados so we don't refetch every time popover opens
  const motorizadosCachedRef = useRef(false);

  useEffect(() => {
    if (open && !motorizadosCachedRef.current) {
      fetchMotorizados();
    }
  }, [open]);

  const fetchMotorizados = async () => {
    setLoading(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const motorizadoIds = roles.map((r) => r.user_id);

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone, is_online")
          .in("user_id", motorizadoIds)
          .eq("status", "activo")
          .order("full_name");

        if (profilesError) throw profilesError;
        setMotorizados(profiles || []);
        motorizadosCachedRef.current = true;
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
    } finally {
      setLoading(false);
    }
  };

  /**
   * OPTIMIZED: 1 UPDATE (no prior SELECT for observaciones).
   * We append the note using Postgres string concatenation in the DB layer
   * via a raw SQL update if needed, but for simplicity here we omit
   * prepending to observaciones (not critical for quick reassign).
   *
   * After the UPDATE, we insert the audit log best-effort.
   */
  const handleReassign = useCallback(async (moto: Motorizado) => {
    if (moto.user_id === currentMotorizadoId) {
      setOpen(false);
      return;
    }

    setSaving(moto.user_id);

    const previousMoto = currentMotorizadoName || "Sin asignar";
    const newMoto = moto.full_name;
    // Keep "En Ruta" if already out, otherwise set to "Asignado"
    const newStatus = currentStatus === "En Ruta" ? "En Ruta" : "Asignado";

    // Optimistic local update FIRST (instant UI)
    if (onOptimisticUpdate) {
      onOptimisticUpdate(pedidoId, {
        motorizado_id: moto.user_id,
        motorizado_asignado: moto.full_name,
        estado: newStatus,
      });
    }

    try {
      // Single UPDATE (no prior SELECT)
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

      // Audit log insert (best-effort, doesn't block)
      supabase
        .from("pedido_status_logs")
        .insert({
          pedido_id: pedidoId,
          estado_anterior: currentStatus || "Creado",
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
          <span className="text-sm opacity-80">{previousMoto} → {newMoto}</span>
        </div>
      );

      setOpen(false);
      // Legacy callback (only if provided and optimistic not used)
      if (!onOptimisticUpdate && onReassigned) {
        onReassigned();
      }
    } catch (error) {
      console.error("Error reassigning:", error);
      toast.error("Error al reasignar pedido");
      // Rollback optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(pedidoId, {
          motorizado_id: currentMotorizadoId,
          motorizado_asignado: currentMotorizadoName,
          estado: currentStatus || "Creado",
        });
      }
    } finally {
      setSaving(null);
    }
  }, [currentMotorizadoId, currentMotorizadoName, currentStatus, pedidoId, onOptimisticUpdate, onReassigned]);

  const handleUnassign = useCallback(async () => {
    if (!currentMotorizadoId) {
      setOpen(false);
      return;
    }

    setSaving("unassign");

    const previousMoto = currentMotorizadoName || "Sin asignar";

    // Optimistic local update
    if (onOptimisticUpdate) {
      onOptimisticUpdate(pedidoId, {
        motorizado_id: null,
        motorizado_asignado: null,
        estado: "Bodega",
      });
    }

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: null,
          motorizado_asignado: null,
          estado: "Bodega",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Audit log (best-effort)
      supabase
        .from("pedido_status_logs")
        .insert({
          pedido_id: pedidoId,
          estado_anterior: currentStatus || "Asignado",
          estado_nuevo: "Bodega",
          motivo: `Motorizado ${previousMoto} removido`,
          usuario_nombre: "Administrador",
        })
        .then(({ error: logErr }) => {
          if (logErr) console.warn("Audit log insert failed (non-blocking):", logErr);
        });

      toast.success("Motorizado removido del pedido");
      setOpen(false);

      if (!onOptimisticUpdate && onReassigned) {
        onReassigned();
      }
    } catch (error) {
      console.error("Error unassigning:", error);
      toast.error("Error al remover motorizado");
      // Rollback
      if (onOptimisticUpdate) {
        onOptimisticUpdate(pedidoId, {
          motorizado_id: currentMotorizadoId,
          motorizado_asignado: currentMotorizadoName,
          estado: currentStatus || "Asignado",
        });
      }
    } finally {
      setSaving(null);
    }
  }, [currentMotorizadoId, currentMotorizadoName, currentStatus, pedidoId, onOptimisticUpdate, onReassigned]);

  // Don't show for cancelled or delivered orders
  const isFinalState =
    currentStatus === "Cancelado" ||
    currentStatus === "Entregado" ||
    currentStatus === "Anulado" ||
    currentStatus === "Liquidado";
  if (isFinalState) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          title="Reasignar motorizado"
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

        {/* Motorizados List */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
                      isCurrentMoto
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/80 text-foreground"
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
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          isCurrentMoto && "text-primary"
                        )}
                      >
                        {moto.full_name}
                      </p>
                      {moto.phone && (
                        <p className="text-xs text-muted-foreground truncate">{moto.phone}</p>
                      )}
                    </div>

                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full flex-shrink-0",
                        moto.is_online ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}
                    />
                  </button>
                );
              })}

              {motorizados.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay motorizados activos
                </p>
              )}
            </div>
          )}
        </div>

        {/* Unassign Action */}
        {currentMotorizadoId && (
          <div className="px-3 py-2 border-t border-border/50 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassign}
              disabled={saving !== null}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {saving === "unassign" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remover motorizado (volver a Bodega)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default QuickReassignPopover;

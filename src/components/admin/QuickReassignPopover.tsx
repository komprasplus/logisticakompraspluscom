import { useState, useEffect } from "react";
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

interface QuickReassignPopoverProps {
  pedidoId: number;
  currentMotorizadoId: string | null;
  currentMotorizadoName: string | null;
  currentStatus: string | null;
  onReassigned: () => void;
}

const QuickReassignPopover = ({
  pedidoId,
  currentMotorizadoId,
  currentMotorizadoName,
  currentStatus,
  onReassigned,
}: QuickReassignPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (open && motorizados.length === 0) {
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
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (moto: Motorizado) => {
    if (moto.user_id === currentMotorizadoId) {
      setOpen(false);
      return;
    }

    setSaving(moto.user_id);
    try {
      const timestamp = new Date().toLocaleString("es-CO");
      const previousMoto = currentMotorizadoName || "Sin asignar";
      const newMoto = moto.full_name;
      const systemNote = `[SISTEMA ${timestamp}] Reasignación: ${previousMoto} → ${newMoto} (Admin)`;

      // Get current order data
      const { data: pedido } = await supabase
        .from("pedidos")
        .select("observaciones, estado")
        .eq("id", pedidoId)
        .single();

      const currentObs = pedido?.observaciones || "";
      const updatedObs = currentObs ? `${currentObs}\n${systemNote}` : systemNote;

      // Keep "En Ruta" if already out, otherwise set to "Asignado"
      const newStatus = pedido?.estado === "En Ruta" ? "En Ruta" : "Asignado";

      // Update order
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: moto.user_id,
          motorizado_asignado: moto.full_name,
          estado: newStatus,
          observaciones: updatedObs,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Log status change
      await supabase.from("pedido_status_logs").insert({
        pedido_id: pedidoId,
        estado_anterior: pedido?.estado || "Creado",
        estado_nuevo: newStatus,
        motivo: `Reasignado de ${previousMoto} a ${newMoto}`,
        usuario_nombre: "Administrador",
      });

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Pedido #{pedidoId} reasignado</span>
          <span className="text-sm opacity-80">{previousMoto} → {newMoto}</span>
        </div>
      );

      setOpen(false);
      onReassigned();
    } catch (error) {
      console.error("Error reassigning:", error);
      toast.error("Error al reasignar pedido");
    } finally {
      setSaving(null);
    }
  };

  const handleUnassign = async () => {
    if (!currentMotorizadoId) {
      setOpen(false);
      return;
    }

    setSaving("unassign");
    try {
      const timestamp = new Date().toLocaleString("es-CO");
      const previousMoto = currentMotorizadoName || "Sin asignar";
      const systemNote = `[SISTEMA ${timestamp}] Motorizado removido: ${previousMoto} (Admin)`;

      const { data: pedido } = await supabase
        .from("pedidos")
        .select("observaciones")
        .eq("id", pedidoId)
        .single();

      const currentObs = pedido?.observaciones || "";
      const updatedObs = currentObs ? `${currentObs}\n${systemNote}` : systemNote;

      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: null,
          motorizado_asignado: null,
          estado: "Bodega",
          observaciones: updatedObs,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      await supabase.from("pedido_status_logs").insert({
        pedido_id: pedidoId,
        estado_anterior: currentStatus || "Asignado",
        estado_nuevo: "Bodega",
        motivo: `Motorizado ${previousMoto} removido`,
        usuario_nombre: "Administrador",
      });

      toast.success("Motorizado removido del pedido");
      setOpen(false);
      onReassigned();
    } catch (error) {
      console.error("Error unassigning:", error);
      toast.error("Error al remover motorizado");
    } finally {
      setSaving(null);
    }
  };

  // Don't show for cancelled or delivered orders
  const isFinalState = currentStatus === "Cancelado" || currentStatus === "Entregado" || currentStatus === "Anulado";
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
          boxShadow: "0 25px 50px -12px hsl(var(--foreground) / 0.25)"
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
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isCurrentMoto && "text-primary"
                      )}>
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

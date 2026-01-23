import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog, Loader2, Check, XCircle } from "lucide-react";

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

const MotorizadoSelector = ({ 
  pedidoId, 
  currentMotorizadoId, 
  currentMotorizadoName,
  onAssignmentChange 
}: MotorizadoSelectorProps) => {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [selectedMotorizadoId, setSelectedMotorizadoId] = useState<string | null>(currentMotorizadoId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMotorizados();
  }, []);

  const fetchMotorizados = async () => {
    setLoading(true);
    try {
      // Get motorizado user IDs
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

  const handleAssign = async () => {
    if (!selectedMotorizadoId) return;

    setSaving(true);
    try {
      const selectedMoto = motorizados.find(m => m.user_id === selectedMotorizadoId);
      
      // Build system note for audit trail
      const timestamp = new Date().toLocaleString("es-CO");
      const previousMoto = currentMotorizadoName || "Sin asignar";
      const newMoto = selectedMoto?.full_name || "Sin asignar";
      const systemNote = `[SISTEMA ${timestamp}] Cambio de motorizado: ${previousMoto} → ${newMoto}`;

      // Get current observations
      const { data: pedido } = await supabase
        .from("pedidos")
        .select("observaciones, estado")
        .eq("id", pedidoId)
        .single();

      const currentObs = pedido?.observaciones || "";
      const updatedObs = currentObs ? `${currentObs}\n${systemNote}` : systemNote;

      // Determine new status - if not assigned yet, set to "Asignado"
      const newStatus = (!pedido?.estado || pedido?.estado === "Creado" || pedido?.estado === "Bodega") 
        ? "Asignado" 
        : pedido?.estado;

      // Update the order
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_id: selectedMotorizadoId,
          motorizado_asignado: selectedMoto?.full_name || null,
          estado: newStatus,
          observaciones: updatedObs,
          fecha_actualizacion: new Date().toISOString()
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Log the status change if it changed
      if (newStatus !== pedido?.estado) {
        await supabase.from("pedido_status_logs").insert({
          pedido_id: pedidoId,
          estado_anterior: pedido?.estado || "Creado",
          estado_nuevo: newStatus,
          motivo: `Reasignación a ${newMoto}`,
          usuario_nombre: "Admin"
        });
      }

      toast.success(`Pedido asignado a ${selectedMoto?.full_name}`);
      onAssignmentChange();
    } catch (error) {
      console.error("Error assigning motorizado:", error);
      toast.error("Error al asignar motorizado");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      const timestamp = new Date().toLocaleString("es-CO");
      const previousMoto = currentMotorizadoName || "Sin asignar";
      const systemNote = `[SISTEMA ${timestamp}] Motorizado removido: ${previousMoto}`;

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
          fecha_actualizacion: new Date().toISOString()
        })
        .eq("id", pedidoId);

      if (error) throw error;

      await supabase.from("pedido_status_logs").insert({
        pedido_id: pedidoId,
        estado_anterior: "Asignado",
        estado_nuevo: "Bodega",
        motivo: "Motorizado removido por admin",
        usuario_nombre: "Admin"
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
  };

  const hasChanged = selectedMotorizadoId !== currentMotorizadoId;

  return (
    <div className="rounded-lg border border-border p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <UserCog className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Asignar Motorizado</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando motorizados...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <Select
            value={selectedMotorizadoId || "unassigned"}
            onValueChange={(value) => setSelectedMotorizadoId(value === "unassigned" ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar motorizado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {motorizados.map((moto) => (
                <SelectItem key={moto.user_id} value={moto.user_id}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${moto.is_online ? "bg-green-500" : "bg-gray-400"}`} />
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
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
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
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Remover
              </Button>
            )}
          </div>

          {currentMotorizadoName && (
            <p className="text-xs text-muted-foreground">
              Actual: <span className="font-medium">{currentMotorizadoName}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MotorizadoSelector;

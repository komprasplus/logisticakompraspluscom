import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Truck, Loader2, ArrowRight, CheckCircle2, Package, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { syncPedidoToDropium } from "@/lib/dropiumSync";

interface Carrier {
  user_id: string;
  full_name: string;
  phone: string | null;
  integration_provider: string | null;
}

interface AssignCarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPedidoIds: number[];
  onSuccess?: () => void;
}

const AssignCarrierModal = ({
  isOpen,
  onClose,
  selectedPedidoIds,
  onSuccess,
}: AssignCarrierModalProps) => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cancelRef = useRef(false);

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "aliado_logistico");

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        if (!cancelRef.current) setCarriers([]);
        return;
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, integration_provider")
        .in("user_id", ids)
        .eq("status", "activo");

      if (error) throw error;
      if (cancelRef.current) return;

      const sorted = (profiles ?? []).sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "")
      );
      setCarriers(sorted);

      if (sorted.length === 0) {
        toast.warning("No hay aliados logísticos activos");
      }
    } catch (err) {
      if (!cancelRef.current) {
        console.error("Error fetching carriers:", err);
        toast.error("Error al cargar aliados logísticos");
      }
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current = false;
      setSelectedCarrier(null);
      fetchCarriers();
    }
    return () => {
      cancelRef.current = true;
    };
  }, [isOpen, fetchCarriers]);

  const handleAssign = useCallback(async () => {
    if (!selectedCarrier) {
      toast.error("Selecciona un aliado logístico");
      return;
    }
    const carrier = carriers.find((c) => c.user_id === selectedCarrier);
    if (!carrier) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          proveedor_logistico_id: carrier.user_id,
          integration_partner: carrier.integration_provider || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", selectedPedidoIds);

      if (error) throw error;

      // Audit log batch
      const auditRecords = selectedPedidoIds.map((pedido_id) => ({
        pedido_id,
        estado_anterior: null,
        estado_nuevo: "Enrutado",
        motivo: `Enrutado al proveedor logístico: ${carrier.full_name}`,
        usuario_nombre: "Admin",
      }));
      supabase.from("pedido_status_logs").insert(auditRecords).then(({ error: e }) => {
        if (e) console.warn("Audit log non-blocking error:", e);
      });

      const total = selectedPedidoIds.length;
      toast.success(
        `${total} pedido${total !== 1 ? "s" : ""} enrutado${total !== 1 ? "s" : ""} a ${carrier.full_name}`
      );

      // If carrier has API integration, push to provider
      if (carrier.integration_provider === "dropium") {
        toast.info(`Sincronizando ${total} pedido${total !== 1 ? "s" : ""} con Dropium...`);
        let okCount = 0;
        let failCount = 0;
        const results = await Promise.allSettled(
          selectedPedidoIds.map((id) => syncPedidoToDropium(id))
        );
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.success) okCount++;
          else failCount++;
        });
        if (okCount > 0) toast.success(`Dropium: ${okCount} sincronizado${okCount !== 1 ? "s" : ""}`);
        if (failCount > 0) toast.error(`Dropium: ${failCount} fallido${failCount !== 1 ? "s" : ""}`);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Error assigning carrier:", err);
      toast.error(`Error al enrutar: ${err.message ?? "desconocido"}`);
    } finally {
      setProcessing(false);
    }
  }, [selectedCarrier, carriers, selectedPedidoIds, onClose, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md neu-card border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-primary" />
            Asignar Proveedor Logístico
          </DialogTitle>
          <DialogDescription>
            Enrutar {selectedPedidoIds.length} pedido{selectedPedidoIds.length !== 1 ? "s" : ""} a un aliado 3PL/4PL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {selectedPedidoIds.length} pedido{selectedPedidoIds.length !== 1 ? "s" : ""} seleccionado{selectedPedidoIds.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Solo el aliado elegido podrá verlos en su panel
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : carriers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Truck className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin aliados logísticos</p>
              <p className="text-xs text-muted-foreground">
                Crea usuarios con el rol "aliado_logistico" para poder enrutar paquetes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Seleccionar aliado logístico:</label>
              <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                {carriers.map((c) => {
                  const hasApi = c.integration_provider === "dropium";
                  const isSelected = selectedCarrier === c.user_id;
                  return (
                    <button
                      key={c.user_id}
                      onClick={() => setSelectedCarrier(c.user_id)}
                      disabled={processing}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <Truck className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{c.full_name}</p>
                          {hasApi && (
                            <Badge variant="secondary" className="gap-1 text-[10px] px-1.5">
                              <Zap className="h-3 w-3" />
                              API
                            </Badge>
                          )}
                        </div>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                        {!hasApi && (
                          <p className="text-[11px] text-muted-foreground">Asignación manual</p>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {processing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enrutando pedidos...
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedCarrier || processing || carriers.length === 0}
              className="flex-1 gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Enrutar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCarrierModal;

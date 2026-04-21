import { useState, useMemo } from "react";
import { FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  generateManifiestoPDF,
  generateManifiestoNumero,
  type ManifiestoPedido,
} from "@/lib/manifiestoPdf";

interface PedidoLite {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  municipio?: string | null;
  direccion_entrega: string | null;
  estado: string | null;
}

interface ManifiestoModalProps {
  open: boolean;
  onClose: () => void;
  pedidos: PedidoLite[];
  storeName: string;
  onStatusUpdated?: () => void;
}

// Estados elegibles para incluir en manifiesto de recogida
const ELIGIBLE_STATUSES = ["pendiente", "recibido", "recibido en bodega", "documentado", "pedido recibido"];

const isEligible = (estado: string | null): boolean => {
  if (!estado) return true;
  return ELIGIBLE_STATUSES.includes(estado.toLowerCase());
};

const ManifiestoModal = ({
  open,
  onClose,
  pedidos,
  storeName,
  onStatusUpdated,
}: ManifiestoModalProps) => {
  const { user, organizationId } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingManifestData, setPendingManifestData] = useState<{
    numero: string;
    pedidoIds: number[];
  } | null>(null);

  const eligiblePedidos = useMemo(
    () => pedidos.filter((p) => isEligible(p.estado)),
    [pedidos],
  );

  const allSelected = eligiblePedidos.length > 0 && selectedIds.size === eligiblePedidos.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < eligiblePedidos.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligiblePedidos.map((p) => p.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllBulk = () => {
    setSelectedIds(new Set(eligiblePedidos.map((p) => p.id)));
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un pedido");
      return;
    }
    if (!user) {
      toast.error("Sesión no válida");
      return;
    }

    setIsGenerating(true);
    try {
      const selected = eligiblePedidos.filter((p) => selectedIds.has(p.id));
      const manifiestoNumero = generateManifiestoNumero();

      // 1. Generate PDF
      const manifiestoPedidos: ManifiestoPedido[] = selected.map((p) => ({
        id: p.id,
        numero_guia: p.numero_guia,
        cliente_nombre: p.cliente_nombre,
        municipio: p.municipio ?? null,
        direccion_entrega: p.direccion_entrega,
      }));

      generateManifiestoPDF({
        manifiestoNumero,
        storeName,
        fecha: new Date().toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        pedidos: manifiestoPedidos,
      });

      // 2. Save audit record
      const pedidoIds = selected.map((p) => p.id);
      const { error: insertError } = await supabase.from("manifiestos").insert({
        manifiesto_numero: manifiestoNumero,
        client_user_id: user.id,
        organizacion_id: organizationId ?? "a0000000-0000-0000-0000-000000000001",
        pedido_ids: pedidoIds,
        total_paquetes: selected.length,
        store_name: storeName,
        estado: "generado",
      });

      if (insertError) {
        console.error("[Manifiesto] Error guardando auditoría:", insertError);
        toast.warning("Manifiesto generado, pero no se pudo guardar el registro de auditoría");
      } else {
        toast.success(`Manifiesto ${manifiestoNumero} generado exitosamente`);
      }

      // 3. Ask to update statuses
      setPendingManifestData({ numero: manifiestoNumero, pedidoIds });
      setShowStatusDialog(true);
    } catch (err) {
      console.error("[Manifiesto] Error:", err);
      toast.error("Error al generar el manifiesto");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmStatusUpdate = async () => {
    if (!pendingManifestData) return;

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "En Camino a Bodega",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", pendingManifestData.pedidoIds)
        .eq("organizacion_id", organizationId ?? "a0000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast.success(`${pendingManifestData.pedidoIds.length} pedidos marcados como "En Camino a Bodega"`);
      onStatusUpdated?.();
    } catch (err) {
      console.error("[Manifiesto] Error actualizando estados:", err);
      toast.error("No se pudieron actualizar los estados de los pedidos");
    } finally {
      setShowStatusDialog(false);
      setPendingManifestData(null);
      setSelectedIds(new Set());
      onClose();
    }
  };

  const handleSkipStatusUpdate = () => {
    setShowStatusDialog(false);
    setPendingManifestData(null);
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generar Manifiesto de Recogida
            </DialogTitle>
            <DialogDescription>
              Selecciona los pedidos que el transportador retirará. Se generará un PDF como soporte legal.
            </DialogDescription>
          </DialogHeader>

          {eligiblePedidos.length === 0 ? (
            <div className="rounded-xl bg-muted/50 border border-border p-8 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold text-foreground">No hay pedidos elegibles</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo se pueden incluir pedidos en estado Pendiente o Documentado.
              </p>
            </div>
          ) : (
            <>
              {/* Bulk actions */}
              <div className="flex flex-wrap items-center gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-manifest"
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                  <label
                    htmlFor="select-all-manifest"
                    className="text-sm font-medium text-foreground cursor-pointer select-none"
                  >
                    {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                  </label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllBulk}
                  className="ml-auto h-8 text-xs"
                >
                  Modo Masivo (todos elegibles)
                </Button>
                <Badge variant="secondary" className="ml-auto sm:ml-0">
                  {selectedIds.size} / {eligiblePedidos.length}
                </Badge>
              </div>

              {/* List */}
              <ScrollArea className="flex-1 max-h-[50vh] rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {eligiblePedidos.map((p) => {
                    const isChecked = selectedIds.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                          isChecked ? "bg-primary/5" : ""
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(p.id)}
                          aria-label={`Incluir pedido ${p.numero_guia ?? p.id}`}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {p.numero_guia || `#${p.id}`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {p.estado || "Pendiente"}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground truncate mt-0.5">
                            {p.cliente_nombre || "Sin destinatario"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.municipio ? `${p.municipio} · ` : ""}
                            {p.direccion_entrega || "Sin dirección"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={selectedIds.size === 0 || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generar Manifiesto ({selectedIds.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación para actualizar estados */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              ¿Actualizar estado de los pedidos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas marcar estos {pendingManifestData?.pedidoIds.length ?? 0} pedidos como{" "}
              <strong>"En Camino a Bodega"</strong>? Esta acción notificará a la operación logística que
              los paquetes ya fueron entregados al transportador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipStatusUpdate}>No, solo descargar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusUpdate}>
              Sí, marcar como En Camino
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManifiestoModal;

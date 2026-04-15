import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Shield } from "lucide-react";
import { formatCOP } from "@/lib/tarifas";
import { useAuth } from "@/hooks/useAuth";

interface FinancialOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: {
    id: number;
    numero_guia: string | null;
    valor_recaudar: number | null;
    valor_producto: number | null;
    valor_flete: number | null;
    flete_aliado?: number | null;
    flete_tienda?: number | null;
  };
  onSaved: () => void;
}

const FinancialOverrideModal = ({
  isOpen,
  onClose,
  pedido,
  onSaved,
}: FinancialOverrideModalProps) => {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [valorRecaudar, setValorRecaudar] = useState(pedido.valor_recaudar ?? 0);
  const [valorProducto, setValorProducto] = useState(pedido.valor_producto ?? 0);
  const [fleteTienda, setFleteTienda] = useState(pedido.flete_tienda ?? pedido.valor_flete ?? 0);
  const [fleteAliado, setFleteAliado] = useState(pedido.flete_aliado ?? 0);

  const newUtility = valorRecaudar - valorProducto - fleteTienda;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          valor_recaudar: valorRecaudar,
          valor_producto: valorProducto,
          valor_flete: fleteTienda,
          flete_tienda: fleteTienda,
          flete_aliado: fleteAliado,
          utilidad: newUtility,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedido.id);

      if (error) throw error;

      // Insert audit log in pedido_status_logs
      await supabase.from("pedido_status_logs").insert({
        pedido_id: pedido.id,
        estado_anterior: "Entregado",
        estado_nuevo: "Entregado",
        motivo: `Corrección financiera por Super Admin: Recaudo ${formatCOP(valorRecaudar)}, Producto ${formatCOP(valorProducto)}, Flete ${formatCOP(fleteTienda)}, Flete Aliado ${formatCOP(fleteAliado)}. Utilidad: ${formatCOP(newUtility)}`,
        usuario_id: user?.id ?? null,
        usuario_nombre: profile?.full_name ?? "Super Admin",
      });

      toast.success("Valores financieros corregidos exitosamente");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Financial override error:", err);
      toast.error("Error al guardar: " + (err.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            Corrección Financiera de Emergencia
          </DialogTitle>
          <DialogDescription>
            Guía: <strong>{pedido.numero_guia || `#${pedido.id}`}</strong> — Solo Super Admin
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-2">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esta acción sobrescribirá los valores financieros del pedido y
              quedará registrada en el historial de auditoría.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor-recaudar">Valor a Recaudar (Precio de Venta)</Label>
            <Input
              id="valor-recaudar"
              type="number"
              min={0}
              value={valorRecaudar}
              onChange={(e) => setValorRecaudar(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor-producto">Costo del Producto</Label>
            <Input
              id="valor-producto"
              type="number"
              min={0}
              value={valorProducto}
              onChange={(e) => setValorProducto(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flete-tienda">Flete Tienda</Label>
            <Input
              id="flete-tienda"
              type="number"
              min={0}
              value={fleteTienda}
              onChange={(e) => setFleteTienda(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flete-aliado">Flete Aliado (Opcional)</Label>
            <Input
              id="flete-aliado"
              type="number"
              min={0}
              value={fleteAliado}
              onChange={(e) => setFleteAliado(Number(e.target.value))}
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">Nueva Utilidad Tienda:</span>
              <span className={newUtility >= 0 ? "text-green-600 font-bold" : "text-destructive font-bold"}>
                {formatCOP(newUtility)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              = {formatCOP(valorRecaudar)} - {formatCOP(valorProducto)} - {formatCOP(fleteTienda)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Aplicar Corrección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinancialOverrideModal;

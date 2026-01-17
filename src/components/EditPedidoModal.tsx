import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZONAS, getAllZonas } from "@/lib/zonas";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
}

interface EditPedidoModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditPedidoModal = ({ pedido, isOpen, onClose, onSuccess }: EditPedidoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente_nombre: "",
    client_phone: "",
    direccion_entrega: "",
    barrio: "",
    zona: "",
    producto_nombre: "",
    valor_recaudar: "",
    metodo_pago: "efectivo",
    fecha_entrega: null as Date | null,
  });

  useEffect(() => {
    if (pedido) {
      setFormData({
        cliente_nombre: pedido.cliente_nombre || "",
        client_phone: pedido.client_phone || "",
        direccion_entrega: pedido.direccion_entrega || "",
        barrio: pedido.barrio || "",
        zona: pedido.zona || "",
        producto_nombre: pedido.producto_nombre || "",
        valor_recaudar: pedido.valor_recaudar?.toString() || "",
        metodo_pago: pedido.metodo_pago || "efectivo",
        fecha_entrega: pedido.fecha_entrega ? parseISO(pedido.fecha_entrega) : null,
      });
    }
  }, [pedido]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          cliente_nombre: formData.cliente_nombre,
          client_phone: formData.client_phone,
          direccion_entrega: formData.direccion_entrega,
          barrio: formData.barrio,
          zona: formData.zona,
          producto_nombre: formData.producto_nombre,
          valor_recaudar: formData.valor_recaudar ? parseFloat(formData.valor_recaudar) : null,
          metodo_pago: formData.metodo_pago,
          fecha_entrega: formData.fecha_entrega ? format(formData.fecha_entrega, "yyyy-MM-dd") : null,
        })
        .eq("id", pedido.id);

      if (error) throw error;

      toast.success("Pedido actualizado exitosamente");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating pedido:", error);
      toast.error("Error al actualizar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const zonas = getAllZonas();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Editar Pedido #{pedido?.id}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Datos del Cliente</h3>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="cliente_nombre">Nombre del Destinatario</Label>
                <Input
                  id="cliente_nombre"
                  value={formData.cliente_nombre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cliente_nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="client_phone">Teléfono</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Dirección de Entrega</h3>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="direccion_entrega">Dirección</Label>
                <Textarea
                  id="direccion_entrega"
                  value={formData.direccion_entrega}
                  onChange={(e) => setFormData((prev) => ({ ...prev, direccion_entrega: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="barrio">Barrio</Label>
                  <Input
                    id="barrio"
                    value={formData.barrio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barrio: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="zona">Zona</Label>
                  <Select value={formData.zona} onValueChange={(v) => setFormData((prev) => ({ ...prev, zona: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {zonas.map((zonaCodigo) => {
                        const zonaConfig = ZONAS[zonaCodigo];
                        return (
                          <SelectItem key={zonaCodigo} value={zonaCodigo}>
                            {zonaCodigo} - {zonaConfig.nombre}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Producto */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Detalles del Paquete</h3>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="producto_nombre">Nombre del Producto</Label>
                <Input
                  id="producto_nombre"
                  value={formData.producto_nombre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, producto_nombre: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="valor_recaudar">Valor a Recaudar ($)</Label>
                  <Input
                    id="valor_recaudar"
                    type="number"
                    value={formData.valor_recaudar}
                    onChange={(e) => setFormData((prev) => ({ ...prev, valor_recaudar: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="metodo_pago">Método de Pago</Label>
                  <Select value={formData.metodo_pago} onValueChange={(v) => setFormData((prev) => ({ ...prev, metodo_pago: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="anticipado">Anticipado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Fecha de Entrega */}
          <div>
            <Label>Fecha de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.fecha_entrega ? (
                    format(formData.fecha_entrega, "PPP", { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.fecha_entrega || undefined}
                  onSelect={(date) => setFormData((prev) => ({ ...prev, fecha_entrega: date || null }))}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPedidoModal;

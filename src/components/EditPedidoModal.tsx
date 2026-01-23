import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save, MapPin, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZONAS, getAllZonas } from "@/lib/zonas";
import GooglePlacesAutocomplete from "@/components/GooglePlacesAutocomplete";

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
  latitud?: number | null;
  longitud?: number | null;
  motorizado_id?: string | null;
  observaciones?: string | null;
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
    latitud: null as number | null,
    longitud: null as number | null,
  });

  // Track if this is a critical edit (order in transit)
  const isCriticalEdit = pedido?.estado?.toLowerCase() === "en ruta" || 
                         pedido?.estado?.toLowerCase().includes("novedad");

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
        latitud: pedido.latitud ?? null,
        longitud: pedido.longitud ?? null,
      });
    }
  }, [pedido]);

  const handleAddressSelect = (result: {
    direccion: string;
    barrio: string;
    localidad: string;
    ciudad: string;
    lat: number;
    lng: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      direccion_entrega: result.direccion,
      barrio: result.barrio || prev.barrio,
      latitud: result.lat,
      longitud: result.lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido) return;

    setLoading(true);
    try {
      // Build the update payload
      const updatePayload: Record<string, any> = {
        cliente_nombre: formData.cliente_nombre,
        client_phone: formData.client_phone,
        direccion_entrega: formData.direccion_entrega,
        barrio: formData.barrio,
        zona: formData.zona,
        producto_nombre: formData.producto_nombre,
        valor_recaudar: formData.valor_recaudar ? parseFloat(formData.valor_recaudar) : null,
        metodo_pago: formData.metodo_pago,
        fecha_entrega: formData.fecha_entrega ? format(formData.fecha_entrega, "yyyy-MM-dd") : null,
        latitud: formData.latitud,
        longitud: formData.longitud,
        fecha_actualizacion: new Date().toISOString(),
      };

      // Check if address/GPS was changed
      const addressChanged = formData.direccion_entrega !== pedido.direccion_entrega ||
                            formData.latitud !== pedido.latitud ||
                            formData.longitud !== pedido.longitud;

      // If critical edit, add system note to observaciones
      if (isCriticalEdit && addressChanged) {
        const timestamp = new Date().toLocaleString("es-CO");
        const systemNote = `\n[SISTEMA ${timestamp}] Dirección corregida por Admin.`;
        updatePayload.observaciones = (pedido.observaciones || "") + systemNote;
      }

      const { error } = await supabase
        .from("pedidos")
        .update(updatePayload)
        .eq("id", pedido.id);

      if (error) throw error;

      // Log the status change for audit trail
      if (isCriticalEdit && addressChanged) {
        await supabase.from("pedido_status_logs").insert({
          pedido_id: pedido.id,
          estado_anterior: pedido.estado,
          estado_nuevo: pedido.estado, // Status doesn't change
          motivo: "Dirección/GPS corregido por Admin",
          usuario_nombre: "Admin",
        });
      }

      toast.success("Pedido actualizado exitosamente");
      if (isCriticalEdit && addressChanged) {
        toast.info("📍 Se notificó al motorizado del cambio de dirección");
      }
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

        {/* Critical Edit Warning */}
        {isCriticalEdit && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Pedido en {pedido?.estado}</p>
              <p className="text-amber-700">Los cambios de dirección/GPS se registrarán en el Timeline y se notificará al motorizado.</p>
            </div>
          </div>
        )}

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

          {/* Dirección con Google Places */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Dirección de Entrega
            </h3>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="direccion_entrega">Dirección</Label>
                <GooglePlacesAutocomplete
                  value={formData.direccion_entrega}
                  onSelect={handleAddressSelect}
                  placeholder="Buscar dirección..."
                />
              </div>

              {/* Show current GPS coordinates if available */}
              {(formData.latitud && formData.longitud) && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>📍 GPS: {formData.latitud.toFixed(6)}, {formData.longitud.toFixed(6)}</span>
                </div>
              )}

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

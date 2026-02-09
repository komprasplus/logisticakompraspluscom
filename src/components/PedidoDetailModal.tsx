import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, User, MapPin, CreditCard, Truck, Calendar, 
  Phone, Store, Camera, FileText, Clock, Calculator, DollarSign, MessageCircle 
} from "lucide-react";
import { getStatusConfig } from "@/lib/orderStatuses";
import { ZONAS, type ZonaCodigo } from "@/lib/zonas";
import { formatCOP } from "@/lib/tarifas";
import { useAuth } from "@/hooks/useAuth";
import AdminStatusEditor from "./AdminStatusEditor";
import PedidoStatusHistory from "./PedidoStatusHistory";
import MotorizadoSelector from "./admin/MotorizadoSelector";
import PedidoChat from "./PedidoChat";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  municipio?: string | null;
  valor_recaudar: number | null;
  valor_producto?: number | null;
  valor_flete?: number | null;
  utilidad?: number | null;
  fulfillment_cost?: number | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  fecha_creacion: string | null;
  fecha_actualizacion: string | null;
  motorizado_asignado: string | null;
  motorizado_id?: string | null;
  estado: string | null;
  tipo_novedad: string | null;
  foto_evidencia: string | null;
  foto_paquete: string | null;
  firma_cliente: string | null;
}

interface PedidoDetailModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  remitente?: string;
  onStatusChange?: () => void;
}

const PedidoDetailModal = ({ pedido, isOpen, onClose, remitente, onStatusChange }: PedidoDetailModalProps) => {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [chatOpen, setChatOpen] = useState(false);
  
  if (!pedido) return null;

  const statusConfig = getStatusConfig(pedido.estado);
  const zonaConfig = pedido.zona ? ZONAS[pedido.zona as ZonaCodigo] : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const isPagado = pedido.metodo_pago === "anticipado";

  const ChatInline = ({ pedidoId }: { pedidoId: number }) => (
    <div className="mt-2">
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <MessageCircle className="h-4 w-4" />
        {chatOpen ? "Cerrar Chat" : "Abrir Chat del Pedido"}
      </button>
      <PedidoChat
        pedidoId={pedidoId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Detalle del Pedido - {pedido.numero_guia || `#${pedido.id}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Estado actual */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                {statusConfig.label}
              </span>
              {pedido.tipo_novedad && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {pedido.tipo_novedad}
                </Badge>
              )}
            </div>

            {/* Remitente (Tienda) */}
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Store className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Remitente (Tienda)</h3>
              </div>
              <p className="text-foreground">{remitente || "Kompras Plus"}</p>
            </div>

            {/* Destinatario */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Destinatario</h3>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">{pedido.cliente_nombre || "-"}</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{pedido.client_phone || "-"}</span>
                </div>
              </div>
            </div>

            {/* Dirección */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Dirección de Entrega</h3>
              </div>
              <div className="space-y-2">
                <p className="text-foreground">{pedido.direccion_entrega || "-"}</p>
                <div className="flex gap-3">
                  <Badge variant="secondary">{pedido.barrio || "Sin barrio"}</Badge>
                  {zonaConfig && (
                    <Badge className={`${zonaConfig.bgColor} ${zonaConfig.textColor}`}>
                      {zonaConfig.codigo} - {zonaConfig.nombre}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Método de Pago y Valores - Desglose Completo */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Información Financiera</h3>
              </div>
              
              <div className="space-y-4">
                {/* Método de Pago */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Método de Pago</span>
                  <Badge variant={isPagado ? "default" : "secondary"}>
                    {isPagado ? "Pago Anticipado" : "Contra Entrega"}
                  </Badge>
                </div>

                {/* Desglose de Valores */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Valor a Recaudar:
                    </span>
                    <span className="font-medium text-foreground">
                      {isPagado ? "PAGADO" : formatCOP(pedido.valor_recaudar)}
                    </span>
                  </div>
                  
                  {pedido.valor_producto !== undefined && pedido.valor_producto !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo Producto:</span>
                      <span className="font-medium text-foreground">{formatCOP(pedido.valor_producto)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Flete ({pedido.municipio || "Bogotá"}):
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCOP(pedido.valor_flete || 12000)}
                    </span>
                  </div>

                  {/* Fulfillment Cost - Read Only Display */}
                  {pedido.fulfillment_cost !== undefined && pedido.fulfillment_cost !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Fulfillment:
                      </span>
                      <span className="font-medium text-primary">
                        {formatCOP(pedido.fulfillment_cost)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Utilidad */}
                {pedido.utilidad !== undefined && pedido.utilidad !== null && (
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        Utilidad Tienda:
                      </span>
                      <span className={`text-lg font-bold ${pedido.utilidad >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {formatCOP(pedido.utilidad)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      = Recaudo - Costo Producto - Flete
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Producto */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Producto</h3>
              </div>
              <p className="text-foreground">{pedido.producto_nombre || "Paquete estándar"}</p>
            </div>

            {/* Motorizado Asignado / Selector for Admin */}
            {isAdmin ? (
              <MotorizadoSelector
                pedidoId={pedido.id}
                currentMotorizadoId={pedido.motorizado_id || null}
                currentMotorizadoName={pedido.motorizado_asignado}
                onAssignmentChange={() => {
                  onStatusChange?.();
                }}
              />
            ) : pedido.motorizado_asignado ? (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Motorizado Asignado</h3>
                </div>
                <p className="text-foreground">{pedido.motorizado_asignado}</p>
              </div>
            ) : null}

            {/* Historial de Fechas */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Fechas</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha de creación:</span>
                  <span className="text-foreground">{formatDate(pedido.fecha_creacion)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Última actualización:</span>
                  <span className="text-foreground">{formatDate(pedido.fecha_actualizacion)}</span>
                </div>
              </div>
            </div>

            {/* Admin Status Editor */}
            {isAdmin && (
              <AdminStatusEditor 
                pedidoId={pedido.id}
                currentStatus={pedido.estado}
                onStatusChange={() => {
                  onStatusChange?.();
                  onClose();
                }}
              />
            )}

            {/* Status Change History */}
            <PedidoStatusHistory pedidoId={pedido.id} />
            {(pedido.foto_paquete || pedido.foto_evidencia || pedido.firma_cliente) && (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Evidencias Fotográficas</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {pedido.foto_paquete && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Foto del Paquete</p>
                      <img 
                        src={pedido.foto_paquete} 
                        alt="Foto del paquete" 
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  {pedido.foto_evidencia && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Foto de Evidencia</p>
                      <img 
                        src={pedido.foto_evidencia} 
                        alt="Foto de evidencia" 
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  {pedido.firma_cliente && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Firma del Cliente</p>
                      <img 
                        src={pedido.firma_cliente} 
                        alt="Firma del cliente" 
                        className="w-full h-24 object-cover rounded-lg border bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat Section */}
            <ChatInline pedidoId={pedido.id} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PedidoDetailModal;
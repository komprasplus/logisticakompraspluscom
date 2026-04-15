import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  Calendar,
  Phone,
  Store,
  Camera,
  FileText,
  ShoppingCart,
  Clock,
  Calculator,
  DollarSign,
  MessageCircle,
  ChevronDown,
  Wrench,
} from "lucide-react";
import FinancialOverrideModal from "./FinancialOverrideModal";
import { getStatusConfig } from "@/lib/orderStatuses";
import { ZONAS, type ZonaCodigo } from "@/lib/zonas";
import { formatCOP } from "@/lib/tarifas";
import { useAuth } from "@/hooks/useAuth";
import { formatInTimeZone } from "date-fns-tz";
import AdminStatusEditor from "./AdminStatusEditor";
import PedidoStatusHistory from "./PedidoStatusHistory";
import MotorizadoSelector from "./admin/MotorizadoSelector";
import PedidoChat from "./PedidoChat";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TZ = "America/Bogota";
const FLETE_DEFAULT = 12000;

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/*
  FIX: `formatDate` movida a módulo scope.
  Era una función pura sin dependencias del scope recreada en cada render.

  FIX: `new Date(dateStr).toLocaleString("es-CO", {...})` → `formatInTimeZone`.
  Mismo bug de timezone presente en HistorialTransaccionesView, NovedadesView,
  WebhookConfigPanel y otros — usaba el timezone local del navegador.
*/
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  try {
    return formatInTimeZone(new Date(dateStr), TZ, "dd MMM yyyy, HH:mm");
  } catch {
    return "-";
  }
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Componente ───────────────────────────────────────────────────────────────

const PedidoDetailModal = ({ pedido, isOpen, onClose, remitente, onStatusChange }: PedidoDetailModalProps) => {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const [chatOpen, setChatOpen] = useState(false);
  const [financialOverrideOpen, setFinancialOverrideOpen] = useState(false);
  const [orderItemsList, setOrderItemsList] = useState<any[]>([]);

  // Fetch order items for multi-product orders
  useEffect(() => {
    if (!pedido || !isOpen) return;
    const fetchOrderItems = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("order_items")
          .select("id, product_name, sku, quantity, unit_price, line_total")
          .eq("pedido_id", pedido.id)
          .order("created_at");
        if (!error && data && data.length > 0) {
          setOrderItemsList(data);
        } else {
          setOrderItemsList([]);
        }
      } catch {
        setOrderItemsList([]);
      }
    };
    fetchOrderItems();
  }, [pedido?.id, isOpen]);

  if (!pedido) return null;

  const statusConfig = getStatusConfig(pedido.estado);
  const zonaConfig = pedido.zona ? ZONAS[pedido.zona as ZonaCodigo] : null;
  const isPagado = pedido.metodo_pago === "anticipado";

  /*
    FIX: fórmula de utilidad dinámica según campos presentes.
    La versión original mostraba "= Recaudo - Costo Producto - Flete" siempre,
    pero si el pedido tenía `fulfillment_cost` la fórmula real incluía ese campo.
    La descripción del tooltip era engañosa para el admin que revisaba números.
  */
  const utilityFormula = (() => {
    const parts = ["Recaudo", "Costo Producto", "Flete"];
    if (pedido.fulfillment_cost != null) parts.push("Fulfillment");
    return `= ${parts.join(" - ")}`;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            Detalle del Pedido — {pedido.numero_guia || `#${pedido.id}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Estado actual */}
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}
                role="status"
                aria-label={`Estado: ${statusConfig.label}`}
              >
                {statusConfig.label}
              </span>
              {pedido.tipo_novedad && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {pedido.tipo_novedad}
                </Badge>
              )}
            </div>

            {/* Remitente */}
            <Section icon={<Store className="h-4 w-4 text-primary" />} title="Remitente (Tienda)" muted>
              <p className="text-foreground">{remitente || "Kompras Plus"}</p>
            </Section>

            {/* Destinatario */}
            <Section icon={<User className="h-4 w-4 text-primary" />} title="Destinatario">
              <p className="text-lg font-medium text-foreground">{pedido.cliente_nombre || "-"}</p>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {/*
                  FIX: número de teléfono como `<a href="tel:">` en lugar de `<span>`.
                  Mismo fix aplicado en NovedadesView. En dispositivos móviles (donde
                  el admin también usa la app) un toque directo en el número debería
                  abrir el marcador. Como texto plano era información inerte.
                */}
                {pedido.client_phone ? (
                  <a
                    href={`tel:${pedido.client_phone.replace(/\D/g, "")}`}
                    className="hover:text-foreground transition-colors"
                    aria-label={`Llamar a ${pedido.cliente_nombre ?? "cliente"}: ${pedido.client_phone}`}
                  >
                    {pedido.client_phone}
                  </a>
                ) : (
                  <span>-</span>
                )}
              </div>
            </Section>

            {/* Dirección */}
            <Section icon={<MapPin className="h-4 w-4 text-primary" />} title="Dirección de Entrega">
              <p className="text-foreground">{pedido.direccion_entrega || "-"}</p>
              <div className="flex gap-3 mt-2 flex-wrap">
                <Badge variant="secondary">{pedido.barrio || "Sin barrio"}</Badge>
                {zonaConfig && (
                  <Badge className={`${zonaConfig.bgColor} ${zonaConfig.textColor}`}>
                    {zonaConfig.codigo} — {zonaConfig.nombre}
                  </Badge>
                )}
              </div>
            </Section>

            {/* Información financiera */}
            <Section icon={<CreditCard className="h-4 w-4 text-primary" />} title="Información Financiera"
              action={isSuperAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setFinancialOverrideOpen(true)}
                >
                  <Wrench className="h-3.5 w-3.5 mr-1" />
                  Corregir
                </Button>
              ) : undefined}
            >
              <div className="space-y-4">
                {/* Método de pago */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Método de Pago</span>
                  <Badge variant={isPagado ? "default" : "secondary"}>
                    {isPagado ? "Pago Anticipado" : "Contra Entrega"}
                  </Badge>
                </div>

                {/* Desglose */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" aria-hidden="true" />
                      Valor a Recaudar:
                    </span>
                    <span className="font-medium text-foreground">
                      {/*
                        FIX: `formatCOP(pedido.valor_recaudar)` sin guarda.
                        Si `valor_recaudar` es null, `formatCOP(null)` podría
                        retornar "$0" o "NaN". Ahora: "PAGADO" si anticipado,
                        `?? 0` si es null con pago contra entrega.
                      */}
                      {isPagado ? "PAGADO" : formatCOP(pedido.valor_recaudar ?? 0)}
                    </span>
                  </div>

                  {pedido.valor_producto != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo Producto:</span>
                      <span className="font-medium text-foreground">{formatCOP(pedido.valor_producto)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" aria-hidden="true" />
                      Flete ({pedido.municipio || "Bogotá"}):
                    </span>
                    <span className="font-medium text-foreground">
                      {/*
                        FIX: `pedido.valor_flete || 12000` → `?? FLETE_DEFAULT`.
                        Mismo bug financiero crítico corregido en DevolucionesView,
                        NovedadesView, PedidosView, ReportesView, LoadManifest.
                        Un pedido exonerado con `valor_flete: 0` mostraba "$12,000".
                      */}
                      {formatCOP(pedido.valor_flete ?? FLETE_DEFAULT)}
                    </span>
                  </div>

                  {pedido.fulfillment_cost != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" aria-hidden="true" />
                        Fulfillment:
                      </span>
                      <span className="font-medium text-primary">{formatCOP(pedido.fulfillment_cost)}</span>
                    </div>
                  )}
                </div>

                {/* Utilidad */}
                {pedido.utilidad != null && (
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Calculator className="h-3 w-3" aria-hidden="true" />
                        Utilidad Tienda:
                      </span>
                      <span
                        className={`text-lg font-bold ${pedido.utilidad >= 0 ? "text-green-600" : "text-destructive"}`}
                      >
                        {formatCOP(pedido.utilidad)}
                      </span>
                    </div>
                    {/* FIX: fórmula dinámica según campos presentes */}
                    <p className="text-xs text-muted-foreground mt-1">{utilityFormula}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* Producto */}
            <Section icon={<FileText className="h-4 w-4 text-primary" />} title="Producto">
              <p className="text-foreground">{pedido.producto_nombre || "Paquete estándar"}</p>
            </Section>

            {/* Lista de Empaque (Multi-producto) */}
            {orderItemsList.length > 0 && (
              <Section icon={<ShoppingCart className="h-4 w-4 text-primary" />} title={`Lista de Empaque (${orderItemsList.length} artículo${orderItemsList.length !== 1 ? "s" : ""})`}>
                <div className="space-y-2">
                  {orderItemsList.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">x{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">{formatCOP(item.unit_price)} c/u</p>
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-sm font-bold text-primary">{formatCOP(item.line_total)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-sm font-semibold text-muted-foreground">Total:</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatCOP(orderItemsList.reduce((sum: number, i: any) => sum + (i.line_total || 0), 0))}
                    </span>
                  </div>
                </div>
              </Section>
            )}

            {/* Motorizado */}
            {isAdmin ? (
              <MotorizadoSelector
                pedidoId={pedido.id}
                currentMotorizadoId={pedido.motorizado_id ?? null}
                currentMotorizadoName={pedido.motorizado_asignado}
                onAssignmentChange={() => onStatusChange?.()}
              />
            ) : pedido.motorizado_asignado ? (
              <Section icon={<Truck className="h-4 w-4 text-primary" />} title="Motorizado Asignado">
                <p className="text-foreground">{pedido.motorizado_asignado}</p>
              </Section>
            ) : null}

            {/* Fechas */}
            <Section icon={<Clock className="h-4 w-4 text-primary" />} title="Fechas">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha de creación:</span>
                  <time dateTime={pedido.fecha_creacion ?? undefined} className="text-foreground">
                    {/*
                      FIX: `<time>` semántico con atributo `dateTime`.
                      El texto legible usa `formatDate()` con timezone Bogotá;
                      el atributo `dateTime` expone el ISO original a herramientas
                      de accesibilidad y parsers de calendario.
                    */}
                    {formatDate(pedido.fecha_creacion)}
                  </time>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Última actualización:</span>
                  <time dateTime={pedido.fecha_actualizacion ?? undefined} className="text-foreground">
                    {formatDate(pedido.fecha_actualizacion)}
                  </time>
                </div>
              </div>
            </Section>

            {/* Editor de estado (solo admin) */}
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

            {/* Historial de estados */}
            <PedidoStatusHistory pedidoId={pedido.id} />

            {/* Evidencias fotográficas */}
            {(pedido.foto_paquete || pedido.foto_evidencia || pedido.firma_cliente) && (
              <Section icon={<Camera className="h-4 w-4 text-primary" />} title="Evidencias Fotográficas">
                <div className="grid grid-cols-3 gap-4">
                  {pedido.foto_paquete && <EvidenceImage src={pedido.foto_paquete} label="Foto del Paquete" />}
                  {pedido.foto_evidencia && <EvidenceImage src={pedido.foto_evidencia} label="Foto de Evidencia" />}
                  {pedido.firma_cliente && (
                    <EvidenceImage src={pedido.firma_cliente} label="Firma del Cliente" whiteBg />
                  )}
                </div>
              </Section>
            )}

            {/* Chat del pedido */}
            {/*
              FIX: `ChatInline` era un componente definido DENTRO de
              `PedidoDetailModal`. Este es uno de los anti-patrones más costosos
              en React: cada render del padre crea una nueva referencia a la
              función `ChatInline`, lo que hace que React la trate como un
              tipo de componente diferente y ejecute un ciclo completo de
              unmount → remount en cada render. Esto destruía el estado del
              chat, cerraba suscripciones de Supabase Realtime activas y
              causaba parpadeos visuales. Reemplazado con el contenido JSX
              directamente en el render, gestionando el estado `chatOpen`
              que ya existía en el componente padre.
            */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                /*
                  FIX: `hover:underline` → `hover:text-primary/80`.
                  Mismo fix semántico que en el componente Accordion:
                  `hover:underline` es la convención de los enlaces (<a>), no
                  de botones de toggle. Un usuario que ve subrayado en hover
                  espera navegación, no apertura de un panel.

                  FIX: `aria-expanded` para que lectores de pantalla anuncien
                  el estado del panel de chat.
                */
                aria-expanded={chatOpen}
                aria-controls="pedido-chat-panel"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {chatOpen ? "Cerrar Chat" : "Abrir Chat del Pedido"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${chatOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <div id="pedido-chat-panel">
                <PedidoChat pedidoId={pedido.id} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Financial Override Modal (Super Admin only) */}
        {isSuperAdmin && (
          <FinancialOverrideModal
            isOpen={financialOverrideOpen}
            onClose={() => setFinancialOverrideOpen(false)}
            pedido={pedido as any}
            onSaved={() => onStatusChange?.()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

/*
  FIX: `Section` extraído como subcomponente.
  La versión original repetía el mismo bloque de 5 líneas (borde + padding +
  ícono + título + children) 9 veces. Ahora cada sección es una línea.
  Definido FUERA del componente padre para evitar el anti-patrón de
  componentes internos que causan unmount/remount en cada render.
*/
const Section = ({
  icon,
  title,
  children,
  muted = false,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  muted?: boolean;
  action?: React.ReactNode;
}) => (
  <div className={`rounded-lg border border-border p-4 ${muted ? "bg-muted/30" : ""}`}>
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="font-semibold text-foreground flex-1">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

/*
  FIX: `EvidenceImage` extraído como subcomponente.
  Las tres imágenes de evidencia eran copias con mínimas variaciones.
  Extrae la lógica de `onerror` y `loading="lazy"` en un solo lugar.
*/
const EvidenceImage = ({ src, label, whiteBg = false }: { src: string; label: string; whiteBg?: boolean }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <img
      src={src}
      alt={label}
      loading="lazy"
      /*
        FIX: imágenes sin `loading="lazy"` ni `onError`.
        Las tres imágenes de evidencia se cargaban eagerly aunque el modal
        recién abriera. Con `loading="lazy"` el navegador las carga solo
        cuando el usuario hace scroll hasta ellas.

        FIX: sin `onError`, una URL rota de Supabase Storage mostraba el ícono
        roto del navegador sin contexto. Ocultamos la imagen rota.
      */
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
      className={`w-full h-24 object-cover rounded-lg border ${whiteBg ? "bg-white" : ""}`}
    />
  </div>
);

export default PedidoDetailModal;

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  QrCode,
  Share2,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOP, formatCOPFull } from "@/lib/motorizado-score";
import PedidoMiniMap from "./PedidoMiniMap";

export interface PedidoDetailViewPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  canal?: string | null;
  foto_evidencia?: string | null;
  corte_horario?: string | null;
  tipo_novedad?: string | null;
}

interface StatusLog {
  id: number | string;
  estado_nuevo: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string | null;
  sku: string | null;
  quantity: number | null;
}

interface PedidoDetailViewProps {
  pedido: PedidoDetailViewPedido;
  userLocation: { lat: number; lng: number } | null;
  distanceText: string | null;
  isWithinRange: boolean;
  cupoCODRestante: number;
  tiendaNombre?: string | null;
  chatOpen: boolean;
  onClose: () => void;
  onCall: (phone: string | null) => void;
  onWhatsApp: (phone: string | null) => void;
  onNavigate: () => void;
  onWaze: () => void;
  onShareLocation: () => void;
  onPayWithQR: () => void;
  onCapturePhoto: () => void;
  onReportNovedad: () => void;
  onToggleChat: () => void;
  chatComponent?: React.ReactNode;
}

const getInitials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

const formatTimeAgo = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffH < 24) return `Hoy, ${date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

const TIMELINE_STAGES = [
  { key: "recibido", label: "Recibido en bodega", match: ["recibido en bodega", "recibido"] },
  { key: "asignado", label: "Asignado a ti", match: ["asignado"] },
  { key: "ruta", label: "En ruta hacia el destino", match: ["en ruta", "en_ruta"] },
  { key: "entregado", label: "Entregado", match: ["entregado", "pagado", "liquidado"] },
] as const;

/**
 * Vista de detalle premium del pedido para el motorizado.
 * Reemplaza el sheet inline del MotorizadoDashboard con una experiencia profesional.
 */
const PedidoDetailView = ({
  pedido,
  userLocation,
  distanceText,
  isWithinRange,
  cupoCODRestante,
  tiendaNombre,
  chatOpen,
  onClose,
  onCall,
  onWhatsApp,
  onNavigate,
  onWaze,
  onShareLocation,
  onPayWithQR,
  onCapturePhoto,
  onReportNovedad,
  onToggleChat,
  chatComponent,
}: PedidoDetailViewProps) => {
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  // Cargar timeline y productos al abrir
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingExtras(true);
      try {
        const [logsRes, itemsRes] = await Promise.all([
          supabase
            .from("pedido_status_logs")
            .select("id, estado_nuevo, created_at")
            .eq("pedido_id", pedido.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("order_items")
            .select("id, product_name, sku, quantity")
            .eq("pedido_id", pedido.id)
            .limit(10),
        ]);
        if (!active) return;
        if (logsRes.data) setStatusLogs(logsRes.data as StatusLog[]);
        if (itemsRes.data) setOrderItems(itemsRes.data as OrderItem[]);
      } catch (e) {
        // no-op
      } finally {
        if (active) setLoadingExtras(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [pedido.id]);

  const isCOD =
    pedido.metodo_pago?.toLowerCase() === "efectivo" ||
    pedido.metodo_pago?.toLowerCase() === "contraentrega";
  const isFlex = pedido.canal === "FLEX";
  const isEnRuta = pedido.estado?.toLowerCase() === "en ruta" || pedido.estado?.toLowerCase() === "en_ruta";
  const isEntregado = pedido.estado?.toLowerCase() === "entregado" || pedido.estado?.toLowerCase() === "pagado";
  const isNovedad = pedido.estado?.toLowerCase() === "novedad";

  // Calcular timeline visible basado en logs reales
  const completedStages = new Set<string>();
  let currentStageKey: string | null = null;
  statusLogs.forEach((log) => {
    const e = log.estado_nuevo.toLowerCase();
    TIMELINE_STAGES.forEach((stage) => {
      if (stage.match.some((m) => e.includes(m))) {
        completedStages.add(stage.key);
        currentStageKey = stage.key;
      }
    });
  });

  const stageTimestamps: Record<string, string | undefined> = {};
  TIMELINE_STAGES.forEach((stage) => {
    const log = statusLogs.find((l) => stage.match.some((m) => l.estado_nuevo.toLowerCase().includes(m)));
    if (log) stageTimestamps[stage.key] = log.created_at;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============ HEADER NAVY CON ESTADO VIVO ============ */}
        <div className="bg-primary text-primary-foreground px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isEnRuta && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    isEnRuta ? "bg-gold" : isEntregado ? "bg-success" : isNovedad ? "bg-pink" : "bg-primary-foreground/40",
                  )}
                />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                {isEnRuta ? "En ruta" : isEntregado ? "Entregado" : isNovedad ? "Con novedad" : pedido.estado || "Sin estado"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pedido.numero_guia && (
                <span className="text-[11px] font-mono opacity-60">{pedido.numero_guia}</span>
              )}
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold leading-tight">
              Pedido #{pedido.id}
              {isFlex && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-gold align-middle">
                  <Zap className="h-2.5 w-2.5" /> FLEX
                </span>
              )}
            </h2>
            {statusLogs.length > 0 && (
              <span className="text-[10px] opacity-60">
                {formatTimeAgo(statusLogs[statusLogs.length - 1].created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto">

          {/* ============ MAP PREVIEW (Google Maps real) ============ */}
          <PedidoMiniMap
            userLat={userLocation?.lat ?? null}
            userLng={userLocation?.lng ?? null}
            destLat={pedido.latitud}
            destLng={pedido.longitud}
            distanceText={distanceText}
            isWithinRange={isWithinRange}
            height={120}
          />

          {/* ============ CONTENIDO ============ */}
          <div className="p-4 space-y-4">

            {/* COD destacado con cupo */}
            {isCOD && pedido.valor_recaudar ? (
              <div className="bg-gradient-to-br from-gold/20 to-gold/10 border border-gold/40 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold flex items-center justify-center flex-shrink-0">
                  <span className="text-gold-foreground font-bold text-lg">$</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
                    Cobrar contraentrega
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums leading-tight">
                    {formatCOPFull(Number(pedido.valor_recaudar))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[9px] text-gold-dark font-semibold">Cupo disponible</div>
                  <div className="text-xs font-semibold text-foreground tabular-nums">
                    {formatCOP(cupoCODRestante)}
                  </div>
                </div>
              </div>
            ) : pedido.valor_recaudar && !isCOD ? (
              <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-sm font-semibold text-foreground">Pedido pagado</span>
                </div>
                <span className="text-sm font-semibold text-success tabular-nums">
                  {formatCOPFull(Number(pedido.valor_recaudar))}
                </span>
              </div>
            ) : null}

            {/* Cliente */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold text-sm flex-shrink-0">
                  {getInitials(pedido.cliente_nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {pedido.cliente_nombre || "Sin nombre"}
                  </div>
                  {pedido.client_phone && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {pedido.client_phone}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onCall(pedido.client_phone)}
                    disabled={!pedido.client_phone}
                    className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-primary/90"
                    aria-label="Llamar"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onWhatsApp(pedido.client_phone)}
                    disabled={!pedido.client_phone}
                    className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/70 text-foreground border border-border flex items-center justify-center disabled:opacity-40 transition-colors"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Dirección */}
              <div className="bg-muted/40 border border-border rounded-xl p-3 flex items-start gap-2">
                <MapPin className="h-4 w-4 text-pink flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground leading-snug">
                    {pedido.direccion_entrega || "Sin dirección"}
                  </div>
                  {pedido.corte_horario && (
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Corte: {pedido.corte_horario}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Productos */}
            {orderItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Productos · {orderItems.length} {orderItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {orderItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 bg-card border border-border rounded-lg p-2.5"
                    >
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {item.product_name || "Producto sin nombre"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.sku ? `SKU: ${item.sku} · ` : ""}Cantidad {item.quantity ?? 1}
                        </div>
                      </div>
                    </div>
                  ))}
                  {orderItems.length > 3 && (
                    <div className="text-[11px] text-muted-foreground text-center py-1">
                      + {orderItems.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            {statusLogs.length > 0 && (
              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Timeline del pedido
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-1 top-1 bottom-1 w-[1.5px] bg-border" />
                  {TIMELINE_STAGES.map((stage, idx) => {
                    const isCompleted = completedStages.has(stage.key);
                    const isCurrent = !isCompleted && idx > 0 &&
                      completedStages.has(TIMELINE_STAGES[idx - 1].key);
                    const isActive = isCompleted && currentStageKey === stage.key && !isEntregado;
                    const ts = stageTimestamps[stage.key];

                    return (
                      <div
                        key={stage.key}
                        className={cn(
                          "relative mb-2.5 last:mb-0",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute -left-5 top-0.5 w-3 h-3 rounded-full border-2 border-background",
                            isActive
                              ? "bg-gold shadow-[0_0_0_3px_rgba(245,197,24,0.25)]"
                              : isCompleted
                              ? "bg-success"
                              : "bg-border",
                          )}
                        />
                        <div
                          className={cn(
                            "text-xs font-semibold leading-tight",
                            isCompleted || isActive ? "text-foreground" : "text-muted-foreground/60",
                          )}
                        >
                          {stage.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {ts ? formatTimeAgo(ts) : isCurrent ? "En curso" : "Pendiente"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pedido.foto_evidencia && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Evidencia
                </div>
                <img
                  src={pedido.foto_evidencia}
                  alt="Evidencia de entrega"
                  className="w-full h-32 object-cover rounded-xl border border-border"
                />
              </div>
            )}

            {/* Chat inline */}
            {chatComponent && chatOpen && <div className="rounded-xl overflow-hidden border border-border">{chatComponent}</div>}

          </div>
        </div>

        {/* ============ FOOTER DE ACCIONES ============ */}
        <div className="border-t border-border bg-card p-3 space-y-2 flex-shrink-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {/* Acción primaria: Navegar */}
          {!isEntregado && (
            <button
              onClick={onNavigate}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Navigation className="h-4 w-4" />
              {isEnRuta ? "Continuar navegación" : "Iniciar navegación"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          )}

          {/* Acciones de entrega (solo si en ruta) */}
          {isEnRuta && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onCapturePhoto}
                disabled={isFlex && !userLocation}
                className="h-11 bg-success/10 hover:bg-success/15 text-success border border-success/30 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Entregar
              </button>
              <button
                onClick={onReportNovedad}
                className="h-11 bg-pink/10 hover:bg-pink/15 text-pink-dark border border-pink/30 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Reportar novedad
              </button>
            </div>
          )}

          {/* Acciones secundarias */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onWaze}
              className="h-10 bg-muted hover:bg-muted/70 text-foreground rounded-lg font-medium text-[11px] flex items-center justify-center gap-1 transition-colors border border-border"
            >
              <Navigation className="h-3.5 w-3.5" />
              Waze
            </button>
            <button
              onClick={onShareLocation}
              disabled={!pedido.client_phone || !userLocation}
              className="h-10 bg-muted hover:bg-muted/70 text-foreground rounded-lg font-medium text-[11px] flex items-center justify-center gap-1 transition-colors border border-border disabled:opacity-40"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartir
            </button>
            <button
              onClick={onToggleChat}
              className="h-10 bg-muted hover:bg-muted/70 text-foreground rounded-lg font-medium text-[11px] flex items-center justify-center gap-1 transition-colors border border-border"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {chatOpen ? "Cerrar chat" : "Chat"}
            </button>
          </div>

          {/* QR Payment para COD */}
          {isCOD && pedido.valor_recaudar && (
            <button
              onClick={onPayWithQR}
              className="w-full h-10 bg-gradient-to-r from-pink to-pink-dark text-pink-foreground rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors hover:opacity-95"
            >
              <QrCode className="h-4 w-4" />
              Pagar con QR · {formatCOP(Number(pedido.valor_recaudar))}
            </button>
          )}

          {/* Footer de confianza */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Pedido verificado</span>
            </div>
            {tiendaNombre && <span className="truncate ml-2">{tiendaNombre}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidoDetailView;

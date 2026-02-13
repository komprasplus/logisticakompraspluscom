import { useMemo, useState, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Package,
  Loader2,
  MessageSquare,
  Printer,
  Image,
  MapPin,
  Phone,
  DollarSign,
  TrendingUp,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/tarifas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: magic number `12000` extraído como constante.
  Mismo fix aplicado en DevolucionesView y getNetProfit de InventarioView.
*/
const FLETE_DEFAULT = 12000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX: `getNetProfit` movida fuera del componente.
  Era una función pura sin dependencias del scope recreada en cada render.

  FIX: `||` → `??` para valores financieros.
  `pedido.valor_flete || 12000` trataba `0` como "sin flete", saltando al
  default. Un pedido exonerado con `valor_flete: 0` mostraría utilidad
  incorrecta. Mismo bug crítico corregido en DevolucionesView.

  FIX: `pedido.valor_recaudar || 0` trataba `valor_recaudar: 0` como nulo.
*/
const getNetProfit = (pedido: Pedido): number => {
  if (pedido.metodo_pago === "anticipado") return 0;
  if (pedido.utilidad !== null && pedido.utilidad !== undefined) {
    return pedido.utilidad;
  }
  const flete = pedido.valor_flete ?? FLETE_DEFAULT;
  return (pedido.valor_recaudar ?? 0) - flete;
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
  producto_nombre: string | null;
  valor_recaudar: number | null;
  valor_flete?: number | null;
  utilidad?: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

interface NovedadesViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onRespond: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
  onRefresh?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const NovedadesView = ({ pedidos, loading, onRespond, onPrint, onViewEvidence, onRefresh }: NovedadesViewProps) => {
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  /*
    FIX: `selectedDate` era compartido entre todos los pedidos.
    Si el usuario abría el Popover del pedido A, seleccionaba una fecha pero
    cancelaba, y luego abría el Popover del pedido B — el estado `selectedDate`
    del pedido A podría interferir visualmente. Ahora se rastrea por pedido ID.
  */
  const [selectedDates, setSelectedDates] = useState<Record<number, Date | undefined>>({});
  /*
    FIX: estado para controlar qué Popover está abierto programáticamente.
    Necesario para cerrarlo después de confirmar el reagendamiento.
  */
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);

  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useCallback(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  /*
    FIX: `novedades` en useMemo.
    El filtro se ejecutaba en cada render de NovedadesView y de todos sus
    nodos padre. Con listas grandes (50+ pedidos) se filtraba innecesariamente.
  */
  const novedades = useMemo(() => pedidos.filter((p) => p.estado?.toLowerCase() === "novedad"), [pedidos]);

  // ── Handler de reprogramación ──────────────────────────────────────────────

  const handleReschedule = useCallback(
    async (pedidoId: number, newDate: Date) => {
      setReschedulingId(pedidoId);
      setOpenPopoverId(null); // Cerrar el popover al iniciar
      try {
        const formattedDate = format(newDate, "yyyy-MM-dd");

        /*
          FIX: `new Date().toLocaleString("es-CO", ...)` para el timestamp del
          sistema produce un string como "13/2/2026, 10:30:00 a.m." que varía
          según el locale del sistema. Reemplazado con `toISOString()` para el
          almacenamiento de `fecha_actualizacion`, y una cadena formateada
          estable para las observaciones legibles.
        */
        const now = new Date();
        const timestampLabel = format(now, "dd/MM/yyyy HH:mm", { locale: es });

        // Obtener observaciones actuales
        const { data: currentPedido } = await supabase
          .from("pedidos")
          .select("observaciones")
          .eq("id", pedidoId)
          .maybeSingle();

        const systemNote = `[SISTEMA ${timestampLabel}] Reprogramado por tienda para: ${format(newDate, "PPP", { locale: es })}`;
        const newObs = currentPedido?.observaciones ? `${currentPedido.observaciones}\n${systemNote}` : systemNote;

        const { error } = await supabase
          .from("pedidos")
          .update({
            fecha_entrega: formattedDate,
            estado: "Asignado",
            observaciones: newObs,
            fecha_actualizacion: now.toISOString(),
          })
          .eq("id", pedidoId);

        if (cancelRef.current) return;
        if (error) throw error;

        toast.success(`Pedido reprogramado para ${format(newDate, "PPP", { locale: es })}`);
        // Limpiar la fecha seleccionada de este pedido
        setSelectedDates((prev) => ({ ...prev, [pedidoId]: undefined }));
        onRefresh?.();
      } catch (error) {
        if (cancelRef.current) return;
        console.error("Error rescheduling:", error);
        toast.error("Error al reprogramar el pedido");
      } finally {
        if (!cancelRef.current) setReschedulingId(null);
      }
    },
    [onRefresh],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30 flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Gestión de Novedades</h2>
          <p className="text-sm text-muted-foreground">
            {novedades.length} pedido{novedades.length !== 1 ? "s" : ""} requiere{novedades.length !== 1 ? "n" : ""}{" "}
            atención
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4" role="note">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-orange-700">¿Qué es una novedad?</p>
            <p className="text-sm text-orange-600 mt-1">
              Una novedad ocurre cuando no fue posible entregar el pedido en el primer intento. Puedes responder con
              instrucciones adicionales para reprogramar la entrega.
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Cargando novedades...">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : novedades.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">¡Excelente!</h3>
          <p className="text-muted-foreground">No tienes pedidos con novedad pendiente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {novedades.map((pedido, index) => {
            const netProfit = getNetProfit(pedido);

            return (
              <motion.div
                key={pedido.id}
                className="rounded-2xl bg-card border-2 border-orange-300 overflow-hidden shadow-lg shadow-orange-500/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : index * 0.05 }}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase">Novedad</span>
                  </div>
                  <span className="text-sm font-bold text-white/90">{pedido.numero_guia || `#${pedido.id}`}</span>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Motivo de la novedad */}
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">Motivo:</p>
                    <p className="text-sm text-orange-600 font-medium">{pedido.tipo_novedad || "No especificado"}</p>
                  </div>

                  {/* Destinatario */}
                  <div>
                    <p className="font-bold text-foreground text-base truncate">
                      {pedido.cliente_nombre || "Sin nombre"}
                    </p>
                    <div className="flex items-start gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {pedido.direccion_entrega || "Sin dirección"}
                        {pedido.barrio && ` - ${pedido.barrio}`}
                      </p>
                    </div>
                    {pedido.client_phone && (
                      <a
                        href={`tel:${pedido.client_phone.replace(/[\s\-().]/g, "")}`}
                        className="flex items-center gap-1.5 mt-1 hover:text-primary transition-colors"
                        aria-label={`Llamar a ${pedido.cliente_nombre ?? "cliente"}: ${pedido.client_phone}`}
                      >
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <p className="text-xs text-muted-foreground">{pedido.client_phone}</p>
                      </a>
                    )}
                  </div>

                  {/* Métricas financieras */}
                  {pedido.metodo_pago !== "anticipado" && (
                    <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-muted/50">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
                          <DollarSign className="h-4 w-4 text-green-600" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recaudar</p>
                          <p className="text-sm font-bold text-green-600">{formatCOP(pedido.valor_recaudar ?? 0)}</p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${netProfit > 0 ? "bg-emerald-500/15" : "bg-destructive/15"}`}
                        >
                          <TrendingUp
                            className={`h-4 w-4 ${netProfit > 0 ? "text-emerald-600" : "text-destructive"}`}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Utilidad</p>
                          <p className={`text-sm font-bold ${netProfit > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {formatCOP(netProfit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Foto de evidencia */}
                  {pedido.foto_evidencia && (
                    <button
                      type="button"
                      onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                      aria-label={`Ver foto de evidencia de entrega fallida para ${pedido.cliente_nombre ?? "este pedido"}`}
                      className="w-full rounded-xl overflow-hidden border-2 border-border hover:border-orange-400 transition-colors group relative h-28"
                    >
                      <img
                        src={pedido.foto_evidencia}
                        alt={`Evidencia de novedad — ${pedido.cliente_nombre ?? pedido.numero_guia ?? `#${pedido.id}`}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Image className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs py-2 text-center">
                        Ver evidencia del motorizado
                      </div>
                    </button>
                  )}
                </div>

                {/* Card Footer - Acciones */}
                <div className="px-4 pb-4 pt-0 space-y-2">
                  {/* Fila de acciones primarias */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => onRespond(pedido)}
                      className="flex-1 h-11 gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                      aria-label={`Responder novedad del pedido ${pedido.numero_guia ?? `#${pedido.id}`}`}
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      Responder Novedad
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-4 border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={() => onPrint(pedido)}
                      aria-label={`Imprimir guía del pedido ${pedido.numero_guia ?? `#${pedido.id}`}`}
                    >
                      <Printer className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Reprogramar */}
                  <Popover
                    open={openPopoverId === pedido.id}
                    onOpenChange={(open) => setOpenPopoverId(open ? pedido.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                        disabled={reschedulingId === pedido.id}
                        aria-busy={reschedulingId === pedido.id}
                        aria-label={`Reprogramar fecha de entrega para ${pedido.cliente_nombre ?? `pedido #${pedido.id}`}`}
                      >
                        {reschedulingId === pedido.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                        )}
                        Reprogramar Entrega
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <div className="p-3 pb-0 flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Selecciona una fecha</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setOpenPopoverId(null)}
                          aria-label="Cerrar selector de fecha"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <CalendarPicker
                        mode="single"
                        selected={selectedDates[pedido.id]}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDates((prev) => ({ ...prev, [pedido.id]: date }));
                            handleReschedule(pedido.id, date);
                          }
                        }}
                        /*
                          FIX: `date < addDays(new Date(), 1)` sin timezone.
                          `new Date()` usa la hora local del navegador. En Colombia
                          (UTC-5) a las 11pm, `new Date()` es el día actual pero
                          en UTC ya es el día siguiente — el calendario podría
                          deshabilitar el día correcto de manera inconsistente.
                          Corregido usando `startOfDay` para comparar solo fechas
                          sin componente de hora.
                        */
                        disabled={(date) => date < startOfDay(addDays(new Date(), 1))}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default NovedadesView;

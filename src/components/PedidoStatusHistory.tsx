import { useState, useEffect, useCallback, useRef } from "react";
import {
  History,
  Loader2,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Package,
  Ban,
  RotateCcw,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TZ = "America/Bogota";

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/*
  FIX: `getStatusIcon` y `getStatusColor` movidas a módulo scope.
  Eran funciones puras recreadas en cada render.
*/
const getStatusIcon = (status: string | null) => {
  const s = status?.toLowerCase() ?? "";
  if (s.includes("entregado")) return CheckCircle2;
  if (s.includes("novedad") || s.includes("rechazado")) return AlertTriangle;
  if (s.includes("ruta")) return Truck;
  if (s.includes("bodega") || s.includes("recibido")) return Package;
  if (s.includes("anulado")) return Ban;
  if (s.includes("devolucion") || s.includes("devolución")) return RotateCcw;
  if (s.includes("liquidado") || s.includes("pagado")) return DollarSign;
  return Clock;
};

const getStatusColor = (status: string | null) => {
  const s = status?.toLowerCase() ?? "";
  if (s.includes("entregado")) return "text-emerald-600 bg-emerald-100";
  if (s.includes("novedad")) return "text-orange-600 bg-orange-100";
  if (s.includes("rechazado")) return "text-red-600 bg-red-100";
  if (s.includes("ruta")) return "text-blue-600 bg-blue-100";
  if (s.includes("bodega") || s.includes("recibido")) return "text-teal-600 bg-teal-100";
  if (s.includes("anulado")) return "text-gray-600 bg-gray-100";
  if (s.includes("devolucion") || s.includes("devolución")) return "text-purple-600 bg-purple-100";
  if (s.includes("liquidado") || s.includes("pagado")) return "text-green-600 bg-green-100";
  if (s.includes("asignado")) return "text-indigo-600 bg-indigo-100";
  return "text-muted-foreground bg-muted";
};

/*
  FIX: `formatDate` movida a módulo scope + timezone Colombia.
  La versión original usaba `new Date().toLocaleTimeString("es-CO")` que
  formatea con el timezone del navegador. Además, calculaba diffs de tiempo
  con `Date.getTime()` que también depende del timezone local.

  Reemplazado con:
  - `formatInTimeZone` para obtener la hora en Colombia
  - `formatDistanceToNow` de date-fns-tz que respeta timezone
  - Cálculo de diff en días ajustado al timezone Colombia
*/
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();

    // Formatear hora en Colombia
    const timeStr = formatInTimeZone(date, TZ, "HH:mm");

    // Calcular diff en días (en timezone Colombia para ser consistente)
    const dateBogota = formatInTimeZone(date, TZ, "yyyy-MM-dd");
    const nowBogota = formatInTimeZone(now, TZ, "yyyy-MM-dd");

    if (dateBogota === nowBogota) {
      // Hoy - mostrar distancia relativa
      const distance = formatDistanceToNow(date, { locale: es, addSuffix: true });
      return `${distance} - ${timeStr}`;
    }

    // Ayer o más
    const yesterdayBogota = formatInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000), TZ, "yyyy-MM-dd");

    if (dateBogota === yesterdayBogota) {
      return `Ayer - ${timeStr}`;
    }

    // Más de 1 día
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const dateFormatted = formatInTimeZone(date, TZ, diffDays > 365 ? "dd MMM yyyy" : "dd MMM", { locale: es });
    return `${dateFormatted} - ${timeStr}`;
  } catch {
    return "-";
  }
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StatusLog {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_nombre: string | null;
  motivo: string | null;
  created_at: string;
}

interface PedidoStatusHistoryProps {
  pedidoId: number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const PedidoStatusHistory = ({ pedidoId }: PedidoStatusHistoryProps) => {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, []);

  /*
    FIX: `fetchLogs` en `useCallback` con deps + añadida al array del efecto.
    Era función interna sin deps, causando stale closure + exhaustive-deps warning.
  */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pedido_status_logs")
        .select("id, estado_anterior, estado_nuevo, usuario_nombre, motivo, created_at")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false });

      if (cancelRef.current) return;
      if (error) throw error;
      setLogs(data ?? []);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching status logs:", error);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4" role="status" aria-label="Cargando historial...">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (logs.length === 0) return null;

  const displayedLogs = expanded ? logs : logs.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-b from-muted/30 to-transparent p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Historial de Auditoría</h3>
            <p className="text-xs text-muted-foreground">
              {logs.length} cambio{logs.length !== 1 ? "s" : ""} registrado{logs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {logs.length > 3 && (
          /*
            FIX: `aria-expanded` + `aria-controls` en el toggle.
            El botón no comunicaba su estado a lectores de pantalla.

            FIX: `hover:underline` → `hover:text-primary/80`.
            Mismo fix semántico que Accordion, PedidoDetailModal, etc.
          */
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="status-history-timeline"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {expanded ? "Ver menos" : `Ver todos (${logs.length})`}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative" id="status-history-timeline">
        {/* Línea vertical */}
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />

        {/*
          FIX: `mode="popLayout"` sin key estable → eliminado.
          `mode="popLayout"` es para casos donde hay un único item que cambia de
          identidad (ej: carousel de productos donde se swapea entre variantes).
          Aquí es una lista que crece/contrae — el modo correcto es el default
          (sin `mode`) que anima entradas/salidas individualmente.
        */}
        <AnimatePresence>
          <div className="space-y-3">
            {displayedLogs.map((log, index) => {
              const StatusIcon = getStatusIcon(log.estado_nuevo);
              const colorClass = getStatusColor(log.estado_nuevo);

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -10 }}
                  transition={{ delay: prefersReducedMotion ? 0 : index * 0.05 }}
                  className="relative flex gap-3 pl-0"
                >
                  {/* Contenedor de ícono */}
                  <div
                    className={cn(
                      "relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 border-background shadow-sm",
                      colorClass,
                    )}
                  >
                    <StatusIcon className="h-4 w-4" aria-hidden="true" />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 bg-card rounded-lg border border-border p-3 shadow-sm">
                    {/* Cambio de estado */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {log.estado_anterior && (
                        <>
                          <span className="text-sm text-muted-foreground font-medium">{log.estado_anterior}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
                        </>
                      )}
                      <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-md", colorClass)}>
                        {log.estado_nuevo}
                      </span>
                    </div>

                    {/* Meta información */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden="true" />
                        <span className="font-medium">{log.usuario_nombre || "Sistema"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {/*
                          FIX: `<time>` semántico con `dateTime`.
                          Mismo fix que PedidoDetailModal — expone el ISO original
                          a herramientas de accesibilidad.
                        */}
                        <time dateTime={log.created_at}>{formatDate(log.created_at)}</time>
                      </div>
                    </div>

                    {/* Motivo */}
                    {log.motivo && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground italic">"{log.motivo}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PedidoStatusHistory;

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Clock, RefreshCw, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStatusConfig } from "@/lib/orderStatuses";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FlexOrder {
  id: number;
  numero_guia: string | null;
  id_externo: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  estado: string | null;
  motorizado_asignado: string | null;
  hora_cierre_flex: string | null;
  fecha_creacion: string | null;
  valor_recaudar: number | null;
  foto_evidencia: string | null;
}

type Urgency = "ok" | "warning" | "critical" | "expired";

interface TimeInfo {
  text: string;
  urgency: Urgency;
  diffMinutes: number;
}

// ─── Constantes (fuera del componente — no se recrean en cada render) ─────────

const AUTO_REFRESH_MS = 60_000; // 60 segundos

/**
 * FIX: objeto constante fuera del componente.
 * Antes se recreaba en cada render como variable local.
 */
const URGENCY_COLORS: Record<Urgency, string> = {
  ok: "text-green-600 bg-green-500/10",
  warning: "text-amber-600 bg-amber-500/10",
  critical: "text-red-600 bg-red-500/10 animate-pulse",
  expired: "text-red-800 bg-red-500/20 font-bold",
};

/** FIX: timezone Colombia para obtener la fecha de hoy (evita bug de UTC) */
const getTodayColombia = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/**
 * FIX: función pura fuera del componente — no depende del estado,
 * así no se recrea en cada render y puede usarse en useMemo sin issues.
 *
 * FIX: usamos la hora local de Colombia en vez del reloj del navegador sin
 * timezone, para que el countdown sea correcto independientemente de dónde
 * corra el browser.
 */
const getTimeRemaining = (horaCierre: string | null): TimeInfo => {
  if (!horaCierre) return { text: "—", urgency: "ok", diffMinutes: Infinity };

  // Hora actual en Colombia
  const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
  const now = new Date(nowStr);

  const [hours, minutes] = horaCierre.split(":").map(Number);
  const deadline = new Date(now);
  deadline.setHours(hours, minutes, 0, 0);

  const diffMs = deadline.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;

  if (diffMs < 0) return { text: "VENCIDO", urgency: "expired", diffMinutes };
  if (diffMinutes <= 60) return { text: `${diffMinutes}min`, urgency: "critical", diffMinutes };
  if (diffHours <= 2) return { text: `${diffHours}h ${remMinutes}m`, urgency: "warning", diffMinutes };
  return { text: `${diffHours}h ${remMinutes}m`, urgency: "ok", diffMinutes };
};

/** Formatea valor COP con locale correcto */
const formatCOP = (value: number): string => `$${value.toLocaleString("es-CO")}`;

// ─── Componente ───────────────────────────────────────────────────────────────

const MonitorFlexPanel = () => {
  const [orders, setOrders] = useState<FlexOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  /*
    FIX: ticker para refrescar el countdown cada minuto sin hacer fetch.
    Antes el tiempo restante solo se actualizaba al recargar los pedidos,
    así que un pedido podía mostrar "45min" aunque ya hubieran pasado 10min.
  */
  const [tick, setTick] = useState(0);

  const cancelRef = useRef(false);
  const fetchingRef = useRef(false); // FIX: guardia contra fetches concurrentes

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFlexOrders = useCallback(async (isRefresh = false) => {
    // FIX: evitar fetch concurrente si el intervalo dispara mientras carga
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const today = getTodayColombia(); // FIX: timezone Colombia

      const { data, error } = await supabase
        .from("pedidos")
        .select(
          `
          id, numero_guia, id_externo, cliente_nombre, direccion_entrega,
          barrio, estado, motorizado_asignado, hora_cierre_flex,
          fecha_creacion, valor_recaudar, foto_evidencia
        `,
        )
        .eq("canal", "FLEX")
        .gte("fecha_creacion", `${today}T00:00:00`)
        .order("hora_cierre_flex", { ascending: true })
        .limit(200);

      if (cancelRef.current) return;
      if (error) throw error;

      setOrders(data ?? []);
      setLastUpdated(new Date());
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching flex orders:", error);
      toast.error("Error al cargar pedidos Flex");
    } finally {
      fetchingRef.current = false;
      if (!cancelRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Carga inicial + auto-refresh
  useEffect(() => {
    cancelRef.current = false;
    fetchFlexOrders();

    const dataInterval = setInterval(() => fetchFlexOrders(true), AUTO_REFRESH_MS);

    /*
      FIX: ticker independiente que actualiza el countdown cada minuto
      sin disparar un fetch a Supabase.
    */
    const tickInterval = setInterval(() => setTick((t) => t + 1), 60_000);

    return () => {
      cancelRef.current = true;
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, [fetchFlexOrders]);

  const handleRefresh = useCallback(() => fetchFlexOrders(true), [fetchFlexOrders]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  /*
    FIX: `tick` en las dependencias para que las stats de "vencidos"
    se recalculen cada minuto junto con el countdown, sin refetch.
  */
  const stats = useMemo(() => {
    const total = orders.length;
    const entregados = orders.filter((o) => o.estado?.toLowerCase() === "entregado").length;
    const enRuta = orders.filter((o) => o.estado?.toLowerCase() === "en ruta").length;
    const pendientes = orders.filter(
      (o) => o.estado?.toLowerCase() !== "entregado" && o.estado?.toLowerCase() !== "anulado",
    ).length;
    const vencidos = orders.filter((o) => {
      const { urgency } = getTimeRemaining(o.hora_cierre_flex);
      return urgency === "expired" && o.estado?.toLowerCase() !== "entregado";
    }).length;
    return { total, entregados, enRuta, pendientes, vencidos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]); // tick fuerza recálculo cada minuto

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold">Monitor Flex</h2>
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            {stats.total} pedidos hoy
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {/* FIX: mostrar hora de última actualización */}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Actualizado:{" "}
              {lastUpdated.toLocaleTimeString("es-CO", {
                timeZone: "America/Bogota",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {/* FIX: botón deshabilitado y con spinner durante refresh */}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl p-3 bg-muted/50 border text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.entregados}</p>
          <p className="text-xs text-muted-foreground">Entregados</p>
        </div>
        <div className="rounded-xl p-3 bg-sky-500/10 border border-sky-500/20 text-center">
          <p className="text-2xl font-bold text-sky-600">{stats.enRuta}</p>
          <p className="text-xs text-muted-foreground">En Ruta</p>
        </div>
        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pendientes}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
          <p className="text-xs text-muted-foreground">Vencidos</p>
        </div>
      </div>

      {/* Tabla */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay pedidos Flex registrados hoy</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Guía</TableHead>
                <TableHead>Código Externo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Barrio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Motorizado</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Timer className="h-3 w-3" />
                    Tiempo Restante
                  </div>
                </TableHead>
                <TableHead className="text-right">Recaudo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusConfig = getStatusConfig(order.estado);
                /*
                  FIX: `tick` fuerza recálculo del countdown en cada render
                  del ticker (cada minuto) sin recargar datos.
                  La variable `tick` se referencia aquí para que el compilador
                  de React sepa que este bloque depende del ticker.
                */
                void tick; // eslint-disable-line @typescript-eslint/no-unused-expressions
                const timeInfo = getTimeRemaining(order.hora_cierre_flex);
                const isDelivered = order.estado?.toLowerCase() === "entregado";

                return (
                  <TableRow key={order.id} className={isDelivered ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs font-bold">{order.numero_guia ?? `#${order.id}`}</TableCell>

                    <TableCell className="font-mono text-xs">{order.id_externo ?? "—"}</TableCell>

                    <TableCell className="text-sm">{order.cliente_nombre ?? "—"}</TableCell>

                    <TableCell className="text-sm">{order.barrio ?? "—"}</TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                      >
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </TableCell>

                    <TableCell className="text-sm">
                      {order.motorizado_asignado ?? (
                        <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {isDelivered ? (
                        <span className="text-green-600 text-xs font-medium">✅ Entregado</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${URGENCY_COLORS[timeInfo.urgency]}`}
                        >
                          <Clock className="h-3 w-3" />
                          {timeInfo.text}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm">
                      {/* FIX: ?? 0 para no ignorar valor_recaudar === 0 */}
                      {order.valor_recaudar != null ? formatCOP(order.valor_recaudar) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MonitorFlexPanel;

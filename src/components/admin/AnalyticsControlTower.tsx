import { useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Truck, Clock, Trophy, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Pedido {
  id: number;
  estado: string | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  zona: string | null;
  municipio?: string | null;
  barrio: string | null;
  fecha_creacion: string | null;
  fecha_entrega: string | null;
}

interface Motorizado {
  id: string;
  user_id: string;
  full_name: string;
  is_online?: boolean;
}

interface AnalyticsControlTowerProps {
  pedidos: Pedido[];
  motorizados: Motorizado[];
}

// ─── Constantes (fuera del componente para evitar recreación en cada render) ──

/** Estados normalizados — editar aquí si el backend cambia algún valor */
const ESTADOS = {
  EN_RUTA: "en ruta",
  EN_CAMINO: "en camino",
  ENTREGADO: "entregado",
  ASIGNADO: "asignado",
  PENDIENTE: "pendiente",
  RECIBIDO_BODEGA: "recibido en bodega",
  NOVEDAD: "novedad",
  RECHAZADO: "rechazado",
  DEVOLUCION: "devolución",
} as const;

/** Métodos de pago contra-entrega */
const METODOS_COD = ["efectivo", "contra entrega", "cod"] as const;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/** Formatea un número como moneda COP */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isEstado = (estado: string | null, ...valores: string[]) => valores.includes(estado?.toLowerCase() ?? "");

const isCOD = (metodo: string | null) => METODOS_COD.includes(metodo?.toLowerCase() as (typeof METODOS_COD)[number]);

/** Obtiene la hora local en Colombia a partir de una fecha ISO (evita bug de UTC) */
const getHourColombia = (isoDate: string): number =>
  parseInt(
    new Date(isoDate).toLocaleString("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hour12: false,
    }),
    10,
  );

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorClass,
  delay = 0,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  colorClass: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="neu-card p-5 rounded-3xl relative overflow-hidden group"
  >
    {/*
      FIX: antes el inline style `opacity: 0.05` sobreescribía siempre las
      clases de Tailwind, así que el efecto hover nunca se veía.
      Ahora se usan solo clases Tailwind para que la transición funcione.
    */}
    <div
      className={cn(
        "absolute inset-0 opacity-[0.04] group-hover:opacity-[0.12] transition-opacity duration-500",
        `bg-gradient-to-br ${colorClass}`,
      )}
    />

    <div className="flex items-start justify-between relative z-10">
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs font-semibold",
              trend.isPositive ? "text-emerald-500" : "text-red-500",
            )}
          >
            <TrendingUp className={cn("h-3 w-3", !trend.isPositive && "rotate-180")} />
            <span>{trend.value}% vs ayer</span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
          `bg-gradient-to-br ${colorClass}`,
        )}
      >
        <Icon className="h-7 w-7 text-white" strokeWidth={2} />
      </div>
    </div>
  </motion.div>
);

const ChartCard = ({
  title,
  children,
  delay = 0,
  className,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={cn("neu-card rounded-3xl p-5", className)}
  >
    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">{title}</h3>
    {children}
  </motion.div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const AnalyticsControlTower = ({ pedidos, motorizados }: AnalyticsControlTowerProps) => {
  // FIX: timezone correcta para Colombia en lugar de usar el reloj del browser
  const today = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }), []);

  // Pedidos del día actual
  const todayPedidos = useMemo(
    () =>
      pedidos.filter((p) => {
        const createdDate = p.fecha_creacion?.split("T")[0];
        const deliveryDate = p.fecha_entrega;
        return createdDate === today || deliveryDate === today;
      }),
    [pedidos, today],
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    // Efectivo en calle: órdenes COD actualmente en ruta
    const enRutaOrders = pedidos.filter((p) => isEstado(p.estado, ESTADOS.EN_RUTA, ESTADOS.EN_CAMINO));
    const efectivoEnCalle = enRutaOrders
      .filter((p) => isCOD(p.metodo_pago))
      .reduce((sum, p) => sum + (p.valor_recaudar ?? 0), 0);

    // Eficiencia: entregas exitosas sobre intentos finalizados del día
    const todayDelivered = todayPedidos.filter((p) => isEstado(p.estado, ESTADOS.ENTREGADO)).length;
    const todayNovedades = todayPedidos.filter(
      (p) =>
        p.estado?.toLowerCase().includes(ESTADOS.NOVEDAD) || isEstado(p.estado, ESTADOS.RECHAZADO, ESTADOS.DEVOLUCION),
    ).length;
    const todayAttempted = todayDelivered + todayNovedades;

    /*
      FIX de lógica: si hay menos de 5 intentos la métrica no es
      representativa (a las 8am puede mostrar 100% con 1 entrega).
      Devolvemos -1 como señal para mostrar "Sin datos suficientes".
    */
    const eficiencia = todayAttempted >= 5 ? Math.round((todayDelivered / todayAttempted) * 100) : -1;

    // Flota activa: motorizados con pedidos en curso ahora mismo
    const activeMotorizadoIds = new Set(
      pedidos
        .filter((p) => p.motorizado_id && isEstado(p.estado, ESTADOS.EN_RUTA, ESTADOS.ASIGNADO, ESTADOS.EN_CAMINO))
        .map((p) => p.motorizado_id),
    );

    // Órdenes pendientes: sin asignar o recién recibidas en bodega
    const ordenesPendientes = pedidos.filter(
      (p) => !p.motorizado_asignado || isEstado(p.estado, ESTADOS.RECIBIDO_BODEGA, ESTADOS.PENDIENTE),
    ).length;

    return {
      efectivoEnCalle,
      eficiencia,
      eficienciaLabel: eficiencia === -1 ? "Sin datos suficientes" : `${eficiencia}% (${todayAttempted} intentos)`,
      flotaActiva: activeMotorizadoIds.size,
      ordenesPendientes,
      totalFlota: motorizados.length,
    };
  }, [pedidos, todayPedidos, motorizados]);

  // ── Gráfico: pedidos por hora ────────────────────────────────────────────────

  const deliveriesByHour = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    for (let i = 6; i <= 20; i++) hourCounts[i] = 0;

    todayPedidos.forEach((p) => {
      if (p.fecha_creacion) {
        // FIX: usar timezone Colombia para no desplazar las horas por UTC
        const hour = getHourColombia(p.fecha_creacion);
        if (hour >= 6 && hour <= 20) {
          hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
        }
      }
    });

    return Object.entries(hourCounts).map(([hour, count]) => ({
      hora: `${hour}:00`,
      pedidos: count,
    }));
  }, [todayPedidos]);

  // ── Top 5 zonas ──────────────────────────────────────────────────────────────

  const topZones = useMemo(() => {
    const zoneCounts: Record<string, number> = {};

    todayPedidos.forEach((p) => {
      const zone = p.zona ?? p.municipio ?? p.barrio ?? "Sin zona";
      zoneCounts[zone] = (zoneCounts[zone] ?? 0) + 1;
    });

    return Object.entries(zoneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([zone, count], index) => ({
        zona: zone,
        pedidos: count,
        rank: index + 1,
      }));
  }, [todayPedidos]);

  // ── Top 5 motorizados ────────────────────────────────────────────────────────

  const topMotorizados = useMemo(() => {
    const motoCounts: Record<string, { delivered: number; total: number }> = {};

    todayPedidos.forEach((p) => {
      if (p.motorizado_asignado) {
        if (!motoCounts[p.motorizado_asignado]) {
          motoCounts[p.motorizado_asignado] = { delivered: 0, total: 0 };
        }
        motoCounts[p.motorizado_asignado].total += 1;
        if (isEstado(p.estado, ESTADOS.ENTREGADO)) {
          motoCounts[p.motorizado_asignado].delivered += 1;
        }
      }
    });

    return Object.entries(motoCounts)
      .sort(([, a], [, b]) => b.delivered - a.delivered)
      .slice(0, 5)
      .map(([name, stats], index) => ({
        nombre: name,
        entregados: stats.delivered,
        total: stats.total,
        eficiencia: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0,
        rank: index + 1,
      }));
  }, [todayPedidos]);

  // ── Monitor de recaudos ──────────────────────────────────────────────────────
  /*
    NOTA: usa `pedidos` completos (no solo `todayPedidos`) para rastrear
    la deuda histórica pendiente de cada motorizado, no solo la del día.
    Si solo se quiere ver el día, cambiar `pedidos` por `todayPedidos`.
  */
  const collectionsByMoto = useMemo(() => {
    const collections: Record<string, { name: string; collected: number; pending: number; orders: number }> = {};

    pedidos.forEach((p) => {
      if (p.motorizado_asignado && isCOD(p.metodo_pago)) {
        if (!collections[p.motorizado_asignado]) {
          collections[p.motorizado_asignado] = {
            name: p.motorizado_asignado,
            collected: 0,
            pending: 0,
            orders: 0,
          };
        }

        collections[p.motorizado_asignado].orders += 1;

        if (isEstado(p.estado, ESTADOS.ENTREGADO)) {
          collections[p.motorizado_asignado].collected += p.valor_recaudar ?? 0;
        } else if (isEstado(p.estado, ESTADOS.EN_RUTA, ESTADOS.ASIGNADO)) {
          collections[p.motorizado_asignado].pending += p.valor_recaudar ?? 0;
        }
      }
    });

    return Object.values(collections).sort((a, b) => b.collected + b.pending - (a.collected + a.pending));
  }, [pedidos]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
          <TrendingUp className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">Control Tower Analytics</h1>
          <p className="text-sm text-muted-foreground">Visión en tiempo real de las operaciones</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Efectivo en Calle"
          value={formatCurrency(kpis.efectivoEnCalle)}
          subtitle="COD en ruta actualmente"
          icon={DollarSign}
          colorClass="from-emerald-500 to-teal-500"
          delay={0}
        />
        <KPICard
          title="Eficiencia de Entrega"
          value={kpis.eficiencia === -1 ? "—" : `${kpis.eficiencia}%`}
          subtitle={kpis.eficienciaLabel}
          icon={CheckCircle}
          colorClass="from-blue-500 to-cyan-500"
          delay={0.1}
        />
        <KPICard
          title="Flota Activa"
          value={kpis.flotaActiva}
          subtitle={`de ${kpis.totalFlota} motorizados`}
          icon={Truck}
          colorClass="from-violet-500 to-purple-500"
          delay={0.2}
        />
        <KPICard
          title="Órdenes Pendientes"
          value={kpis.ordenesPendientes}
          subtitle="Sin asignar o escanear"
          icon={Clock}
          colorClass="from-amber-500 to-orange-500"
          delay={0.3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pedidos por hora */}
        <ChartCard title="📊 Volumen de Pedidos por Hora" delay={0.4}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deliveriesByHour}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(217 91% 60%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="pedidos" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top Zonas */}
        <ChartCard title="🔥 Top 5 Zonas con Mayor Demanda" delay={0.5}>
          <div className="space-y-3">
            {topZones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay datos de zonas para hoy</p>
            ) : (
              topZones.map((zone, index) => (
                <motion.div
                  key={zone.zona}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm",
                      index === 0
                        ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                        : index === 1
                          ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800"
                          : index === 2
                            ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {zone.rank}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{zone.zona}</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-500"
                        style={{
                          width: `${(zone.pedidos / (topZones[0]?.pedidos || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">{zone.pedidos}</span>
                </motion.div>
              ))
            )}
          </div>
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Motorizados */}
        <ChartCard title="🏆 Ranking de Desempeño - Top 5" delay={0.6}>
          <div className="space-y-3">
            {topMotorizados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay datos de motorizados para hoy</p>
            ) : (
              topMotorizados.map((moto, index) => (
                <motion.div
                  key={moto.nombre}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center gap-3 neu-flat p-3 rounded-2xl"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      index === 0
                        ? "bg-gradient-to-br from-amber-400 to-amber-600"
                        : index === 1
                          ? "bg-gradient-to-br from-slate-300 to-slate-400"
                          : index === 2
                            ? "bg-gradient-to-br from-amber-600 to-amber-800"
                            : "bg-muted",
                    )}
                  >
                    <Trophy className={cn("h-5 w-5", index < 3 ? "text-white" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{moto.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {moto.entregados} de {moto.total} entregas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">{moto.eficiencia}%</p>
                    <p className="text-xs text-muted-foreground">eficiencia</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ChartCard>

        {/* Monitor de Recaudos */}
        <ChartCard title="💰 Monitor de Recaudos en Tiempo Real" delay={0.7}>
          <div className="overflow-x-auto">
            {collectionsByMoto.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay recaudos pendientes</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Motorizado</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Recaudado</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Pendiente</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/*
                    FIX: reemplazado <motion.tr> por <tr> con CSS animation.
                    Framer Motion sobre elementos de tabla puede generar HTML
                    inválido en algunos browsers (tr necesita estar dentro de
                    tbody/thead directamente, sin wrappers extra).
                  */}
                  {collectionsByMoto.slice(0, 8).map((moto, index) => (
                    <tr
                      key={moto.name}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      style={{
                        opacity: 0,
                        animation: `fadeIn 0.3s ease ${0.7 + index * 0.05}s forwards`,
                      }}
                    >
                      <td className="py-2 px-2 font-medium text-foreground truncate max-w-[120px]">{moto.name}</td>
                      <td className="py-2 px-2 text-right text-emerald-500 font-semibold">
                        {formatCurrency(moto.collected)}
                      </td>
                      <td className="py-2 px-2 text-right text-amber-500 font-semibold">
                        {formatCurrency(moto.pending)}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-foreground">
                        {formatCurrency(moto.collected + moto.pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td className="py-2 px-2 font-bold text-foreground">TOTAL</td>
                    <td className="py-2 px-2 text-right text-emerald-500 font-bold">
                      {formatCurrency(collectionsByMoto.reduce((sum, m) => sum + m.collected, 0))}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-500 font-bold">
                      {formatCurrency(collectionsByMoto.reduce((sum, m) => sum + m.pending, 0))}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-foreground">
                      {formatCurrency(collectionsByMoto.reduce((sum, m) => sum + m.collected + m.pending, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Keyframe global para la animación de las filas de la tabla */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsControlTower;

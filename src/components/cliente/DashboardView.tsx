import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Package, TrendingUp, Wallet, Plus, ArrowRight, History } from "lucide-react";
import { ClienteView } from "./ClienteSidebar";
import { formatCOP } from "@/lib/tarifas";
import AnunciosBanner from "./AnunciosBanner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DashboardViewProps {
  totalMonth: number;
  deliveredCount: number;
  pendingBalance: number;
  onCreatePedido: () => void;
  onNavigate: (view: ClienteView) => void;
  onOpenLedger?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const DashboardView = ({
  totalMonth,
  deliveredCount,
  pendingBalance,
  onCreatePedido,
  onNavigate,
  onOpenLedger,
}: DashboardViewProps) => {
  const prefersReducedMotion = useReducedMotion();

  /*
    FIX: `successRate` clameado a [0, 100].
    Si por inconsistencia de datos `deliveredCount > totalMonth` el valor
    podía superar 100% (ej. "110%") mostrando un KPI engañoso.
  */
  const successRate = useMemo(
    () => (totalMonth > 0 ? Math.min(100, Math.round((deliveredCount / totalMonth) * 100)) : 0),
    [deliveredCount, totalMonth],
  );

  /*
    FIX: `kpiCards` memoizado. Era un array literal reconstruido en cada
    render del componente (incluyendo renders padres que no cambian estos
    valores). Con `useMemo`, solo se recalcula cuando los valores realmente
    cambian.

    FIX: `pendingBalance` formateado con `formatCOP()` en lugar de la
    interpolación manual `$${pendingBalance.toLocaleString("es-CO")}`.
    Todos los demás componentes del proyecto usan el helper para consistencia.
  */
  const kpiCards = useMemo(
    () => [
      {
        title: "Pedidos del Mes",
        value: totalMonth.toString(),
        icon: Package,
        gradient: "from-blue-500 to-blue-600",
        shadow: "shadow-blue-500/30",
        bgIcon: "bg-blue-500/10",
        /*
          FIX: `navigateTo` añadido para que las cards sean realmente
          interactivas — tenían `cursor-pointer`, hover animations y estilos
          de "botón" pero ningún `onClick`, engañando al usuario y rompiendo
          accesibilidad. Ahora cada card navega a la sección correspondiente.
        */
        navigateTo: "pedidos" as ClienteView,
        ariaLabel: `Ver ${totalMonth} pedidos del mes`,
      },
      {
        title: "Tasa de Éxito",
        value: `${successRate}%`,
        icon: TrendingUp,
        gradient: "from-emerald-500 to-emerald-600",
        shadow: "shadow-emerald-500/30",
        bgIcon: "bg-emerald-500/10",
        navigateTo: "reportes" as ClienteView,
        ariaLabel: `Tasa de éxito: ${successRate}%. Ver reportes`,
      },
      {
        title: "Balance Pendiente",
        value: formatCOP(pendingBalance),
        icon: Wallet,
        gradient: "from-amber-500 to-amber-600",
        shadow: "shadow-amber-500/30",
        bgIcon: "bg-amber-500/10",
        navigateTo: "billetera" as ClienteView,
        isLedger: true,
        ariaLabel: `Balance pendiente: ${formatCOP(pendingBalance)}. Ver historial de movimientos`,
      },
    ],
    [totalMonth, successRate, pendingBalance],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Sección de bienvenida */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Panel de Control</h1>
        <p className="text-muted-foreground">Resumen de tu actividad logística este mes</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {kpiCards.map((card, index) => {
          const Icon = card.icon;
          const handleClick = () =>
            (card as { isLedger?: boolean }).isLedger && onOpenLedger
              ? onOpenLedger()
              : onNavigate(card.navigateTo);
          return (
            <motion.button
              key={card.title}
              type="button"
              onClick={handleClick}
              aria-label={card.ariaLabel}
              className="relative group cursor-pointer text-left w-full"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.1 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
            >
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-6 text-white shadow-lg ${card.shadow}`}
              >
                {/* Decoración de fondo */}
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
                {/* Efecto 3D */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 rounded-b-2xl" />

                <div className="relative">
                  <div className={`inline-flex items-center justify-center rounded-xl ${card.bgIcon} p-3 mb-4`}>
                    <Icon className="h-7 w-7 text-white" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-white/80 mb-1">{card.title}</p>
                  <p className="text-3xl font-extrabold">{card.value}</p>
                  {(card as { isLedger?: boolean }).isLedger && (
                    <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                      <History className="h-3 w-3" aria-hidden="true" />
                      Ver historial
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CTA principal: crear pedido */}
        <motion.button
          type="button"
          onClick={onCreatePedido}
          aria-label="Crear nuevo pedido de envío"
          className="relative group flex items-center justify-between rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white overflow-hidden"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-green-700" />
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />

          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 shadow-inner">
              <Plus className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">Crear Nuevo Pedido</p>
              <p className="text-sm text-white/80">Registra un envío rápidamente</p>
            </div>
          </div>
          <ArrowRight className="relative h-6 w-6 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </motion.button>

        {/* Ver pedidos */}
        <motion.button
          type="button"
          onClick={() => onNavigate("pedidos")}
          aria-label="Ver historial completo de pedidos"
          className="relative group flex items-center justify-between rounded-2xl border-2 border-border bg-white p-6 text-foreground overflow-hidden hover:border-primary/50 transition-colors"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">Ver Mis Pedidos</p>
              <p className="text-sm text-muted-foreground">Historial completo de envíos</p>
            </div>
          </div>
          <ArrowRight
            className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
            aria-hidden="true"
          />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default DashboardView;

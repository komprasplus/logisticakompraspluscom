import { motion } from "framer-motion";
import { Package, TrendingUp, Wallet, Plus, ArrowRight } from "lucide-react";
import { ClienteView } from "./ClienteSidebar";

interface DashboardViewProps {
  totalMonth: number;
  deliveredCount: number;
  pendingBalance: number;
  onCreatePedido: () => void;
  onNavigate: (view: ClienteView) => void;
}

const DashboardView = ({
  totalMonth,
  deliveredCount,
  pendingBalance,
  onCreatePedido,
  onNavigate,
}: DashboardViewProps) => {
  const successRate = totalMonth > 0 ? Math.round((deliveredCount / totalMonth) * 100) : 0;

  const kpiCards = [
    {
      title: "Pedidos del Mes",
      value: totalMonth.toString(),
      icon: Package,
      gradient: "from-blue-500 to-blue-600",
      shadow: "shadow-blue-500/30",
      bgIcon: "bg-blue-500/10",
    },
    {
      title: "Tasa de Éxito",
      value: `${successRate}%`,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-emerald-600",
      shadow: "shadow-emerald-500/30",
      bgIcon: "bg-emerald-500/10",
    },
    {
      title: "Balance Pendiente",
      value: `$${pendingBalance.toLocaleString("es-CO")}`,
      icon: Wallet,
      gradient: "from-amber-500 to-amber-600",
      shadow: "shadow-amber-500/30",
      bgIcon: "bg-amber-500/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Welcome Section */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Panel de Control
        </h1>
        <p className="text-muted-foreground">
          Resumen de tu actividad logística este mes
        </p>
      </div>

      {/* KPI Cards - Large 3D Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              className="relative group cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              {/* 3D Card */}
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-6 text-white shadow-lg ${card.shadow}`}>
                {/* Background decoration */}
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
                
                {/* 3D Effect layers */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 rounded-b-2xl" />

                <div className="relative">
                  <div className={`inline-flex items-center justify-center rounded-xl ${card.bgIcon} p-3 mb-4`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white/80 mb-1">{card.title}</p>
                  <p className="text-3xl font-extrabold">{card.value}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Order - Primary CTA */}
        <motion.button
          onClick={onCreatePedido}
          className="relative group flex items-center justify-between rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white overflow-hidden"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-green-700" />
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 shadow-inner">
              <Plus className="h-7 w-7" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">Crear Nuevo Pedido</p>
              <p className="text-sm text-white/80">Registra un envío rápidamente</p>
            </div>
          </div>
          <ArrowRight className="relative h-6 w-6 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* View Orders */}
        <motion.button
          onClick={() => onNavigate("pedidos")}
          className="relative group flex items-center justify-between rounded-2xl border-2 border-border bg-white p-6 text-foreground overflow-hidden hover:border-primary/50 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">Ver Mis Pedidos</p>
              <p className="text-sm text-muted-foreground">Historial completo de envíos</p>
            </div>
          </div>
          <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default DashboardView;

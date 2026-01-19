import { motion } from "framer-motion";
import { Package, CheckCircle2, Wallet } from "lucide-react";

interface ClientStatsCardsProps {
  totalMonth: number;
  deliveredCount: number;
  pendingBalance: number;
}

const ClientStatsCards = ({ totalMonth, deliveredCount, pendingBalance }: ClientStatsCardsProps) => {
  const successRate = totalMonth > 0 ? Math.round((deliveredCount / totalMonth) * 100) : 0;

  const cards = [
    {
      title: "Pedidos del Mes",
      value: totalMonth,
      icon: Package,
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
    },
    {
      title: "Entregas Exitosas",
      value: `${successRate}%`,
      subtitle: `${deliveredCount} de ${totalMonth}`,
      icon: CheckCircle2,
      gradient: "from-green-500 to-green-600",
      iconBg: "bg-green-500/20",
      iconColor: "text-green-600",
    },
    {
      title: "Saldo por Girar",
      value: `$${pendingBalance.toLocaleString("es-CO")}`,
      icon: Wallet,
      gradient: "from-secondary to-secondary/80",
      iconBg: "bg-secondary/20",
      iconColor: "text-secondary-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            className="relative overflow-hidden rounded-2xl bg-card border border-border p-4 shadow-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* 3D Background decoration */}
            <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 blur-xl`} />
            
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </p>
                <p className="text-2xl font-extrabold text-foreground mt-1">
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                )}
              </div>
              
              {/* 3D Icon */}
              <div className="relative">
                <div className={`absolute inset-0 ${card.iconBg} rounded-xl blur-md transform translate-y-1`} />
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg} shadow-lg`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ClientStatsCards;

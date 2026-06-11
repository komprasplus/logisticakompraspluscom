import { Check, Package, Route } from "lucide-react";

interface MotorizadoDailyStatsProps {
  pendientes: number;
  enCamino: number;
  entregados: number;
}

const MotorizadoDailyStats = ({
  pendientes,
  enCamino,
  entregados,
}: MotorizadoDailyStatsProps) => {
  const stats = [
    {
      label: "Asignados",
      value: pendientes,
      icon: Package,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      valueColor: "text-foreground",
    },
    {
      label: "En camino",
      value: enCamino,
      icon: Route,
      iconBg: "bg-gold/15",
      iconColor: "text-gold-dark",
      valueColor: "text-foreground",
    },
    {
      label: "Entregados",
      value: entregados,
      icon: Check,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      valueColor: "text-success",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tu día
        </span>
        <span className="text-[10px] text-muted-foreground">
          {new Date().toLocaleDateString("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-2.5 text-center"
            >
              <div className={`w-7 h-7 mx-auto mb-1.5 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${stat.iconColor}`} strokeWidth={2.5} />
              </div>
              <div className={`text-lg font-bold leading-none tabular-nums ${stat.valueColor}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MotorizadoDailyStats;

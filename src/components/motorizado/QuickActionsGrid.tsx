import { CloudRain, type LucideIcon, Route, ScanLine, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsGridProps {
  onOptimizeRoute: () => void;
  onScanQR: () => void;
  onCallWarehouse: () => void;
  pendientesCount: number;
  weatherTemp?: number | null;
  weatherCondition?: string | null;
  weatherWarning?: string | null;
  isRouteOptimized?: boolean;
}

interface ActionCard {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

const QuickActionsGrid = ({
  onOptimizeRoute,
  onScanQR,
  onCallWarehouse,
  pendientesCount,
  weatherTemp,
  weatherCondition,
  weatherWarning,
  isRouteOptimized,
}: QuickActionsGridProps) => {
  const actions: ActionCard[] = [
    {
      icon: Route,
      iconBg: "bg-primary/8",
      iconColor: "text-primary",
      title: isRouteOptimized ? "Ruta optimizada" : "Optimizar ruta",
      subtitle:
        pendientesCount > 0
          ? `${pendientesCount} ${pendientesCount === 1 ? "parada" : "paradas"}`
          : "Sin paradas",
      onClick: onOptimizeRoute,
      disabled: pendientesCount === 0,
      highlight: isRouteOptimized,
    },
    {
      icon: ScanLine,
      iconBg: "bg-gold/15",
      iconColor: "text-gold-dark",
      title: "Escanear QR",
      subtitle: "Recibir paquete",
      onClick: onScanQR,
    },
    {
      icon: Warehouse,
      iconBg: "bg-pink/8",
      iconColor: "text-pink-dark",
      title: "Llamar bodega",
      subtitle: "324 222 3825",
      onClick: onCallWarehouse,
    },
    {
      icon: CloudRain,
      iconBg: "bg-blue-500/8",
      iconColor: "text-blue-600",
      title:
        weatherTemp != null && weatherCondition
          ? `${Math.round(weatherTemp)}°C · ${weatherCondition}`
          : "Clima",
      subtitle: weatherWarning || "Bogotá",
      onClick: () => {},
      disabled: true,
    },
  ];

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Acciones rápidas
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={i}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "bg-card border rounded-xl p-3 flex items-center gap-2.5 text-left transition-all",
                action.highlight
                  ? "border-success/50 bg-success/5"
                  : "border-border",
                !action.disabled && "hover:bg-muted/40 active:scale-[0.98]",
                action.disabled && "opacity-70 cursor-default",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  action.iconBg,
                )}
              >
                <Icon className={cn("h-4 w-4", action.iconColor)} strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground leading-tight truncate">
                  {action.title}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {action.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsGrid;

import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Gift,
  Loader2,
  PackageCheck,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { useMotorizadoMovimientos } from "@/hooks/useMotorizadoTarifas";
import { formatCOPFull } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface MotorizadoMovementsListProps {
  motorizadoId: string;
  limit?: number;
}

interface TypeConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  ENTREGA: {
    icon: PackageCheck,
    color: "text-success",
    bg: "bg-success/10",
    label: "Entrega",
  },
  BONIFICACION: {
    icon: Gift,
    color: "text-pink-dark",
    bg: "bg-pink/10",
    label: "Bonificación",
  },
  AJUSTE: {
    icon: Award,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    label: "Ajuste admin",
  },
  RETIRO: {
    icon: ArrowUpRight,
    color: "text-foreground",
    bg: "bg-muted",
    label: "Retiro",
  },
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Hoy, ${date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === 1) return `Ayer, ${date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: diffDays > 365 ? "numeric" : undefined });
};

const MotorizadoMovementsList = ({ motorizadoId, limit = 100 }: MotorizadoMovementsListProps) => {
  const { data: movements, isLoading, error } = useMotorizadoMovimientos(motorizadoId);
  const lista = (movements ?? []).slice(0, limit);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Cargando movimientos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
        No se pudieron cargar los movimientos
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Sin movimientos aún</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tu primera entrega aparecerá aquí
        </p>
      </div>
    );
  }

  // Agrupar por día
  const grouped = lista.reduce<Record<string, typeof lista>>((acc, m) => {
    const dateKey = new Date(m.fecha_ts).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateKey, items]) => {
        const dayTotal = items.reduce(
          (sum, m) => sum + (m.direccion === "debito" ? -Number(m.monto) : Number(m.monto)),
          0,
        );
        return (
          <div key={dateKey}>
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {dateKey}
              </span>
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  dayTotal >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {dayTotal >= 0 ? "+" : ""}
                {formatCOPFull(dayTotal)}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((mov) => {
                const config = TYPE_CONFIG[mov.tipo] || {
                  icon: Receipt,
                  color: "text-foreground",
                  bg: "bg-muted",
                  label: mov.tipo,
                };
                const Icon = config.icon;
                const isCredit = mov.direccion !== "debito";
                const signed = isCredit ? Number(mov.monto) : -Number(mov.monto);

                return (
                  <div
                    key={`${mov.tipo}-${mov.ref}`}
                    className="flex items-center gap-3 py-2 px-1 hover:bg-muted/40 rounded-lg transition-colors"
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", config.bg)}>
                      <Icon className={cn("h-4 w-4", config.color)} strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground leading-tight">
                        {mov.descripcion}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {mov.municipio && <span>{mov.municipio}</span>}
                        {mov.cliente_nombre && <span> · {mov.cliente_nombre}</span>}
                        <span className="ml-1">· {formatDate(mov.fecha_ts)}</span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold tabular-nums flex-shrink-0",
                        isCredit ? "text-success" : "text-destructive",
                      )}
                    >
                      {isCredit ? "+" : ""}
                      {formatCOPFull(signed)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MotorizadoMovementsList;

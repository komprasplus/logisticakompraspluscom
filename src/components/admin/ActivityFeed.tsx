import { CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  tipo: "entrega" | "novedad" | string;
  titulo: string;
  subtitulo: string;
  monto: number;
  timestamp: string;
  pedido_id: number;
  numero_guia: string | null;
}

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

const ActivityFeed = ({ items }: ActivityFeedProps) => {
  if (items.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">Sin actividad reciente del día.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          Actividad reciente
        </h3>
        <span className="text-[10px] text-muted-foreground">Últimas {items.length} del día</span>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {items.map((it) => {
          const isEntrega = it.tipo === "entrega";
          const isNovedad = it.tipo === "novedad";
          return (
            <div
              key={`${it.tipo}-${it.pedido_id}-${it.timestamp}`}
              className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors"
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                  isEntrega && "bg-emerald-500/10 text-emerald-600",
                  isNovedad && "bg-amber-500/10 text-amber-600",
                )}
              >
                {isEntrega ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight">{it.titulo}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{it.subtitulo}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {it.monto > 0 && (
                  <p className="text-xs font-bold text-emerald-600 tabular-nums">{formatCOP(it.monto)}</p>
                )}
                <p className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(it.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;

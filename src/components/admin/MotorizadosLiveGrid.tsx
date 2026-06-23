import { useMemo } from "react";
import { Bike, Phone, Package, DollarSign, AlertTriangle, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MotorizadoLive {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  paquetes_pendientes: number;
  entregados_hoy: number;
  novedades: number;
  recaudo_pendiente: number;
  recaudo_cobrado_hoy: number;
  total_dia: number;
  pct_completado: number;
  ultima_actividad: string | null;
  status: "en_ruta" | "novedad" | "libre" | "disponible";
}

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

const STATUS_CONFIG: Record<MotorizadoLive["status"], { label: string; dot: string; chip: string }> = {
  en_ruta: { label: "En ruta", dot: "bg-blue-500", chip: "bg-blue-500/10 text-blue-700 border-blue-200" },
  novedad: { label: "Con novedad", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-700 border-amber-200" },
  libre: { label: "Listo", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  disponible: { label: "Disponible", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 border-slate-200" },
};

const timeAgo = (iso: string | null): string => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

const initials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
};

interface MotorizadosLiveGridProps {
  motorizados: MotorizadoLive[];
  onMotorizadoClick?: (m: MotorizadoLive) => void;
}

const MotorizadosLiveGrid = ({ motorizados, onMotorizadoClick }: MotorizadosLiveGridProps) => {
  const ranking = useMemo(() => {
    return [...motorizados].sort((a, b) => b.entregados_hoy - a.entregados_hoy).slice(0, 3);
  }, [motorizados]);
  const topIds = new Set(ranking.map((m) => m.user_id));

  if (motorizados.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <Bike className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">No hay motorizados activos hoy.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Cuando un motorizado tenga pedidos asignados o entregue, aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Motorizados en vivo
            <span className="text-sm font-medium text-muted-foreground">({motorizados.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">Estado actual de tu flota en operación · top performer destacado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {motorizados.map((m) => {
          const cfg = STATUS_CONFIG[m.status];
          const isTop = m.entregados_hoy > 0 && topIds.has(m.user_id);
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => onMotorizadoClick?.(m)}
              className={cn(
                "relative bg-card border rounded-2xl p-3 text-left hover:shadow-md transition-all group",
                m.status === "novedad" ? "border-amber-300" : "border-border",
              )}
            >
              {isTop && (
                <span className="absolute -top-2 right-2 inline-flex items-center gap-1 bg-gold text-gold-foreground rounded-full px-2 py-0.5 text-[9px] font-bold shadow">
                  <Trophy className="h-2.5 w-2.5" /> TOP DEL DÍA
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className="relative">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.full_name ?? ""} className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      {initials(m.full_name)}
                    </div>
                  )}
                  <span className={cn("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-card", cfg.dot)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{m.full_name ?? "Sin nombre"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", cfg.chip)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                      {cfg.label}
                    </span>
                  </div>
                  {m.phone && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" /> {m.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Progreso */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Avance del día</span>
                  <span className="font-bold text-foreground tabular-nums">{m.entregados_hoy}/{m.total_dia}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      m.pct_completado === 100 ? "bg-emerald-500"
                      : m.pct_completado >= 70 ? "bg-blue-500"
                      : m.pct_completado >= 30 ? "bg-amber-500" : "bg-slate-400",
                    )}
                    style={{ width: `${m.pct_completado}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Package className="h-2.5 w-2.5" /> Pendientes
                  </p>
                  <p className="text-base font-black text-foreground tabular-nums leading-tight">{m.paquetes_pendientes}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-2.5 w-2.5" /> COD calle
                  </p>
                  <p className="text-base font-black text-foreground tabular-nums leading-tight">
                    {m.recaudo_pendiente > 0 ? formatCOP(m.recaudo_pendiente) : "—"}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(m.ultima_actividad)}
                </span>
                {m.novedades > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> {m.novedades} novedad{m.novedades > 1 ? "es" : ""}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MotorizadosLiveGrid;

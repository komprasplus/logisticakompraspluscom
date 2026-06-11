import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Gift,
  Loader2,
  PackageCheck,
  Receipt,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCOPFull } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface Movement {
  id: string;
  tipo: string;
  monto: number;
  pedido_id: number | null;
  pedido_guia: string | null;
  concepto: string | null;
  created_at: string;
  is_virtual: boolean;
}

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
  COMISION_ENTREGA: {
    icon: PackageCheck,
    color: "text-success",
    bg: "bg-success/10",
    label: "Comisión entrega",
  },
  FONDO_GARANTIA_RETENIDO: {
    icon: Shield,
    color: "text-gold-dark",
    bg: "bg-gold/15",
    label: "Fondo retenido",
  },
  FONDO_GARANTIA_LIBERADO: {
    icon: Shield,
    color: "text-success",
    bg: "bg-success/10",
    label: "Fondo liberado",
  },
  BONIFICACION_ZONA: {
    icon: Gift,
    color: "text-pink-dark",
    bg: "bg-pink/10",
    label: "Bono zona",
  },
  BONIFICACION_NIVEL: {
    icon: Award,
    color: "text-pink-dark",
    bg: "bg-pink/10",
    label: "Bono nivel",
  },
  BONIFICACION_REFERIDO: {
    icon: Gift,
    color: "text-pink-dark",
    bg: "bg-pink/10",
    label: "Bono referido",
  },
  RETIRO_SOLICITADO: {
    icon: ArrowUpRight,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    label: "Retiro solicitado",
  },
  RETIRO_COMPLETADO: {
    icon: ArrowUpRight,
    color: "text-success",
    bg: "bg-success/10",
    label: "Retiro completado",
  },
  RETIRO_RECHAZADO: {
    icon: ArrowDownLeft,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Retiro rechazado",
  },
  AJUSTE_CREDITO: {
    icon: ArrowDownLeft,
    color: "text-success",
    bg: "bg-success/10",
    label: "Ajuste crédito",
  },
  AJUSTE_DEBITO: {
    icon: ArrowUpRight,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Ajuste débito",
  },
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Hoy, ${date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Ayer, ${date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: diffDays > 365 ? "numeric" : undefined });
};

const MotorizadoMovementsList = ({ motorizadoId, limit = 100 }: MotorizadoMovementsListProps) => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rpcFn = supabase.rpc as unknown as (
          fn: string,
          params: Record<string, unknown>,
        ) => Promise<{ data: Movement[] | null; error: { message: string } | null }>;
        const { data, error: rpcError } = await rpcFn("get_motorizado_wallet_movements", {
          p_motorizado_id: motorizadoId,
          p_limit: limit,
        });
        if (!active) return;
        if (rpcError) throw rpcError;
        setMovements((data || []) as Movement[]);
      } catch (e) {
        if (!active) return;
        console.error("Error loading movements:", e);
        setError("No se pudieron cargar los movimientos");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [motorizadoId, limit]);

  if (loading) {
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
        {error}
      </div>
    );
  }

  if (movements.length === 0) {
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
  const grouped = movements.reduce<Record<string, Movement[]>>((acc, m) => {
    const dateKey = new Date(m.created_at).toLocaleDateString("es-CO", {
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
        const dayTotal = items.reduce((sum, m) => sum + m.monto, 0);
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
                const isCredit = mov.monto >= 0;

                return (
                  <div
                    key={mov.id}
                    className="flex items-center gap-3 py-2 px-1 hover:bg-muted/40 rounded-lg transition-colors"
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        config.bg,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", config.color)} strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground leading-tight">
                        {config.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {mov.concepto || (mov.pedido_guia ? `Guía ${mov.pedido_guia}` : "")}
                        <span className="ml-1">· {formatDate(mov.created_at)}</span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold tabular-nums flex-shrink-0",
                        isCredit ? "text-success" : "text-destructive",
                      )}
                    >
                      {isCredit ? "+" : ""}
                      {formatCOPFull(mov.monto)}
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

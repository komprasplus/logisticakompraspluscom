import { ArrowUpRight, ChevronRight, Shield, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { formatCOP, formatCOPFull, getLevelByScore, getNextLevel } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface MotorizadoWalletWidgetProps {
  score: number;
  balanceDisponible: number;
  fondoGarantia: number;
  codHoyUsado: number;
  pedidosEntregadosMes?: number;
  variant?: "full" | "compact";
  onRetirar?: () => void;
  onVerDetalle?: () => void;
}

const MotorizadoWalletWidget = ({
  score,
  balanceDisponible,
  fondoGarantia,
  codHoyUsado,
  pedidosEntregadosMes = 0,
  variant = "full",
  onRetirar,
  onVerDetalle,
}: MotorizadoWalletWidgetProps) => {
  const level = getLevelByScore(score);
  const nextLevel = getNextLevel(level.level);
  const cupoRestante = Math.max(0, level.cupoCOD - codHoyUsado);
  const cupoUsadoPct = level.cupoCOD > 0 ? Math.min(100, (codHoyUsado / level.cupoCOD) * 100) : 0;

  // Progreso al siguiente nivel
  const progressToNext = nextLevel
    ? Math.min(100, ((score - level.minScore) / (nextLevel.minScore - level.minScore)) * 100)
    : 100;

  if (variant === "compact") {
    return (
      <div className="bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <WalletIcon className="h-4 w-4 opacity-70" />
            <span className="text-xs opacity-80">Balance</span>
          </div>
          {onVerDetalle && (
            <button onClick={onVerDetalle} className="text-xs opacity-70 hover:opacity-100">
              Detalle <ChevronRight className="inline h-3 w-3" />
            </button>
          )}
        </div>
        <div className="text-2xl font-bold tracking-tight">
          {formatCOPFull(balanceDisponible)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="opacity-70">
            Cupo COD hoy: <span className="font-semibold text-gold">{formatCOP(cupoRestante)}</span>
          </span>
          <span className="opacity-70">
            Fondo: {formatCOP(fondoGarantia)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Card principal: Balance */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground rounded-2xl p-5 shadow-md relative overflow-hidden">
        {/* Decoración */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
        <div className="absolute right-12 bottom-0 h-20 w-20 rounded-full bg-pink/10 blur-xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs opacity-70">Balance disponible</span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", level.copColors.bg, level.copColors.text)}>
              Nivel {level.label}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-bold tracking-tight">
            {formatCOPFull(balanceDisponible)}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={onRetirar}
              disabled={balanceDisponible <= 0}
              className="flex-1 h-11 bg-gold text-gold-foreground hover:bg-gold-dark transition-colors rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="h-4 w-4" />
              Retirar
            </button>
            <button
              onClick={onVerDetalle}
              className="flex-1 h-11 bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors rounded-lg font-medium text-sm"
            >
              Ver movimientos
            </button>
          </div>
        </div>
      </div>

      {/* Stats inferiores */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cupo COD del día */}
        <div className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <WalletIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cupo COD hoy
            </span>
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums">
            {formatCOP(cupoRestante)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            de {formatCOP(level.cupoCOD)} disponible
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                cupoUsadoPct > 90 ? "bg-destructive" : cupoUsadoPct > 70 ? "bg-warning" : "bg-success",
              )}
              style={{ width: `${cupoUsadoPct}%` }}
            />
          </div>
        </div>

        {/* Fondo de garantía */}
        <div className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="h-3.5 w-3.5 text-gold-dark" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Fondo garantía
            </span>
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums">
            {formatCOP(fondoGarantia)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {level.fondoGarantiaPct}% retenido · Recuperable a 6m
          </div>
        </div>
      </div>

      {/* Progreso al siguiente nivel */}
      {nextLevel && (
        <div className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Próximo nivel: {nextLevel.label}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {score} / {nextLevel.minScore}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-dark transition-all"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">
            Sube a <span className="font-semibold text-foreground">{nextLevel.label}</span> para
            desbloquear cupo COD de {formatCOP(nextLevel.cupoCOD)}/día
          </div>
        </div>
      )}

      {/* Stats secundarios */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Entregas del mes
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">
              {pedidosEntregadosMes}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Score acumulado
            </p>
            <p className="text-2xl font-bold text-primary mt-0.5 tabular-nums">{score}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotorizadoWalletWidget;

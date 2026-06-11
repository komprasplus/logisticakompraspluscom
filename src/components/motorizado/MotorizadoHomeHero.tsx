import { Bolt, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import {
  WeeklyEarningsDay,
  compareToYesterday,
  formatCOPFull,
  getLevelByScore,
  getNextLevel,
} from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface MotorizadoHomeHeroProps {
  score: number;
  isOnline: boolean;
  weeklyEarnings: WeeklyEarningsDay[];
}

const MotorizadoHomeHero = ({ score, isOnline, weeklyEarnings }: MotorizadoHomeHeroProps) => {
  const level = getLevelByScore(score);
  const nextLevel = getNextLevel(level.level);

  const earningsToday = weeklyEarnings[weeklyEarnings.length - 1]?.amount ?? 0;
  const comparison = compareToYesterday(weeklyEarnings);
  const maxWeekly = Math.max(...weeklyEarnings.map((d) => d.amount), 1);

  const progressToNext = nextLevel
    ? Math.min(100, ((score - level.minScore) / (nextLevel.minScore - level.minScore)) * 100)
    : 100;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground p-4 shadow-md">
      {/* Decoración de fondo */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gold/8 blur-xl" />
      <div className="absolute -bottom-8 right-12 h-24 w-24 rounded-full bg-pink/6 blur-xl" />

      <div className="relative">
        {/* Status header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Bolt className="h-3.5 w-3.5 text-gold" fill="currentColor" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              {isOnline ? "Listo para trabajar" : "Modo desconectado"}
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
              isOnline
                ? "bg-success/25 border-success/50"
                : "bg-primary-foreground/10 border-primary-foreground/20",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isOnline ? "bg-success animate-pulse" : "bg-primary-foreground/50",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-semibold",
                isOnline ? "text-success" : "text-primary-foreground/70",
              )}
            >
              {isOnline ? "En línea" : "Offline"}
            </span>
          </div>
        </div>

        {/* Ganancias hoy */}
        <div className="mb-4">
          <div className="text-[11px] opacity-60 mb-1">Ganancias hoy</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-3xl font-bold tabular-nums leading-none">
              {formatCOPFull(Math.round(earningsToday))}
            </div>
            {comparison.trend !== "same" && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-[11px] font-semibold",
                  comparison.trend === "up" ? "text-success" : "text-pink",
                )}
              >
                {comparison.trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {comparison.pct}% vs ayer
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chart semanal */}
        <div className="space-y-1.5">
          <div className="flex items-end gap-1 h-8">
            {weeklyEarnings.map((day, i) => {
              const heightPct = maxWeekly > 0 ? (day.amount / maxWeekly) * 100 : 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-all",
                    day.isToday
                      ? "bg-gold"
                      : day.amount > 0
                      ? "bg-primary-foreground/20"
                      : "bg-primary-foreground/8",
                  )}
                  style={{ height: `${Math.max(heightPct, 8)}%` }}
                  title={`${day.label}: ${formatCOPFull(Math.round(day.amount))}`}
                />
              );
            })}
          </div>
          <div className="flex gap-1 text-[9px] opacity-50">
            {weeklyEarnings.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 text-center",
                  day.isToday && "text-gold font-semibold opacity-100",
                )}
              >
                {day.label}
              </div>
            ))}
          </div>
        </div>

        {/* Nivel + progreso (footer) */}
        {nextLevel ? (
          <div className="mt-4 pt-3 border-t border-primary-foreground/15 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.15)" strokeWidth="3" fill="none" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="hsl(var(--gold))"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - progressToNext / 100)}`}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Trophy className="h-3.5 w-3.5 text-gold" />
                <span className="text-[8px] font-bold leading-none mt-0.5">{level.label}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium">
                Te faltan{" "}
                <span className="text-gold font-bold tabular-nums">
                  {nextLevel.minScore - score}
                </span>{" "}
                puntos para {nextLevel.label}
              </div>
              <div className="text-[10px] opacity-60 mt-0.5">
                Sigue entregando con calidad. Vas excelente.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-primary-foreground/15 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            <span className="text-xs">
              <span className="font-bold text-gold">Nivel Diamante</span> · Eres élite
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MotorizadoHomeHero;

import { CheckCircle2, Banknote, TrendingUp } from "lucide-react";
import { formatCOPShort } from "@/lib/payments";
import { cn } from "@/lib/utils";

interface MotorizadoDailyStatsStripProps {
  /** Entregas confirmadas hoy. */
  deliveries: number;
  /** Efectivo (COD) recaudado hoy en pesos. */
  cashCollected: number;
  /** Ganancia estimada del día en pesos. */
  earnings: number;
}

interface MiniStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "gold" | "success" | "pink";
}

const MiniStat = ({ icon: Icon, label, value, accent }: MiniStatProps) => {
  const accentClasses = {
    gold: "text-gold",
    success: "text-success",
    pink: "text-pink",
  }[accent];

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={cn(
          "h-7 w-7 rounded-md bg-primary-foreground/10 flex items-center justify-center flex-shrink-0",
          accentClasses,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60 leading-tight">
          {label}
        </p>
        <p className="text-sm font-bold tabular-nums leading-tight truncate text-primary-foreground">
          {value}
        </p>
      </div>
    </div>
  );
};

const MotorizadoDailyStatsStrip = ({
  deliveries,
  cashCollected,
  earnings,
}: MotorizadoDailyStatsStripProps) => {
  return (
    <div
      className="grid grid-cols-3 gap-2 px-3 sm:px-4 py-2 border-t border-primary-foreground/10 bg-primary/95"
      aria-label="Resumen del día"
    >
      <MiniStat
        icon={CheckCircle2}
        label="Entregas"
        value={String(deliveries)}
        accent="success"
      />
      <MiniStat
        icon={Banknote}
        label="Efectivo"
        value={formatCOPShort(cashCollected)}
        accent="gold"
      />
      <MiniStat
        icon={TrendingUp}
        label="Ganancias"
        value={formatCOPShort(earnings)}
        accent="pink"
      />
    </div>
  );
};

export default MotorizadoDailyStatsStrip;

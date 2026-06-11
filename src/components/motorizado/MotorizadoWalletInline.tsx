import { Shield, Wallet as WalletIcon } from "lucide-react";
import { formatCOP, getLevelByScore } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface MotorizadoWalletInlineProps {
  score: number;
  codHoyUsado: number;
  fondoGarantia: number;
}

const MotorizadoWalletInline = ({
  score,
  codHoyUsado,
  fondoGarantia,
}: MotorizadoWalletInlineProps) => {
  const level = getLevelByScore(score);
  const cupoRestante = Math.max(0, level.cupoCOD - codHoyUsado);
  const cupoUsadoPct = level.cupoCOD > 0 ? Math.min(100, (codHoyUsado / level.cupoCOD) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Cupo COD */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <WalletIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cupo COD
          </span>
        </div>
        <div className="text-base font-bold text-foreground tabular-nums leading-tight">
          {formatCOP(cupoRestante)}
        </div>
        <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              cupoUsadoPct > 90
                ? "bg-destructive"
                : cupoUsadoPct > 70
                ? "bg-warning"
                : "bg-success",
            )}
            style={{ width: `${cupoUsadoPct}%` }}
          />
        </div>
        <div className="text-[9px] text-muted-foreground mt-1">
          {Math.round(cupoUsadoPct)}% usado hoy
        </div>
      </div>

      {/* Fondo Garantía */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Shield className="h-3.5 w-3.5 text-gold-dark" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fondo garantía
          </span>
        </div>
        <div className="text-base font-bold text-foreground tabular-nums leading-tight">
          {formatCOP(fondoGarantia)}
        </div>
        <div className="text-[9px] text-muted-foreground mt-2.5">
          Recuperable en 6 meses
        </div>
      </div>
    </div>
  );
};

export default MotorizadoWalletInline;

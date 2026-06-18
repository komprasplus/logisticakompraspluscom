import { ArrowUpRight, Shield, Wallet as WalletIcon, Banknote } from "lucide-react";
import { formatCOP, getLevelByScore } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface MotorizadoWalletInlineProps {
  score: number;
  codHoyUsado: number;
  fondoGarantia: number;
  /** Saldo disponible para retirar (desde la RPC get_motorizado_wallet_balance). */
  balanceDisponible?: number;
  /** Handler para abrir el flujo de retiro. */
  onRetirar?: () => void;
}

const MotorizadoWalletInline = ({
  score,
  codHoyUsado,
  fondoGarantia,
  balanceDisponible,
  onRetirar,
}: MotorizadoWalletInlineProps) => {
  const level = getLevelByScore(score);
  const cupoRestante = Math.max(0, level.cupoCOD - codHoyUsado);
  const cupoUsadoPct = level.cupoCOD > 0 ? Math.min(100, (codHoyUsado / level.cupoCOD) * 100) : 0;
  const showSaldo = balanceDisponible !== undefined;

  return (
    <div className="space-y-2">
      {/* Saldo retirable (destacado, full width) */}
      {showSaldo && (
        <button
          type="button"
          onClick={onRetirar}
          disabled={!onRetirar || (balanceDisponible ?? 0) <= 0}
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors text-left",
            (balanceDisponible ?? 0) > 0
              ? "bg-gradient-to-r from-gold/15 to-gold/5 border-gold/40 hover:border-gold hover:from-gold/20"
              : "bg-card border-border opacity-80",
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-gold text-gold-foreground flex items-center justify-center flex-shrink-0">
              <Banknote className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-dark">
                Saldo retirable
              </p>
              <p className="text-base font-bold text-foreground tabular-nums truncate">
                {formatCOP(balanceDisponible ?? 0)}
              </p>
            </div>
          </div>
          {(balanceDisponible ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-gold-dark flex-shrink-0">
              Retirar
              <ArrowUpRight className="h-4 w-4" />
            </div>
          )}
        </button>
      )}

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
    </div>
  );
};

export default MotorizadoWalletInline;

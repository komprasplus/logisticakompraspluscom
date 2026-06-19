import { Flame } from "lucide-react";

interface MotorizadoStreakBadgeProps {
  deliveries: number;
}

const motivationalMessage = (n: number): string | null => {
  if (n >= 10) return "¡Imparable!";
  if (n >= 7) return "¡A todo gas!";
  if (n >= 5) return "¡Excelente ritmo!";
  if (n >= 3) return "¡Vas muy bien!";
  return null;
};

/**
 * Badge motivacional que se muestra solo cuando el motorizado lleva 3+ entregas
 * en el día. Mensaje escalonado por rango.
 */
const MotorizadoStreakBadge = ({ deliveries }: MotorizadoStreakBadgeProps) => {
  const msg = motivationalMessage(deliveries);
  if (!msg) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink/15 to-gold/10 border border-pink/30 px-3 py-1.5">
      <Flame className="h-3.5 w-3.5 text-pink" />
      <span className="text-xs font-semibold text-foreground">
        {deliveries} entregas hoy
      </span>
      <span className="text-xs text-pink font-bold">·</span>
      <span className="text-xs font-semibold text-pink">{msg}</span>
    </div>
  );
};

export default MotorizadoStreakBadge;

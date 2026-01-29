import { format, isToday, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarDays, CalendarClock } from "lucide-react";

interface DeliveryDateBadgeProps {
  fechaEntrega: string | null;
  className?: string;
}

/**
 * Displays delivery date with color coding:
 * - Today or past: strong color (primary/warning)
 * - Future: gray/muted
 */
const DeliveryDateBadge = ({ fechaEntrega, className }: DeliveryDateBadgeProps) => {
  if (!fechaEntrega) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const date = new Date(fechaEntrega + "T00:00:00");
  const today = startOfDay(new Date());
  const isPast = isBefore(date, today);
  const isTodayDelivery = isToday(date);
  const isFuture = !isPast && !isTodayDelivery;

  // Format: "29 Ene" or "Hoy"
  const displayDate = isTodayDelivery 
    ? "Hoy" 
    : format(date, "d MMM", { locale: es });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap",
        isTodayDelivery && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        isPast && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
        isFuture && "bg-muted text-muted-foreground",
        className
      )}
    >
      {isFuture ? (
        <CalendarClock className="h-3 w-3" />
      ) : (
        <CalendarDays className="h-3 w-3" />
      )}
      {displayDate}
    </span>
  );
};

export default DeliveryDateBadge;

/**
 * Helper to check if a delivery date is in the future
 */
export const isFutureDeliveryDate = (fechaEntrega: string | null): boolean => {
  if (!fechaEntrega) return false;
  const date = new Date(fechaEntrega + "T00:00:00");
  const today = startOfDay(new Date());
  return date > today;
};

/**
 * Helper to format delivery date for display
 */
export const formatDeliveryDate = (fechaEntrega: string | null): string => {
  if (!fechaEntrega) return "";
  const date = new Date(fechaEntrega + "T00:00:00");
  return format(date, "d 'de' MMMM", { locale: es });
};

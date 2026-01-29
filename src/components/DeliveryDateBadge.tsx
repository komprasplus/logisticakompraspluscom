import { cn } from "@/lib/utils";
import { CalendarDays, CalendarClock } from "lucide-react";
import {
  isFutureDeliveryDate,
  isTodayDeliveryDate,
  isPastDeliveryDate,
  formatDeliveryDateShort,
  formatDeliveryDateLong,
} from "@/lib/dateUtils";

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

  const isPast = isPastDeliveryDate(fechaEntrega);
  const isToday = isTodayDeliveryDate(fechaEntrega);
  const isFuture = isFutureDeliveryDate(fechaEntrega);

  const displayDate = formatDeliveryDateShort(fechaEntrega);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap",
        isToday && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
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

// Re-export utilities for convenience (backwards compatibility)
export { isFutureDeliveryDate } from "@/lib/dateUtils";
export const formatDeliveryDate = formatDeliveryDateLong;

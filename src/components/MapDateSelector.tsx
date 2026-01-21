import { useState } from "react";
import { format, subDays, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface MapDateSelectorProps {
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
}

const MapDateSelector = ({ selectedDate, onDateChange }: MapDateSelectorProps) => {
  const [open, setOpen] = useState(false);

  const quickDates = [
    { label: "Hoy", date: new Date(), isToday: true },
    { label: "Ayer", date: subDays(new Date(), 1), isToday: false },
    { label: "Hace 2 días", date: subDays(new Date(), 2), isToday: false },
    { label: "Hace 3 días", date: subDays(new Date(), 3), isToday: false },
  ];

  const handleQuickSelect = (date: Date, isToday: boolean) => {
    if (isToday) {
      onDateChange(null); // null means "today/live"
    } else {
      onDateChange(date);
    }
    setOpen(false);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && isToday(date)) {
      onDateChange(null);
    } else {
      onDateChange(date || null);
    }
    setOpen(false);
  };

  const isLiveView = selectedDate === null;

  return (
    <div className="flex items-center gap-2">
      {/* Quick navigation */}
      <div className="hidden sm:flex items-center gap-1 bg-card rounded-lg border border-border p-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => {
            const newDate = selectedDate 
              ? subDays(selectedDate, 1)
              : subDays(new Date(), 1);
            onDateChange(newDate);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 gap-1.5 text-xs font-medium",
                !isLiveView && "bg-primary/10 text-primary"
              )}
            >
              {isLiveView ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  En Vivo
                </>
              ) : (
                <>
                  <History className="h-3.5 w-3.5" />
                  {format(selectedDate, "dd MMM", { locale: es })}
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <div className="p-2 border-b border-border">
              <div className="grid grid-cols-2 gap-1">
                {quickDates.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickSelect(item.date, item.isToday)}
                    className={cn(
                      "h-8 text-xs justify-start",
                      item.isToday && isLiveView && "bg-green-100 text-green-700",
                      !item.isToday && selectedDate && 
                        format(selectedDate, "yyyy-MM-dd") === format(item.date, "yyyy-MM-dd") &&
                        "bg-primary/10 text-primary"
                    )}
                  >
                    {item.isToday && (
                      <span className="relative flex h-2 w-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    )}
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <CalendarComponent
              mode="single"
              selected={selectedDate || undefined}
              onSelect={handleCalendarSelect}
              disabled={(date) => date > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isLiveView}
          onClick={() => {
            if (selectedDate) {
              const nextDate = new Date(selectedDate);
              nextDate.setDate(nextDate.getDate() + 1);
              if (isToday(nextDate)) {
                onDateChange(null);
              } else if (nextDate <= new Date()) {
                onDateChange(nextDate);
              }
            }
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile: Simple date picker */}
      <div className="sm:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2",
                !isLiveView && "bg-primary/10 border-primary/30"
              )}
            >
              {isLiveView ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  En Vivo
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, "dd/MM", { locale: es })}
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-2 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDateChange(null);
                  setOpen(false);
                }}
                className={cn(
                  "w-full h-8 text-xs justify-start gap-2",
                  isLiveView && "bg-green-100 text-green-700"
                )}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Ver en Vivo (Hoy)
              </Button>
            </div>
            <CalendarComponent
              mode="single"
              selected={selectedDate || undefined}
              onSelect={handleCalendarSelect}
              disabled={(date) => date > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear button */}
      {!isLiveView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(null)}
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Volver a en vivo</span>
        </Button>
      )}
    </div>
  );
};

export default MapDateSelector;

import { useState } from "react";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Map3DCalendarButtonProps {
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
}

const Map3DCalendarButton = ({ selectedDate, onDateChange }: Map3DCalendarButtonProps) => {
  const [open, setOpen] = useState(false);
  
  const isLiveView = selectedDate === null;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && isToday(date)) {
      onDateChange(null);
    } else {
      onDateChange(date || null);
    }
    setOpen(false);
  };

  const handleLiveClick = () => {
    onDateChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative",
            "w-14 h-14 rounded-xl",
            "shadow-lg hover:shadow-xl transition-all duration-300",
            "transform hover:scale-105 active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
          style={{
            background: isLiveView
              ? "linear-gradient(145deg, #22c55e, #16a34a)"
              : "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary)/0.8))",
            boxShadow: isLiveView
              ? "0 8px 32px rgba(34, 197, 94, 0.4), inset 0 2px 4px rgba(255,255,255,0.2)"
              : "0 8px 32px hsl(var(--primary)/0.4), inset 0 2px 4px rgba(255,255,255,0.2)",
          }}
        >
          {/* 3D effect layers */}
          <div
            className="absolute inset-0 rounded-xl opacity-50"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
            }}
          />
          
          {/* Calendar icon with date */}
          <div className="relative flex flex-col items-center justify-center h-full text-white">
            {isLiveView ? (
              <>
                {/* Live indicator */}
                <div className="absolute -top-1 -right-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                </div>
                <span className="text-xl">📡</span>
                <span className="text-[10px] font-bold tracking-wide mt-0.5">VIVO</span>
              </>
            ) : (
              <>
                {/* Calendar with selected date */}
                <div className="flex flex-col items-center">
                  <span className="text-lg leading-none">📅</span>
                  <span className="text-xs font-bold mt-0.5">
                    {format(selectedDate, "dd", { locale: es })}
                  </span>
                  <span className="text-[9px] font-medium opacity-90 uppercase">
                    {format(selectedDate, "MMM", { locale: es })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Bottom shadow for 3D effect */}
          <div
            className="absolute -bottom-1 left-1 right-1 h-3 rounded-b-xl opacity-30"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.5))",
              filter: "blur(4px)",
            }}
          />
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-auto p-0 rounded-xl shadow-2xl border-0 overflow-hidden" 
        align="end"
        sideOffset={8}
      >
        {/* Header with live button */}
        <div className="p-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Seleccionar Fecha</h3>
              <p className="text-xs opacity-80">Filtrar pedidos por día</p>
            </div>
            <Button
              size="sm"
              variant={isLiveView ? "secondary" : "ghost"}
              onClick={handleLiveClick}
              className={cn(
                "gap-1.5 text-xs h-8",
                isLiveView 
                  ? "bg-white text-primary hover:bg-white/90" 
                  : "text-primary-foreground hover:bg-white/20"
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  isLiveView && "animate-ping bg-green-500"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isLiveView ? "bg-green-500" : "bg-white/50"
                )}></span>
              </span>
              En Vivo
            </Button>
          </div>
        </div>
        
        {/* Calendar */}
        <CalendarComponent
          mode="single"
          selected={selectedDate || undefined}
          onSelect={handleCalendarSelect}
          disabled={(date) => date > new Date()}
          initialFocus
          className="p-3 pointer-events-auto bg-popover"
        />
        
        {/* Footer with current selection */}
        {selectedDate && (
          <div className="px-3 py-2 bg-muted/50 border-t border-border text-xs text-muted-foreground text-center">
            📅 {format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </div>
        )}
        
        {/* Live footer when in live mode */}
        {!selectedDate && (
          <div className="px-3 py-2 bg-accent/50 border-t border-border text-xs text-accent-foreground text-center flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground/50 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-foreground"></span>
            </span>
            Mostrando datos en tiempo real
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default Map3DCalendarButton;

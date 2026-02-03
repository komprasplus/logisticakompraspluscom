import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: boolean;
}

// Preset ranges for quick selection
const PRESETS = [
  { label: "Hoy", getDates: () => {
    const today = new Date().toISOString().split("T")[0];
    return { from: today, to: today };
  }},
  { label: "Última semana", getDates: () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return { 
      from: weekAgo.toISOString().split("T")[0], 
      to: today.toISOString().split("T")[0] 
    };
  }},
  { label: "Último mes", getDates: () => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    return { 
      from: monthAgo.toISOString().split("T")[0], 
      to: today.toISOString().split("T")[0] 
    };
  }},
  { label: "Todo 2025-2026", getDates: () => ({ from: "2025-01-01", to: "2026-12-31" })},
];

export default function DateRangeFilter({ value, onChange, disabled }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(value.from);
  const [tempTo, setTempTo] = useState(value.to);

  const handleApply = () => {
    onChange({ from: tempFrom, to: tempTo });
    setOpen(false);
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const dates = preset.getDates();
    setTempFrom(dates.from);
    setTempTo(dates.to);
    onChange(dates);
    setOpen(false);
  };

  // Format display label
  const getDisplayLabel = () => {
    if (value.from === "2025-01-01" && value.to === "2026-12-31") {
      return "Todo 2025-2026";
    }
    const formatDate = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y.slice(2)}`;
    };
    if (value.from === value.to) {
      return formatDate(value.from);
    }
    return `${formatDate(value.from)} - ${formatDate(value.to)}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 min-w-[180px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{getDisplayLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">Rango de Fechas</div>
          
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="secondary"
                size="sm"
                onClick={() => handlePreset(preset)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom date inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Desde</label>
              <input
                type="date"
                value={tempFrom}
                onChange={(e) => setTempFrom(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <input
                type="date"
                value={tempTo}
                onChange={(e) => setTempTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <Button onClick={handleApply} className="w-full">
            Aplicar Rango
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

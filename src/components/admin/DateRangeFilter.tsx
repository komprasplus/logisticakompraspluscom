import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * FIX: fecha de inicio de datos hardcodeada como constante en un solo lugar.
 * Antes aparecía como el string "2025-01-01" duplicado en PRESETS y en
 * getDisplayLabel — un cambio futuro requería editar dos sitios.
 */
const DATA_START_DATE = "2025-01-01";

// ─── Helpers (fuera del componente — funciones puras, no se recrean) ─────────

/**
 * FIX: timezone Colombia en todos los cálculos de fecha.
 * Antes `new Date().toISOString().split("T")[0]` usaba UTC,
 * lo que a las 7pm en Bogotá ya devolvía el día siguiente.
 */
const getTodayColombia = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const getDateDaysAgo = (days: number): string => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
};

const getDateMonthsAgo = (months: number): string => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  d.setMonth(d.getMonth() - months);
  return d.toLocaleDateString("en-CA");
};

/** Formatea "2024-12-31" → "31/12/24" */
const formatShortDate = (iso: string): string => {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

// ─── Presets ──────────────────────────────────────────────────────────────────

/**
 * FIX: PRESETS definido a nivel de módulo para no recrearse en cada render.
 * Las funciones `getDates` se evalúan en el momento del click (no al definir),
 * por lo que siempre devuelven la fecha actual correcta.
 */
const PRESETS = [
  {
    label: "Hoy",
    getDates: (): DateRange => {
      const today = getTodayColombia();
      return { from: today, to: today };
    },
  },
  {
    label: "Última semana",
    getDates: (): DateRange => ({
      from: getDateDaysAgo(7),
      to: getTodayColombia(),
    }),
  },
  {
    label: "Último mes",
    getDates: (): DateRange => ({
      from: getDateMonthsAgo(1),
      to: getTodayColombia(),
    }),
  },
  {
    label: "Últimos 3 meses",
    getDates: (): DateRange => ({
      from: getDateMonthsAgo(3),
      to: getTodayColombia(),
    }),
  },
  {
    label: "Desde siempre",
    getDates: (): DateRange => ({
      from: DATA_START_DATE,
      to: getTodayColombia(),
    }),
  },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DateRangeFilter({ value, onChange, disabled }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(value.from);
  const [tempTo, setTempTo] = useState(value.to);
  const [rangeError, setRangeError] = useState<string | null>(null);

  /**
   * FIX: sincronizar el estado temporal cuando el padre cambia `value`
   * externamente (ej. botón "Limpiar filtros" en el padre).
   * Antes el popover mostraba los valores viejos si el padre reseteaba.
   */
  useEffect(() => {
    setTempFrom(value.from);
    setTempTo(value.to);
  }, [value.from, value.to]);

  /**
   * FIX: resetear los valores temporales al ABRIR el popover.
   * Antes, si el usuario abría, cambiaba algo, cerraba sin aplicar,
   * y volvía a abrir — veía sus cambios sin confirmar en lugar del
   * rango activo real.
   */
  useEffect(() => {
    if (open) {
      setTempFrom(value.from);
      setTempTo(value.to);
      setRangeError(null);
    }
  }, [open, value.from, value.to]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    // FIX: validación de rango — evita que "desde" sea posterior a "hasta"
    if (tempFrom > tempTo) {
      setRangeError("La fecha inicial no puede ser posterior a la final");
      return;
    }
    setRangeError(null);
    onChange({ from: tempFrom, to: tempTo });
    setOpen(false);
  }, [tempFrom, tempTo, onChange]);

  const handlePreset = useCallback(
    (preset: (typeof PRESETS)[number]) => {
      const dates = preset.getDates();
      setTempFrom(dates.from);
      setTempTo(dates.to);
      setRangeError(null);
      onChange(dates);
      setOpen(false);
    },
    [onChange],
  );

  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTempFrom(e.target.value);
    setRangeError(null); // Limpiar error al editar
  }, []);

  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTo(e.target.value);
    setRangeError(null);
  }, []);

  // ── Label del botón ────────────────────────────────────────────────────────

  /**
   * FIX: memoizado para no recalcular en cada render.
   * FIX: detecta TODOS los presets, no solo "Desde siempre".
   * Antes mostraba "01/01/25 - 11/02/26" en vez de "Última semana".
   */
  const displayLabel = useMemo((): string => {
    const today = getTodayColombia();

    if (value.from === today && value.to === today) return "Hoy";
    if (value.from === getDateDaysAgo(7) && value.to === today) return "Última semana";
    if (value.from === getDateMonthsAgo(1) && value.to === today) return "Último mes";
    if (value.from === getDateMonthsAgo(3) && value.to === today) return "Últimos 3 meses";
    if (value.from === DATA_START_DATE && value.to === today) return "Desde siempre";
    if (value.from === value.to) return formatShortDate(value.from);

    return `${formatShortDate(value.from)} – ${formatShortDate(value.to)}`;
  }, [value.from, value.to]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 min-w-[180px] justify-between"
          aria-label={`Filtro de fechas: ${displayLabel}`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{displayLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Rango de Fechas</p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              // Resaltar el preset activo
              const presetDates = preset.getDates();
              const isActive = value.from === presetDates.from && value.to === presetDates.to;
              return (
                <Button
                  key={preset.label}
                  variant={isActive ? "default" : "secondary"}
                  size="sm"
                  onClick={() => handlePreset(preset)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>

          {/* Inputs de fecha personalizados */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="date-from" className="text-xs text-muted-foreground">
                Desde
              </label>
              <input
                id="date-from"
                type="date"
                value={tempFrom}
                max={tempTo || undefined} // FIX: no permite seleccionar "desde" posterior a "hasta"
                onChange={handleFromChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="date-to" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <input
                id="date-to"
                type="date"
                value={tempTo}
                min={tempFrom || undefined} // FIX: no permite seleccionar "hasta" anterior a "desde"
                onChange={handleToChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* FIX: mensaje de error visible si el rango es inválido */}
          {rangeError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{rangeError}</span>
            </div>
          )}

          <Button onClick={handleApply} className="w-full">
            Aplicar Rango
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Días no laborales (festivos) Colombia.
 * Las fechas se almacenan en formato YYYY-MM-DD para comparación segura por timezone local.
 */
export const COLOMBIA_HOLIDAYS: Set<string> = new Set([
  // 2026
  "2026-01-01",
  "2026-01-12",
  "2026-03-23",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-18",
  "2026-06-08",
  "2026-06-15",
  "2026-06-29",
  "2026-07-20",
  "2026-08-07",
  "2026-08-17",
  "2026-10-12",
  "2026-11-02",
  "2026-11-16",
  "2026-12-08",
  "2026-12-25",
]);

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Verifica si una fecha es día no laboral (domingo o festivo CO).
 */
export function isNonWorkingDay(date: Date): boolean {
  if (date.getDay() === 0) return true; // Domingo
  return COLOMBIA_HOLIDAYS.has(toLocalISO(date));
}

/**
 * Calcula la primera fecha hábil de entrega según la regla de negocio:
 * - Antes de las 14:00: empieza desde HOY.
 * - 14:00 o después: empieza desde MAÑANA.
 * - Salta domingos y festivos hasta encontrar el siguiente día hábil.
 */
export function getMinDeliveryDate(now: Date = new Date()): Date {
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() >= 14) {
    candidate.setDate(candidate.getDate() + 1);
  }
  while (isNonWorkingDay(candidate)) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

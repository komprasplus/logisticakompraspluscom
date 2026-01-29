import { startOfDay, isToday, isBefore, format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Centralized date utilities for consistent date handling across the application.
 * All functions use local timezone to avoid UTC conversion issues.
 */

/**
 * Parse a YYYY-MM-DD date string into a Date object in local timezone.
 * This prevents timezone shifts that occur with toISOString() or new Date(string).
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Parse a date string from the database (YYYY-MM-DD) safely.
 * If the string is null/undefined, returns null.
 */
export function parseFechaEntrega(fechaEntrega: string | null | undefined): Date | null {
  if (!fechaEntrega) return null;
  // Handle both "YYYY-MM-DD" and potential "YYYY-MM-DDTHH:mm:ss" formats
  const dateOnly = fechaEntrega.split("T")[0];
  return parseDateString(dateOnly);
}

/**
 * Format a Date object to YYYY-MM-DD string in local timezone.
 * Use this for database storage and comparisons.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 */
export function getTodayString(): string {
  return formatDateString(new Date());
}

/**
 * Check if a fecha_entrega is in the future (after today).
 */
export function isFutureDeliveryDate(fechaEntrega: string | null | undefined): boolean {
  if (!fechaEntrega) return false;
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return false;
  const today = startOfDay(new Date());
  return date > today;
}

/**
 * Check if a fecha_entrega is today or in the past.
 */
export function isTodayOrPastDeliveryDate(fechaEntrega: string | null | undefined): boolean {
  if (!fechaEntrega) return true; // No date = treat as urgent (today)
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return true;
  const today = startOfDay(new Date());
  return date <= today;
}

/**
 * Check if a fecha_entrega is exactly today.
 */
export function isTodayDeliveryDate(fechaEntrega: string | null | undefined): boolean {
  if (!fechaEntrega) return false;
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return false;
  return isToday(date);
}

/**
 * Check if a fecha_entrega is in the past (before today).
 */
export function isPastDeliveryDate(fechaEntrega: string | null | undefined): boolean {
  if (!fechaEntrega) return false;
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return false;
  const today = startOfDay(new Date());
  return isBefore(date, today);
}

/**
 * Format a delivery date for display (e.g., "29 de Enero").
 */
export function formatDeliveryDateLong(fechaEntrega: string | null | undefined): string {
  if (!fechaEntrega) return "";
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return "";
  return format(date, "d 'de' MMMM", { locale: es });
}

/**
 * Format a delivery date for compact display (e.g., "29 Ene" or "Hoy").
 */
export function formatDeliveryDateShort(fechaEntrega: string | null | undefined): string {
  if (!fechaEntrega) return "";
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return "";
  if (isToday(date)) return "Hoy";
  return format(date, "d MMM", { locale: es });
}

/**
 * Get the timestamp for sorting purposes (numeric).
 * Returns 0 for null dates (treated as most urgent).
 */
export function getDeliveryDateTimestamp(fechaEntrega: string | null | undefined): number {
  if (!fechaEntrega) return 0;
  const date = parseFechaEntrega(fechaEntrega);
  if (!date) return 0;
  return date.getTime();
}

/**
 * Compare two fecha_entrega values for sorting (ascending - nearest first).
 * Null dates are treated as most urgent (come first).
 */
export function compareDeliveryDates(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const dateA = getDeliveryDateTimestamp(a);
  const dateB = getDeliveryDateTimestamp(b);
  
  // Null dates come first (most urgent)
  if (!a && b) return -1;
  if (a && !b) return 1;
  
  return dateA - dateB;
}

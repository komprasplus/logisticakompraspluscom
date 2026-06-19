/**
 * Helpers para tema (light/dark) con detección automática según hora Bogotá.
 *
 * Lógica:
 * - Si el usuario nunca cambió manualmente → modo automático según hora local.
 *   Dark de 18:00 a 06:00 hora Bogotá (UTC-5, sin DST). Light de 06:00 a 18:00.
 * - Si el usuario hizo toggle alguna vez → respetamos su preferencia (dark/light).
 *
 * Persistencia en localStorage bajo "motorizado:theme".
 */

const THEME_KEY = "motorizado:theme";
const BOGOTA_OFFSET_HOURS = 5; // UTC-5 sin DST

export type Theme = "light" | "dark";

const safeLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getStoredTheme = (): Theme | null => {
  const ls = safeLocalStorage();
  if (!ls) return null;
  const v = ls.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : null;
};

export const setStoredTheme = (theme: Theme): void => {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(THEME_KEY, theme);
  } catch {
    // localStorage lleno o privado — ignorar
  }
};

export const clearStoredTheme = (): void => {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(THEME_KEY);
  } catch {
    // ignorar
  }
};

/**
 * Tema automático según la hora local en Bogotá:
 * 18:00–05:59 → dark, 06:00–17:59 → light.
 */
export const getAutoTheme = (now: Date = new Date()): Theme => {
  const utcHour = now.getUTCHours();
  const bogotaHour = (utcHour - BOGOTA_OFFSET_HOURS + 24) % 24;
  return bogotaHour >= 18 || bogotaHour < 6 ? "dark" : "light";
};

/**
 * Tema inicial: respeta preferencia guardada o cae en automático según la hora.
 */
export const resolveInitialTheme = (): Theme => {
  return getStoredTheme() ?? getAutoTheme();
};

export const isUsingAutoTheme = (): boolean => getStoredTheme() === null;

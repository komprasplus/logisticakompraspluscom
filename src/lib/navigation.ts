/**
 * Helpers de navegación para abrir Google Maps o Waze con preferencia recordada
 * del motorizado (persistida en localStorage).
 */

export type NavApp = "google_maps" | "waze";

const NAV_PREF_KEY = "motorizado:nav-app";

export interface NavDestination {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

export interface NavOrigin {
  lat: number;
  lng: number;
}

const safeLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getNavPreference = (): NavApp | null => {
  const ls = safeLocalStorage();
  if (!ls) return null;
  const value = ls.getItem(NAV_PREF_KEY);
  if (value === "google_maps" || value === "waze") return value;
  return null;
};

export const setNavPreference = (app: NavApp): void => {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(NAV_PREF_KEY, app);
  } catch {
    // ignorar — localStorage lleno o privado
  }
};

export const clearNavPreference = (): void => {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(NAV_PREF_KEY);
  } catch {
    // ignorar
  }
};

export const buildGoogleMapsUrl = (
  dest: NavDestination,
  origin?: NavOrigin | null,
): string => {
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  if (dest.lat != null && dest.lng != null) {
    params.set("destination", `${dest.lat},${dest.lng}`);
  } else if (dest.address) {
    params.set("destination", `${dest.address}, Bogotá, Colombia`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const buildWazeUrl = (dest: NavDestination): string => {
  if (dest.lat != null && dest.lng != null) {
    return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
  }
  const q = encodeURIComponent(`${dest.address ?? ""}, Bogotá, Colombia`);
  return `https://waze.com/ul?q=${q}&navigate=yes`;
};

export const openNavigation = (
  app: NavApp,
  dest: NavDestination,
  origin?: NavOrigin | null,
): void => {
  const url =
    app === "waze" ? buildWazeUrl(dest) : buildGoogleMapsUrl(dest, origin);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

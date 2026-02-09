/**
 * Nearest-Neighbor TSP Route Optimizer
 * Reorders delivery points starting from current location,
 * always picking the closest unvisited point next.
 */

interface GeoPoint {
  id: number;
  latitud: number | null;
  longitud: number | null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Optimizes route using Nearest Neighbor heuristic.
 * Returns ordered array of item IDs.
 */
export function optimizeRouteNearestNeighbor<T extends GeoPoint>(
  items: T[],
  startLat: number,
  startLng: number,
): T[] {
  // Separate items with and without coordinates
  const withCoords = items.filter((p) => p.latitud != null && p.longitud != null);
  const withoutCoords = items.filter((p) => p.latitud == null || p.longitud == null);

  if (withCoords.length === 0) return items;

  const visited = new Set<number>();
  const route: T[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (visited.size < withCoords.length) {
    let nearest: T | null = null;
    let nearestDist = Infinity;

    for (const item of withCoords) {
      if (visited.has(item.id)) continue;
      const dist = haversineDistance(currentLat, currentLng, item.latitud!, item.longitud!);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = item;
      }
    }

    if (!nearest) break;

    visited.add(nearest.id);
    route.push(nearest);
    currentLat = nearest.latitud!;
    currentLng = nearest.longitud!;
  }

  // Append items without coordinates at the end
  return [...route, ...withoutCoords];
}

/**
 * Calculates total route distance in meters.
 */
export function calculateTotalRouteDistance<T extends GeoPoint>(
  items: T[],
  startLat: number,
  startLng: number,
): number {
  let total = 0;
  let prevLat = startLat;
  let prevLng = startLng;

  for (const item of items) {
    if (item.latitud != null && item.longitud != null) {
      total += haversineDistance(prevLat, prevLng, item.latitud, item.longitud);
      prevLat = item.latitud;
      prevLng = item.longitud;
    }
  }
  return total;
}

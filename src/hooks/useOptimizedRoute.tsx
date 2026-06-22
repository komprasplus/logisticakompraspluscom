import { useCallback, useState } from "react";

interface RoutePedido {
  id: number;
  latitud: number | null;
  longitud: number | null;
}

export interface OptimizedRouteLeg {
  pedidoId: number;
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
}

export interface OptimizedRoute {
  /** IDs en el orden óptimo de visita */
  orderedIds: number[];
  /** Encoded polyline para renderizar con google.maps.geometry.encoding.decodePath */
  polyline: string;
  /** Distancia total en kilómetros */
  distanceKm: number;
  /** Duración total en minutos */
  durationMin: number;
  /** Detalle leg por leg (bodega→p1, p1→p2, ...) */
  legs: OptimizedRouteLeg[];
}

interface UseOptimizedRouteResult {
  optimize: (
    origin: { lat: number; lng: number },
    pedidos: RoutePedido[],
  ) => Promise<OptimizedRoute | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Calcula la ruta óptima de visita usando Google Directions API.
 *
 * - Origen: típicamente la bodega (Calle 14 #19-64 Bogotá).
 * - Destino: el último pedido optimizado (NO regresa al origen).
 * - Waypoints: el resto de pedidos, con optimizeWaypoints=true para que
 *   Google los reordene a la ruta más corta.
 *
 * Limitaciones de Google Directions:
 * - Hasta 25 waypoints por request en plan Standard.
 * - Si hay más, se reportan los primeros 24 + último como destino (24+1).
 */
export const useOptimizedRoute = (): UseOptimizedRouteResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(
    async (
      origin: { lat: number; lng: number },
      pedidos: RoutePedido[],
    ): Promise<OptimizedRoute | null> => {
      setError(null);

      const valid = pedidos.filter((p) => p.latitud != null && p.longitud != null);
      if (valid.length === 0) {
        setError("No hay pedidos con coordenadas válidas");
        return null;
      }
      if (valid.length === 1) {
        // Caso trivial: un solo punto, no se llama a Directions
        return {
          orderedIds: [valid[0].id],
          polyline: "",
          distanceKm: 0,
          durationMin: 0,
          legs: [],
        };
      }

      if (typeof window === "undefined" || !(window as any).google?.maps?.DirectionsService) {
        setError("Google Maps no está cargado todavía");
        return null;
      }

      setLoading(true);
      try {
        const google = (window as any).google;

        // Limitar a 25 paradas (Google limit). Si hay más, recortamos por
        // proximidad simple manteniendo las primeras 24.
        const truncated = valid.slice(0, 25);

        // Último elemento será el destination; los demás van como waypoints
        const destination = truncated[truncated.length - 1];
        const waypoints = truncated.slice(0, -1).map((p) => ({
          location: { lat: Number(p.latitud), lng: Number(p.longitud) },
          stopover: true,
        }));

        const service = new google.maps.DirectionsService();
        const response: any = await service.route({
          origin,
          destination: { lat: Number(destination.latitud), lng: Number(destination.longitud) },
          waypoints,
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
          region: "co",
          unitSystem: google.maps.UnitSystem.METRIC,
        });

        const route = response?.routes?.[0];
        if (!route) {
          setError("No se obtuvo respuesta de Google Directions");
          return null;
        }

        // waypoint_order es el orden óptimo en que Google reordena los waypoints
        const waypointOrder: number[] = route.waypoint_order ?? [];
        const waypointPedidos = truncated.slice(0, -1);
        const orderedIds: number[] = [
          ...waypointOrder.map((idx) => waypointPedidos[idx].id),
          destination.id,
        ];

        // Sumar distancia y duración de todos los legs
        const legs: OptimizedRouteLeg[] = (route.legs ?? []).map((leg: any, i: number) => ({
          pedidoId: orderedIds[i],
          distanceText: leg.distance?.text ?? "",
          distanceMeters: leg.distance?.value ?? 0,
          durationText: leg.duration?.text ?? "",
          durationSeconds: leg.duration?.value ?? 0,
        }));

        const totalMeters = legs.reduce((s, l) => s + l.distanceMeters, 0);
        const totalSeconds = legs.reduce((s, l) => s + l.durationSeconds, 0);

        return {
          orderedIds,
          polyline: route.overview_polyline ?? "",
          distanceKm: totalMeters / 1000,
          durationMin: totalSeconds / 60,
          legs,
        };
      } catch (e: any) {
        console.error("Directions API error:", e);
        setError(e?.message || "Error consultando Google Directions");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { optimize, loading, error };
};

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PedidoGeocodable {
  id: number;
  latitud: number | null;
  longitud: number | null;
  direccion_entrega: string | null;
  municipio?: string | null;
  barrio?: string | null;
}

/**
 * Geocodifica pedidos que tengan direccion_entrega pero no lat/lng,
 * usando el Google Geocoder ya cargado por @react-google-maps/api.
 * Actualiza la BD via UPDATE directo (RLS permite UPDATE de pedidos
 * asignados al motorizado autenticado).
 *
 * - Espera a que window.google.maps esté disponible.
 * - Throttle a 1 request cada 200ms para no exceder la quota.
 * - No reintenta los pedidos que fallaron (los marca en memoria).
 * - Idempotente: solo geocodifica si lat/lng son null.
 *
 * Devuelve nada — el hook UPDATE escribe en BD y el react-query refresca
 * naturalmente en el próximo refetch del listado.
 */
export const useGeocodePedidos = (
  pedidos: PedidoGeocodable[] | undefined,
  enabled: boolean = true,
  onGeocoded?: (id: number, lat: number, lng: number) => void,
) => {
  const attemptedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || !pedidos || pedidos.length === 0) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const run = async () => {
      // Esperar a que google.maps esté disponible (lo carga MotorizadoMapGoogle)
      const waitForGoogle = async (): Promise<boolean> => {
        const start = Date.now();
        while (!(window as any).google?.maps?.Geocoder) {
          if (Date.now() - start > 15000) return false;
          await new Promise((r) => setTimeout(r, 300));
        }
        return true;
      };

      const ready = await waitForGoogle();
      if (!ready || cancelled) return;

      const geocoder = new (window as any).google.maps.Geocoder();

      const candidates = pedidos.filter(
        (p) =>
          (p.latitud == null || p.longitud == null) &&
          !!p.direccion_entrega?.trim() &&
          !attemptedRef.current.has(p.id),
      );

      for (const p of candidates) {
        if (cancelled) break;
        attemptedRef.current.add(p.id);

        const addrParts = [
          p.direccion_entrega,
          p.barrio,
          p.municipio,
          "Bogotá",
          "Colombia",
        ].filter(Boolean);
        const fullAddress = addrParts.join(", ");

        try {
          const result = await new Promise<{ lat: number; lng: number } | null>(
            (resolve) => {
              geocoder.geocode(
                {
                  address: fullAddress,
                  region: "co",
                  componentRestrictions: { country: "CO" },
                },
                (results: any, status: string) => {
                  if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    resolve({ lat: loc.lat(), lng: loc.lng() });
                  } else {
                    resolve(null);
                  }
                },
              );
            },
          );

          if (result) {
            const { error } = await (supabase as any)
              .from("pedidos")
              .update({ latitud: result.lat, longitud: result.lng })
              .eq("id", p.id);

            if (!error) {
              onGeocoded?.(p.id, result.lat, result.lng);
            } else {
              console.warn(`Geocode UPDATE falló para pedido ${p.id}:`, error);
            }
          } else {
            console.warn(`Geocode no encontró resultado para pedido ${p.id}: ${fullAddress}`);
          }
        } catch (e) {
          console.warn(`Geocode error pedido ${p.id}:`, e);
        }

        // Throttle 200ms
        await new Promise((r) => setTimeout(r, 200));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pedidos, enabled, onGeocoded]);
};

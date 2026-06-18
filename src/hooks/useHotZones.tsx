import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HotZone {
  zona: string;
  pedidos_disponibles: number;
  valor_total: number;
  bono_estimado: number;
}

/**
 * Llama a la RPC public.motorizado_hot_zones(p_limit) y devuelve las zonas
 * con pedidos disponibles (sin motorizado asignado, en estados
 * 'pendiente' o 'recibido en bodega'). Ordenado por cantidad de pedidos desc.
 *
 * El motorizado puede ver bono estimado escalonado por densidad de pedidos
 * en la zona: ≥8 = $5.000, ≥5 = $3.000, ≥3 = $1.500, sino $0.
 */
export const useHotZones = (limit = 5) => {
  const query = useQuery({
    queryKey: ["hot-zones", limit],
    queryFn: async (): Promise<HotZone[]> => {
      const { data, error } = await (supabase.rpc as any)(
        "motorizado_hot_zones",
        { p_limit: limit },
      );
      if (error) throw error;
      return (data ?? []) as HotZone[];
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });

  return {
    zones: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  municipio?: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  valor_producto?: number | null;
  valor_flete?: number | null;
  utilidad?: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

/**
 * Optimized fetcher with composite index (client_user_id, fecha_creacion DESC).
 * Returns at most 200 rows for fast response times.
 */
const fetchPedidosForClient = async (userId: string): Promise<Pedido[]> => {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("client_user_id", userId)
    .order("fecha_creacion", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
};

/**
 * SWR-style hook for client orders. Features:
 * - Instant display of cached data while background refresh occurs
 * - structuralSharing ensures React avoids unnecessary re-renders if data is identical
 * - staleTime prevents refetches within 30s window
 * - gcTime keeps data available for 5 minutes after unmount
 */
export const usePedidosQuery = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pedidos", "cliente", userId],
    queryFn: () => fetchPedidosForClient(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - data considered fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - cache retained after unmount
    refetchOnWindowFocus: true, // Sync when tab regains focus
    refetchOnMount: "always", // Refetch on mount but show stale data first
    placeholderData: (previousData) => previousData, // Instant UI transition
    structuralSharing: true, // Prevent re-renders if response is identical
  });

  // Memoized refetch to avoid unnecessary closures
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pedidos", "cliente", userId] });
  }, [queryClient, userId]);

  return {
    pedidos: query.data ?? [],
    isLoading: query.isLoading, // True only on first load with no cache
    isFetching: query.isFetching, // True during any fetch (including background)
    isStale: query.isStale,
    error: query.error,
    refetch,
  };
};
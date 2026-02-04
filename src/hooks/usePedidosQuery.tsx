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
  fulfillment_cost?: number | null;
  utilidad?: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

// Columns required for client dashboard - minimal for fast response
const CLIENT_PEDIDO_COLUMNS = `
  id,
  numero_guia,
  cliente_nombre,
  client_phone,
  direccion_entrega,
  barrio,
  zona,
  municipio,
  producto_nombre,
  valor_recaudar,
  valor_producto,
  valor_flete,
  fulfillment_cost,
  utilidad,
  metodo_pago,
  fecha_entrega,
  estado,
  corte_horario,
  fecha_creacion,
  foto_evidencia,
  tipo_novedad
`;

/**
 * Fetches ALL orders from 2025-01-01 onwards for full visibility.
 * No arbitrary limits - clients see all their orders.
 * Includes date filter to prevent loading ancient data.
 */
const fetchPedidosForClient = async (userId: string): Promise<Pedido[]> => {
  const startDate = "2025-01-01";
  
  const { data, error } = await supabase
    .from("pedidos")
    .select(CLIENT_PEDIDO_COLUMNS)
    .eq("client_user_id", userId)
    .gte("fecha_creacion", startDate)
    .order("fecha_creacion", { ascending: false });

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
    staleTime: 60 * 1000, // 60 seconds - reduced refetch frequency
    gcTime: 10 * 60 * 1000, // 10 minutes - longer cache
    refetchOnWindowFocus: false, // Disable auto-refetch to reduce CPU load
    refetchOnMount: true, // Refetch on mount but show stale data first
    placeholderData: (previousData) => previousData, // Instant UI transition
    structuralSharing: true, // Prevent re-renders if response is identical
    retry: 2, // Limit retries to prevent infinite loops
  });

  // Memoized refetch for manual sync button
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
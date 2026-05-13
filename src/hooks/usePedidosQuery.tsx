import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useRef, useEffect } from "react";

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

// Essential columns only - minimal payload for fast response
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
  tipo_novedad,
  order_items (
    id,
    product_name,
    sku,
    quantity,
    unit_price
  )
`;

// Local storage key for offline fallback
const CACHE_KEY_PREFIX = "pedidos_cache_";

/**
 * Fetches orders for the client with timeout protection.
 * Uses AbortController to prevent hanging requests.
 */
const fetchPedidosForClient = async (userId: string): Promise<Pedido[]> => {
  // Validate userId before making request
  if (!userId || userId === "undefined" || userId === "null") {
    console.warn("[usePedidosQuery] Invalid userId, skipping fetch");
    return [];
  }

  const startDate = "2025-01-01";
  
  try {
    // Create timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const { data, error } = await supabase
      .from("pedidos")
      .select(CLIENT_PEDIDO_COLUMNS)
      .eq("client_user_id", userId)
      .gte("fecha_creacion", startDate)
      .order("fecha_creacion", { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      console.error("❌ Error real de Supabase:", error.message, (error as any).details, (error as any).hint, (error as any).code);
      throw error;
    }

    // Cache successful response for offline fallback
    if (data && data.length > 0) {
      try {
        localStorage.setItem(
          CACHE_KEY_PREFIX + userId,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }

    return data || [];
  } catch (err: unknown) {
    // On timeout or network error, try to return cached data
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn("[usePedidosQuery] Fetch failed, trying cache:", errorMessage);
    
    try {
      const cached = localStorage.getItem(CACHE_KEY_PREFIX + userId);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Accept cache if less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          console.log("[usePedidosQuery] Using cached data from", new Date(timestamp).toISOString());
          return data;
        }
      }
    } catch {
      // Ignore cache read errors
    }
    
    throw err; // Re-throw if no valid cache
  }
};

/**
 * SWR-style hook for client orders. Features:
 * - Instant display of cached data while background refresh occurs
 * - 15-second timeout to prevent infinite loading states
 * - LocalStorage fallback for offline/timeout scenarios
 * - Validates userId before fetching
 */
export const usePedidosQuery = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear sync timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const query = useQuery({
    queryKey: ["pedidos", "cliente", userId],
    queryFn: () => fetchPedidosForClient(userId!),
    enabled: !!userId && userId !== "undefined" && userId !== "null",
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced refetch frequency
    gcTime: 15 * 60 * 1000, // 15 minutes - longer cache retention
    refetchOnWindowFocus: false, // Disable auto-refetch to reduce CPU load
    refetchOnMount: true, // Refetch on mount but show stale data first
    placeholderData: (previousData) => previousData, // Instant UI transition
    structuralSharing: true, // Prevent re-renders if response is identical
    retry: 1, // Single retry to prevent hammering DB during outages
    retryDelay: 2000, // 2 second delay between retries
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
    // Expose cache age for UI feedback
    hasCache: !!query.data && query.data.length > 0,
  };
};
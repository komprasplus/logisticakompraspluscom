import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTodayString } from "@/lib/dateUtils";

/**
 * Optimized admin pedidos hook with:
 * - Server-side pagination (lazy loading)
 * - Date range filtering at DB level
 * - React Query caching to prevent loops
 * - Graceful error handling
 */

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  fecha_entrega: string | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  latitud: number | null;
  longitud: number | null;
  barrio: string | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  valor_producto?: number | null;
  valor_flete?: number | null;
  utilidad?: number | null;
  municipio?: string | null;
  zona: string | null;
  tipo_novedad: string | null;
  firma_cliente: string | null;
  foto_paquete: string | null;
  foto_evidencia: string | null;
  fecha_actualizacion: string | null;
  client_phone: string | null;
  client_user_id: string | null;
  novedad_latitud?: number | null;
  novedad_longitud?: number | null;
  guia_impresa?: boolean | null;
  guia_impresa_at?: string | null;
  observaciones?: string | null;
}

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

// Minimal columns for fast queries
const PEDIDO_COLUMNS = `
  id, numero_guia, cliente_nombre, direccion_entrega, estado, corte_horario,
  fecha_creacion, fecha_entrega, motorizado_asignado, motorizado_id,
  latitud, longitud, barrio, metodo_pago, producto_nombre, valor_recaudar,
  valor_producto, valor_flete, utilidad, municipio, zona, tipo_novedad,
  firma_cliente, foto_paquete, foto_evidencia, fecha_actualizacion,
  client_phone, client_user_id, novedad_latitud, novedad_longitud,
  guia_impresa, guia_impresa_at, observaciones
`;

// Default date range: from project start (2025-01-01) to *today* (local timezone)
const DEFAULT_DATE_RANGE: DateRange = {
  from: "2025-01-01",
  to: getTodayString(),
};

/**
 * Fetch initial batch (most recent 50) + novedades (most recent 50)
 * This provides instant UI while background fetch loads more
 */
async function fetchInitialBatch(dateRange: DateRange): Promise<Pedido[]> {
  try {
    const [recentResult, novedadesResult] = await Promise.all([
      supabase
        .from("pedidos")
        .select(PEDIDO_COLUMNS)
        .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
        .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
        .order("fecha_creacion", { ascending: false })
        .limit(50),
      supabase
        .from("pedidos")
        .select(PEDIDO_COLUMNS)
        .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
        .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
        .ilike("estado", "%novedad%")
        .order("fecha_creacion", { ascending: false })
        .limit(50),
    ]);

    // Graceful handling - return partial data if one fails
    const recentData = recentResult.error ? [] : (recentResult.data || []);
    const novedadesData = novedadesResult.error ? [] : (novedadesResult.data || []);

    if (recentResult.error) {
      console.warn("Error fetching recent pedidos:", recentResult.error);
    }
    if (novedadesResult.error) {
      console.warn("Error fetching novedades:", novedadesResult.error);
    }

    // Merge and deduplicate
    const allData = [...recentData, ...novedadesData];
    const seenIds = new Set<number>();
    const merged: Pedido[] = [];
    for (const p of allData) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        merged.push(p as Pedido);
      }
    }

    // Sort by fecha_creacion desc
    merged.sort((a, b) => {
      const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return dateB - dateA;
    });

    return merged;
  } catch (error) {
    console.error("Critical error in fetchInitialBatch:", error);
    return [];
  }
}

/**
 * Background fetch for remaining orders (offset-based pagination)
 */
async function fetchMorePedidos(
  dateRange: DateRange,
  offset: number,
  limit: number = 100
): Promise<{ data: Pedido[]; hasMore: boolean }> {
  try {
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_COLUMNS)
      .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
      .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
      .order("fecha_creacion", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn("Error fetching more pedidos:", error);
      return { data: [], hasMore: false };
    }

    return {
      data: (data || []) as Pedido[],
      hasMore: (data?.length || 0) === limit,
    };
  } catch (error) {
    console.error("Error in fetchMorePedidos:", error);
    return { data: [], hasMore: false };
  }
}

export const useAdminPedidos = () => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [allPedidos, setAllPedidos] = useState<Pedido[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  const backgroundFetchRef = useRef(false);

  // Initial query with React Query (cached, stale-while-revalidate)
  const {
    data: initialData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-pedidos", dateRange.from, dateRange.to],
    queryFn: () => fetchInitialBatch(dateRange),
    staleTime: 60 * 1000, // 1 minute - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false, // Disable to prevent DB hammering
    retry: 1,
  });

  // Merge initial data with background-loaded data
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setAllPedidos((prev) => {
        // Merge without duplicates
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = initialData.filter((p) => !existingIds.has(p.id));
        if (newItems.length === 0) return prev;

        const merged = [...initialData, ...prev.filter((p) => !initialData.find((i) => i.id === p.id))];
        merged.sort((a, b) => {
          const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
          const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
          return dateB - dateA;
        });
        return merged;
      });
    }
  }, [initialData]);

  // Background lazy loading
  const loadMoreInBackground = useCallback(async () => {
    if (backgroundFetchRef.current || hasLoadedAll) return;
    backgroundFetchRef.current = true;
    setIsLoadingMore(true);

    let offset = allPedidos.length;
    let hasMore = true;
    const maxIterations = 5; // Safety limit: max 500 more orders (100 x 5)
    let iterations = 0;

    while (hasMore && iterations < maxIterations) {
      const result = await fetchMorePedidos(dateRange, offset);
      
      if (result.data.length > 0) {
        setAllPedidos((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = result.data.filter((p) => !existingIds.has(p.id));
          if (newItems.length === 0) return prev;

          const merged = [...prev, ...newItems];
          merged.sort((a, b) => {
            const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
            const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
            return dateB - dateA;
          });
          return merged;
        });
        offset += result.data.length;
      }

      hasMore = result.hasMore;
      iterations++;

      // Small delay between batches to reduce DB pressure
      if (hasMore) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setHasLoadedAll(true);
    setIsLoadingMore(false);
    backgroundFetchRef.current = false;
  }, [allPedidos.length, dateRange, hasLoadedAll]);

  // Trigger background loading once initial data is ready
  useEffect(() => {
    if (initialData && initialData.length > 0 && !hasLoadedAll && !isLoading) {
      // Delay background fetch to prioritize UI responsiveness
      const timer = setTimeout(() => {
        loadMoreInBackground();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [initialData, hasLoadedAll, isLoading, loadMoreInBackground]);

  // Update a pedido locally (optimistic update)
  const updatePedidoLocally = useCallback((id: number, updates: Partial<Pedido>) => {
    setAllPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  // Change date range and reset
  const changeDateRange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
    setAllPedidos([]);
    setHasLoadedAll(false);
    backgroundFetchRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
  }, [queryClient]);

  // Force refresh
  const forceRefresh = useCallback(() => {
    setAllPedidos([]);
    setHasLoadedAll(false);
    backgroundFetchRef.current = false;
    refetch();
  }, [refetch]);

  return {
    pedidos: allPedidos.length > 0 ? allPedidos : (initialData || []),
    isLoading,
    isFetching,
    isLoadingMore,
    hasLoadedAll,
    error,
    dateRange,
    changeDateRange,
    updatePedidoLocally,
    forceRefresh,
    totalLoaded: allPedidos.length,
  };
};

export type { Pedido, DateRange };
export { DEFAULT_DATE_RANGE };

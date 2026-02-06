import { useState, useCallback } from "react";
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
 * Fetch up to 100 records total (no background loading).
 * Combines recent orders + novedades to ensure visibility of problem orders.
 */
async function fetchPedidos100(dateRange: DateRange): Promise<Pedido[]> {
  try {
    const [recentResult, novedadesResult] = await Promise.all([
      supabase
        .from("pedidos")
        .select(PEDIDO_COLUMNS)
        .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
        .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
        .order("fecha_creacion", { ascending: false })
        .limit(100), // 100 most recent
      supabase
        .from("pedidos")
        .select(PEDIDO_COLUMNS)
        .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
        .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
        .ilike("estado", "%novedad%")
        .order("fecha_creacion", { ascending: false })
        .limit(100), // 100 novedades
    ]);

    const recentData = recentResult.error ? [] : (recentResult.data || []);
    const novedadesData = novedadesResult.error ? [] : (novedadesResult.data || []);

    if (recentResult.error) console.warn("Error fetching recent:", recentResult.error);
    if (novedadesResult.error) console.warn("Error fetching novedades:", novedadesResult.error);

    // Merge and deduplicate
    const seenIds = new Set<number>();
    const merged: Pedido[] = [];
    for (const p of [...recentData, ...novedadesData]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        merged.push(p as Pedido);
      }
    }

    // Always sort by fecha_creacion descending (newest first)
    merged.sort((a, b) => {
      const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return dateB - dateA;
    });

    return merged;
  } catch (error) {
    console.error("Critical error in fetchPedidos50:", error);
    return [];
  }
}

// Background fetch removed to prevent CPU saturation

export const useAdminPedidos = () => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);

  // Main query - fetches up to 100 records total (no background loading)
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-pedidos", dateRange.from, dateRange.to],
    queryFn: () => fetchPedidos100(dateRange),
    staleTime: 60 * 1000, // 1 minute - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false, // Disable to prevent DB hammering
    retry: 1,
  });

  const pedidos = data || [];

  // Update a pedido locally (optimistic update)
  const updatePedidoLocally = useCallback((id: number, updates: Partial<Pedido>) => {
    queryClient.setQueryData<Pedido[]>(
      ["admin-pedidos", dateRange.from, dateRange.to],
      (old) => old?.map((p) => (p.id === id ? { ...p, ...updates } : p)) ?? []
    );
  }, [queryClient, dateRange]);

  // Change date range and reset
  const changeDateRange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
    queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
  }, [queryClient]);

  // Force refresh
  const forceRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    pedidos,
    isLoading,
    isFetching,
    isLoadingMore: false, // No background loading
    hasLoadedAll: true, // Always true since we don't do background fetch
    error,
    dateRange,
    changeDateRange,
    updatePedidoLocally,
    forceRefresh,
    totalLoaded: pedidos.length,
  };
};

export type { Pedido, DateRange };
export { DEFAULT_DATE_RANGE };

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTodayString } from "@/lib/dateUtils";

/**
 * Server-side paginated admin pedidos hook.
 * Uses .range(offset, offset+limit-1) with count:'exact' for real pagination.
 * React Query handles caching (staleTime 60s) to prevent CPU saturation.
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

// Default to last 30 days to prevent DB timeouts on large tables
const DEFAULT_DATE_RANGE: DateRange = (() => {
  const today = getTodayString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const from = thirtyDaysAgo.toISOString().split("T")[0];
  return { from, to: today };
})();

const PAGE_SIZE = 100;

interface FetchResult {
  data: Pedido[];
  totalCount: number;
}

/**
 * Fetch a single page of pedidos using server-side pagination.
 * Uses count:'exact' and .range() so the browser only receives PAGE_SIZE rows.
 */
async function fetchPedidosPage(
  dateRange: DateRange,
  page: number,
): Promise<FetchResult> {
  try {
    const offset = (page - 1) * PAGE_SIZE;

    const { data, error, count } = await supabase
      .from("pedidos")
      .select(PEDIDO_COLUMNS, { count: "exact" })
      .gte("fecha_creacion", `${dateRange.from}T00:00:00`)
      .lte("fecha_creacion", `${dateRange.to}T23:59:59`)
      .order("fecha_creacion", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching pedidos page:", error);
      return { data: [], totalCount: 0 };
    }

    return {
      data: (data ?? []) as Pedido[],
      totalCount: count ?? 0,
    };
  } catch (error) {
    console.error("Critical error in fetchPedidosPage:", error);
    return { data: [], totalCount: 0 };
  }
}

export const useAdminPedidos = () => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [serverPage, setServerPage] = useState(1);

  // Main query — server-side paginated, 100 rows per page
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-pedidos", dateRange.from, dateRange.to, serverPage],
    queryFn: () => fetchPedidosPage(dateRange, serverPage),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const pedidos = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalServerPages = Math.ceil(totalCount / PAGE_SIZE);

  // Optimistic local update (within current cached page)
  const updatePedidoLocally = useCallback(
    (id: number, updates: Partial<Pedido>) => {
      queryClient.setQueryData<FetchResult>(
        ["admin-pedidos", dateRange.from, dateRange.to, serverPage],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          };
        },
      );
    },
    [queryClient, dateRange, serverPage],
  );

  // Navigate to a server page
  const goToServerPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, totalServerPages || 1));
    setServerPage(clamped);
  }, [totalServerPages]);

  // Change date range → reset to page 1
  const changeDateRange = useCallback(
    (newRange: DateRange) => {
      setDateRange(newRange);
      setServerPage(1);
      queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
    },
    [queryClient],
  );

  // Force refresh — blow away cache and refetch
  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
  }, [queryClient]);

  return {
    pedidos,
    isLoading,
    isFetching,
    error,
    dateRange,
    changeDateRange,
    updatePedidoLocally,
    forceRefresh,
    totalLoaded: pedidos.length,
    // Server-side pagination
    serverPage,
    totalServerPages,
    totalCount,
    goToServerPage,
    pageSize: PAGE_SIZE,
    // Legacy compat
    isLoadingMore: false,
    hasLoadedAll: true,
  };
};

export type { Pedido, DateRange };
export { DEFAULT_DATE_RANGE, PAGE_SIZE };

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { isOperationalStatus } from "@/lib/orderStatuses";
import { getStartOfTodayBogotaISO } from "@/lib/dateUtils";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  foto_evidencia: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  producto_nombre: string | null;
  zona: string | null;
  tipo_novedad?: string | null;
  firma_cliente?: string | null;
  foto_paquete?: string | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  inventory_item_id?: string | null;
  quantity?: number | null;
  canal?: string | null;
  fecha_actualizacion?: string | null;
}

// Minimal columns for motorizado performance
const MOTORIZADO_PEDIDO_COLUMNS = `
  id,
  numero_guia,
  cliente_nombre,
  direccion_entrega,
  estado,
  corte_horario,
  foto_evidencia,
  client_phone,
  latitud,
  longitud,
  producto_nombre,
  zona,
  tipo_novedad,
  firma_cliente,
  foto_paquete,
  valor_recaudar,
  metodo_pago,
  inventory_item_id,
  quantity,
  client_user_id,
  canal,
  fecha_actualizacion
`;

/**
 * Optimized fetcher for motorizado orders.
 * Trae pedidos activos (Asignado, En Ruta, Novedad) + Entregados de hoy en TZ Bogotá,
 * para que el motorizado vea sus métricas del día y los pedidos completados.
 */
const fetchMotorizadoPedidos = async (userId: string): Promise<Pedido[]> => {
  const todayStartIso = getStartOfTodayBogotaISO();

  const [activeResp, deliveredTodayResp] = await Promise.all([
    supabase
      .from("pedidos")
      .select(MOTORIZADO_PEDIDO_COLUMNS)
      .eq("motorizado_id", userId)
      .in("estado", ["Asignado", "En Ruta", "Novedad"])
      .order("id", { ascending: true })
      .limit(50),
    supabase
      .from("pedidos")
      .select(MOTORIZADO_PEDIDO_COLUMNS)
      .eq("motorizado_id", userId)
      .eq("estado", "Entregado")
      .gte("fecha_actualizacion", todayStartIso)
      .order("fecha_actualizacion", { ascending: false })
      .limit(50),
  ]);

  if (activeResp.error) throw activeResp.error;
  if (deliveredTodayResp.error) throw deliveredTodayResp.error;

  const active = (activeResp.data || []).filter((p) =>
    isOperationalStatus(p.estado),
  );
  const deliveredToday = deliveredTodayResp.data || [];

  return [...active, ...deliveredToday];
};

/**
 * React Query hook for motorizado orders with SWR-style caching.
 * - Shows cached data instantly
 * - Background refresh on mount
 * - 60s stale time to prevent excessive queries
 */
export const useMotorizadoPedidos = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pedidos", "motorizado", userId],
    queryFn: () => fetchMotorizadoPedidos(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retained
    refetchOnWindowFocus: false, // Prevent focus refetch on mobile
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
    structuralSharing: true,
  });

  // Avisar al motorizado si la query falla — antes era silenciosa.
  const lastErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (query.error && query.error !== lastErrorRef.current) {
      lastErrorRef.current = query.error;
      toast.error(
        "No se pudieron cargar tus pedidos. Revisa tu conexión y vuelve a intentar.",
      );
    }
    if (!query.error) lastErrorRef.current = null;
  }, [query.error]);

  // Optimistic update for local state changes
  const updatePedidoLocally = useCallback(
    (pedidoId: number, updates: Partial<Pedido>) => {
      queryClient.setQueryData<Pedido[]>(
        ["pedidos", "motorizado", userId],
        (old) =>
          old?.map((p) =>
            p.id === pedidoId ? { ...p, ...updates } : p
          ) ?? []
      );
    },
    [queryClient, userId]
  );

  // Remove pedido from cache (after delivery/novedad)
  const removePedidoLocally = useCallback(
    (pedidoId: number) => {
      queryClient.setQueryData<Pedido[]>(
        ["pedidos", "motorizado", userId],
        (old) => old?.filter((p) => p.id !== pedidoId) ?? []
      );
    },
    [queryClient, userId]
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pedidos", "motorizado", userId] });
  }, [queryClient, userId]);

  return {
    pedidos: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    updatePedidoLocally,
    removePedidoLocally,
  };
};

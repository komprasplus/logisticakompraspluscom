import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const usePedidosQuery = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pedidos", "cliente", userId],
    queryFn: () => fetchPedidosForClient(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch on mount but show stale data first
    placeholderData: (previousData) => previousData, // Show previous data while loading new
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["pedidos", "cliente", userId] });
  };

  return {
    pedidos: query.data || [],
    isLoading: query.isLoading, // True only on first load with no cache
    isFetching: query.isFetching, // True during any fetch (including background)
    isStale: query.isStale,
    error: query.error,
    refetch,
  };
};

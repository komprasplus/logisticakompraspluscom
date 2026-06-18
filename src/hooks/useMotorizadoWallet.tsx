import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MotorizadoWalletBalance {
  balance_disponible: number;
  fondo_garantia: number;
  total_ganado: number;
  total_retirado: number;
  total_entregas: number;
}

/**
 * Hook React Query sobre la RPC public.get_motorizado_wallet_balance.
 * Cachea 60s. Retorna balance disponible, fondo garantía, totales acumulados.
 *
 * Si no hay datos aún (motorizado nuevo o sin entregas), retorna 0 en todo.
 */
export const useMotorizadoWallet = (motorizadoId: string | undefined) => {
  const query = useQuery({
    queryKey: ["motorizado-wallet", motorizadoId],
    queryFn: async (): Promise<MotorizadoWalletBalance> => {
      const { data, error } = await (supabase.rpc as any)(
        "get_motorizado_wallet_balance",
        { p_motorizado_id: motorizadoId },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        balance_disponible: Number(row?.balance_disponible ?? 0),
        fondo_garantia: Number(row?.fondo_garantia ?? 0),
        total_ganado: Number(row?.total_ganado ?? 0),
        total_retirado: Number(row?.total_retirado ?? 0),
        total_entregas: Number(row?.total_entregas ?? 0),
      };
    },
    enabled: !!motorizadoId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });

  return {
    balance: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

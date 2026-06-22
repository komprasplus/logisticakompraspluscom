import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cupon {
  id: string;
  code: string;
  tipo: "percent" | "fixed";
  valor: number;
  min_pedido: number;
  max_usos: number | null;
  usos_count: number;
  activa: boolean;
  valid_from: string | null;
  valid_until: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface CrearCuponInput {
  code: string;
  tipo: "percent" | "fixed";
  valor: number;
  min_pedido?: number;
  max_usos?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  descripcion?: string | null;
}

const QK_CUPONES = ["cupones"] as const;

// Wrapper para mantener `this` binding del cliente supabase (ver hotfix prior).
const rpc = (...args: Parameters<typeof supabase.rpc>) =>
  (supabase.rpc as any).apply(supabase, args);

export const useCupones = () => {
  return useQuery({
    queryKey: QK_CUPONES,
    queryFn: async (): Promise<Cupon[]> => {
      const { data, error } = await rpc("proveedor_listar_cupones");
      if (error) throw error;
      return (data ?? []) as Cupon[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useCrearCupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearCuponInput): Promise<string> => {
      const { data, error } = await rpc("proveedor_crear_cupon", {
        p_code: input.code,
        p_tipo: input.tipo,
        p_valor: input.valor,
        p_min_pedido: input.min_pedido ?? 0,
        p_max_usos: input.max_usos ?? null,
        p_valid_from: input.valid_from ?? null,
        p_valid_until: input.valid_until ?? null,
        p_descripcion: input.descripcion ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_CUPONES }),
  });
};

export const useActualizarCupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      activa?: boolean;
      max_usos?: number | null;
      valid_until?: string | null;
      min_pedido?: number;
      descripcion?: string | null;
    }) => {
      const { error } = await rpc("proveedor_actualizar_cupon", {
        p_id: input.id,
        p_activa: input.activa ?? null,
        p_max_usos: input.max_usos ?? null,
        p_valid_until: input.valid_until ?? null,
        p_min_pedido: input.min_pedido ?? null,
        p_descripcion: input.descripcion ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_CUPONES }),
  });
};

export const useArchivarCupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("proveedor_archivar_cupon", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_CUPONES }),
  });
};

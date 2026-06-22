import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MotorizadoTarifa {
  id: string;
  municipio: string;
  tipo: "entrega" | "devolucion" | "recoleccion";
  valor: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  activa: boolean;
  notas: string | null;
  created_at: string;
}

export interface MotorizadoOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

const rpc = (...args: Parameters<typeof supabase.rpc>) =>
  (supabase.rpc as any).apply(supabase, args);

// Lista todos los motorizados (admin only)
export const useMotorizadosList = () =>
  useQuery({
    queryKey: ["admin-motorizados-list"],
    queryFn: async (): Promise<MotorizadoOption[]> => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .eq("tipo_cuenta", "motorizado")
        .eq("status", "activo")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MotorizadoOption[];
    },
    staleTime: 60 * 1000,
  });

export const useTarifasMotorizado = (motorizadoId: string | undefined) =>
  useQuery({
    queryKey: ["motorizado-tarifas", motorizadoId],
    enabled: !!motorizadoId,
    queryFn: async (): Promise<MotorizadoTarifa[]> => {
      const { data, error } = await rpc("admin_listar_tarifas_motorizado", {
        p_motorizado_id: motorizadoId,
      });
      if (error) throw error;
      return (data ?? []) as MotorizadoTarifa[];
    },
    staleTime: 30 * 1000,
  });

export const useUpsertTarifa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      motorizadoId: string;
      municipio: string;
      tipo: "entrega" | "devolucion" | "recoleccion";
      valor: number;
      vigente_desde?: string;
      vigente_hasta?: string | null;
      notas?: string | null;
    }): Promise<string> => {
      const { data, error } = await rpc("admin_upsert_tarifa_motorizado", {
        p_motorizado_id: input.motorizadoId,
        p_municipio: input.municipio,
        p_tipo: input.tipo,
        p_valor: input.valor,
        p_vigente_desde: input.vigente_desde ?? null,
        p_vigente_hasta: input.vigente_hasta ?? null,
        p_notas: input.notas ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["motorizado-tarifas", variables.motorizadoId] }),
  });
};

export const useArchivarTarifa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; motorizadoId: string }) => {
      const { error } = await rpc("admin_archivar_tarifa_motorizado", { p_id: input.id });
      if (error) throw error;
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["motorizado-tarifas", variables.motorizadoId] }),
  });
};

// Movimientos del motorizado (lo usa la wallet del motorizado)
export interface WalletMovimientoItem {
  tipo: "ENTREGA" | "RETIRO" | "BONIFICACION" | "AJUSTE" | string;
  ref: string;
  fecha: string;
  fecha_ts: string;
  descripcion: string;
  municipio: string | null;
  cliente_nombre: string | null;
  monto: number;
  direccion: "credito" | "debito";
}

export const useMotorizadoMovimientos = (motorizadoId: string | undefined) =>
  useQuery({
    queryKey: ["motorizado-movimientos", motorizadoId],
    enabled: !!motorizadoId,
    queryFn: async (): Promise<WalletMovimientoItem[]> => {
      const { data, error } = await rpc("get_motorizado_movimientos_detalle", {
        p_motorizado_id: motorizadoId,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as WalletMovimientoItem[];
    },
    staleTime: 30 * 1000,
  });

// Tarifas propias del motorizado (transparencia)
export const useMisTarifas = (enabled: boolean = true) =>
  useQuery({
    queryKey: ["mis-tarifas"],
    enabled,
    queryFn: async () => {
      const { data, error } = await rpc("motorizado_get_mis_tarifas");
      if (error) throw error;
      return (data ?? []) as Array<{
        municipio: string;
        tipo: string;
        valor: number;
        vigente_desde: string;
        vigente_hasta: string | null;
      }>;
    },
    staleTime: 60 * 1000,
  });

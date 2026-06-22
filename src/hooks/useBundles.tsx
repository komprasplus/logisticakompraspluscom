import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BundleItem {
  product_id: string;
  quantity: number;
  product_name: string;
  sku: string | null;
  price: number | null;
  image_url: string | null;
  stock: number;
}

export interface Bundle {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  image_url: string | null;
  descuento_tipo: "percent" | "fixed";
  descuento_valor: number;
  activo: boolean;
  created_at: string;
  items: BundleItem[];
  items_count: number;
}

export interface BundleItemInput {
  product_id: string;
  quantity: number;
}

const QK = ["bundles"] as const;

const rpc = (...args: Parameters<typeof supabase.rpc>) =>
  (supabase.rpc as any).apply(supabase, args);

export const useBundles = () =>
  useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Bundle[]> => {
      const { data, error } = await rpc("proveedor_listar_bundles");
      if (error) throw error;
      return (data ?? []) as Bundle[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCrearBundle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nombre: string;
      slug: string;
      descuento_tipo: "percent" | "fixed";
      descuento_valor: number;
      descripcion?: string | null;
      image_url?: string | null;
      items: BundleItemInput[];
    }): Promise<string> => {
      const { data, error } = await rpc("proveedor_crear_bundle", {
        p_nombre: input.nombre,
        p_slug: input.slug,
        p_descuento_tipo: input.descuento_tipo,
        p_descuento_valor: input.descuento_valor,
        p_descripcion: input.descripcion ?? null,
        p_image_url: input.image_url ?? null,
        p_items: input.items,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useActualizarBundle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nombre?: string;
      descripcion?: string | null;
      image_url?: string | null;
      descuento_tipo?: "percent" | "fixed";
      descuento_valor?: number;
      activo?: boolean;
      items?: BundleItemInput[];
    }) => {
      const { error } = await rpc("proveedor_actualizar_bundle", {
        p_id: input.id,
        p_nombre: input.nombre ?? null,
        p_descripcion: input.descripcion ?? null,
        p_image_url: input.image_url ?? null,
        p_descuento_tipo: input.descuento_tipo ?? null,
        p_descuento_valor: input.descuento_valor ?? null,
        p_activo: input.activo ?? null,
        p_items: input.items ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useArchivarBundle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("proveedor_archivar_bundle", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

// ── Productos disponibles para armar bundles (inventario público del proveedor) ──
export const useInventarioPublico = () =>
  useQuery({
    queryKey: ["inventario-publico-proveedor"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("id, sku, product_name, price, cost_price, stock_available, image_url")
        .eq("client_user_id", userId)
        .eq("is_public", true)
        .eq("is_deleted", false)
        .order("product_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        sku: string;
        product_name: string;
        price: number | null;
        cost_price: number | null;
        stock_available: number;
        image_url: string | null;
      }>;
    },
    staleTime: 60 * 1000,
  });

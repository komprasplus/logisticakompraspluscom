import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ListaPrecio {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  moneda: string;
  moq_lista: number;
  es_publica: boolean;
  tiene_codigo_acceso: boolean;
  es_default: boolean;
  activa: boolean;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface PrecioListaItem {
  product_id: string;
  sku: string | null;
  product_name: string;
  image_url: string | null;
  category: string | null;
  stock_available: number;
  precio_base: number | null;
  precio_lista: number | null;
  min_quantity: number | null;
  tiene_override: boolean;
  is_public: boolean;
}

export interface CrearListaPrecioInput {
  nombre: string;
  slug: string;
  descripcion?: string | null;
  moq_lista?: number;
  es_publica?: boolean;
  codigo_acceso?: string | null;
  es_default?: boolean;
}

export interface ActualizarListaPrecioInput
  extends Partial<CrearListaPrecioInput> {
  activa?: boolean;
}

const QK_LISTAS = ["listas-precios"] as const;
const QK_ITEMS = (listaId: string) => ["listas-precios", listaId, "items"];

// IMPORTANTE: `bind(supabase)` preserva el `this` interno del cliente.
// Sin esto, supabase-js intenta acceder a `this.rest` y truena con
// "Cannot read properties of undefined (reading 'rest')".
const rpc = (...args: Parameters<typeof supabase.rpc>) =>
  (supabase.rpc as any).apply(supabase, args);

export const useListasPrecios = () => {
  return useQuery({
    queryKey: QK_LISTAS,
    queryFn: async (): Promise<ListaPrecio[]> => {
      const { data, error } = await rpc("proveedor_listar_listas_precios");
      if (error) throw error;
      return (data ?? []) as ListaPrecio[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const usePreciosLista = (listaId: string | null | undefined) => {
  return useQuery({
    queryKey: listaId ? QK_ITEMS(listaId) : ["listas-precios", "noop"],
    enabled: !!listaId,
    queryFn: async (): Promise<PrecioListaItem[]> => {
      const { data, error } = await rpc("proveedor_listar_precios_lista", {
        p_lista_id: listaId,
      });
      if (error) throw error;
      return (data ?? []) as PrecioListaItem[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useCrearListaPrecio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearListaPrecioInput): Promise<string> => {
      const { data, error } = await rpc("proveedor_crear_lista_precio", {
        p_nombre: input.nombre,
        p_slug: input.slug,
        p_descripcion: input.descripcion ?? null,
        p_moq_lista: input.moq_lista ?? 1,
        p_es_publica: input.es_publica ?? true,
        p_codigo_acceso: input.codigo_acceso ?? null,
        p_es_default: input.es_default ?? false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_LISTAS }),
  });
};

export const useActualizarListaPrecio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: ActualizarListaPrecioInput & { id: string }): Promise<void> => {
      const { error } = await rpc("proveedor_actualizar_lista_precio", {
        p_lista_id: id,
        p_nombre: input.nombre ?? null,
        p_slug: input.slug ?? null,
        p_descripcion: input.descripcion ?? null,
        p_moq_lista: input.moq_lista ?? null,
        p_es_publica: input.es_publica ?? null,
        p_codigo_acceso: input.codigo_acceso ?? null,
        p_es_default: input.es_default ?? null,
        p_activa: input.activa ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_LISTAS }),
  });
};

export const useArchivarListaPrecio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await rpc("proveedor_archivar_lista_precio", {
        p_lista_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_LISTAS }),
  });
};

export const useUpsertPrecioItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listaId: string;
      productId: string;
      precio: number;
      minQuantity?: number | null;
    }): Promise<void> => {
      const { error } = await rpc("proveedor_upsert_precio_item", {
        p_lista_id: input.listaId,
        p_product_id: input.productId,
        p_precio: input.precio,
        p_min_quantity: input.minQuantity ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: QK_ITEMS(variables.listaId) });
      qc.invalidateQueries({ queryKey: QK_LISTAS });
    },
  });
};

export const useEliminarPrecioItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listaId: string;
      productId: string;
    }): Promise<void> => {
      const { error } = await rpc("proveedor_eliminar_precio_item", {
        p_lista_id: input.listaId,
        p_product_id: input.productId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: QK_ITEMS(variables.listaId) });
      qc.invalidateQueries({ queryKey: QK_LISTAS });
    },
  });
};

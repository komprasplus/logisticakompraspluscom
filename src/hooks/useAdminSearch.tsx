import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
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

/**
 * Universal admin search hook that queries Supabase directly,
 * bypassing all local filters for emergency order lookup.
 */
export const useAdminSearch = () => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchOrders = useCallback(async (query: string) => {
    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = query.trim();
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return [];
    }

    abortControllerRef.current = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    try {
      // Search by numero_guia (exact or partial match) OR cliente_nombre
      // No filters applied - searches entire database
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .or(`numero_guia.ilike.%${trimmedQuery}%,cliente_nombre.ilike.%${trimmedQuery}%,client_phone.ilike.%${trimmedQuery}%`)
        .order("fecha_creacion", { ascending: false })
        .limit(50);

      if (error) throw error;

      setSearchResults(data || []);
      return data || [];
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Request was cancelled, ignore
        return [];
      }
      console.error("Search error:", err);
      setSearchError(err.message || "Error al buscar");
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchOrders,
    clearSearch,
  };
};

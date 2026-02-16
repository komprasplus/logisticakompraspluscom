import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

/*
  FIX: columnas como array en lugar de template string.
  Más fácil de mantener, añadir o remover columnas.
*/
const PEDIDO_COLUMNS = [
  "id",
  "numero_guia",
  "cliente_nombre",
  "direccion_entrega",
  "estado",
  "corte_horario",
  "fecha_creacion",
  "fecha_entrega",
  "motorizado_asignado",
  "motorizado_id",
  "latitud",
  "longitud",
  "barrio",
  "metodo_pago",
  "producto_nombre",
  "valor_recaudar",
  "valor_producto",
  "valor_flete",
  "utilidad",
  "municipio",
  "zona",
  "tipo_novedad",
  "firma_cliente",
  "foto_paquete",
  "foto_evidencia",
  "fecha_actualizacion",
  "client_phone",
  "client_user_id",
  "novedad_latitud",
  "novedad_longitud",
  "guia_impresa",
  "guia_impresa_at",
  "observaciones",
].join(", ");

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  to: string; // YYYY-MM-DD
}

interface FetchResult {
  data: Pedido[];
  totalCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX: `DEFAULT_DATE_RANGE` como función en lugar de constante calculada.
  La versión original calculaba el rango UNA VEZ cuando el módulo se cargaba.
  Si la app quedaba abierta por días, "today" era el día del primer load,
  no el día actual. Ahora es una función que calcula el rango dinámicamente
  cada vez que se llama.

  FIX: timezone consistente en ambas fechas.
  Usa `format(date, "yyyy-MM-dd")` de date-fns para ambos extremos del rango,
  garantizando que ambos usen el mismo método y el mismo timezone del sistema.
*/
const getDefaultDateRange = (): DateRange => {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  return {
    from: format(thirtyDaysAgo, "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
};

/*
  FIX: queries de fecha con timezone explícito.
  La versión original hacía `.gte("fecha_creacion", \`${dateRange.from}T00:00:00\`)`.
  Esto crea un timestamp sin zona horaria, que Supabase interpreta como UTC.
  Si el usuario selecciona "2025-01-15" pensando en Colombia, la query busca
  desde "2025-01-15 00:00:00 UTC" = "2025-01-14 19:00:00 Colombia" (UTC-5),
  perdiendo las últimas 5 horas del día anterior.

  Solución: añadir timezone explícito `-05:00` (Colombia no usa DST, siempre UTC-5)
  al construir los timestamps.
*/
const buildTimestamp = (dateYYYYMMDD: string, isStart: boolean): string => {
  const time = isStart ? "00:00:00" : "23:59:59";
  return `${dateYYYYMMDD}T${time}-05:00`; // Colombia UTC-5
};

/**
 * Fetch de una página de pedidos con paginación server-side.
 * Usa `count: 'exact'` y `.range()` para que el navegador solo reciba PAGE_SIZE filas.
 *
 * FIX: try-catch eliminado + error lanzado explícitamente.
 * La versión original capturaba errores y retornaba `{ data: [], totalCount: 0 }`
 * silenciosamente. React Query tiene su propio error handling — si `fetchPedidosPage`
 * lanza un error, RQ lo captura y lo expone en `error`, permitiendo que el componente
 * muestre UI de error. Tragarse el error aquí ocultaba problemas de red/permisos.
 */
async function fetchPedidosPage(dateRange: DateRange, page: number): Promise<FetchResult> {
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await supabase
    .from("pedidos")
    .select(PEDIDO_COLUMNS, { count: "exact" })
    .gte("fecha_creacion", buildTimestamp(dateRange.from, true))
    .lte("fecha_creacion", buildTimestamp(dateRange.to, false))
    .order("fecha_creacion", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("[useAdminPedidos] Supabase error:", error);
    throw new Error(`Error al cargar pedidos: ${error.message}`);
  }

  return {
    data: (data ?? []) as Pedido[],
    totalCount: count ?? 0,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAdminPedidos = () => {
  const queryClient = useQueryClient();

  /*
    FIX: `DEFAULT_DATE_RANGE` calculado como estado inicial dinámico.
    Ahora cada vez que el hook se monta se obtiene el rango actual.
  */
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [serverPage, setServerPage] = useState(1);

  // Query principal — paginación server-side, 100 filas por página
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-pedidos", dateRange.from, dateRange.to, serverPage],
    queryFn: () => fetchPedidosPage(dateRange, serverPage),
    staleTime: 60 * 1000, // 1 minuto
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    /*
      FIX: `retry: 1` → `retry: 2`.
      Con `retry: 1` solo se intenta una vez además del intento inicial.
      Si hay un problema temporal de red (ej: timeout de 1s), no se reintenta
      lo suficiente. `retry: 2` da 3 intentos totales (original + 2 reintentos).
    */
    retry: 2,
  });

  const pedidos = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalServerPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  // ── Actualización optimista local ─────────────────────────────────────────

  /*
    NOTA: `updatePedidoLocally` solo actualiza la página actual en caché.
    Si el cambio afecta el ordenamiento (ej: cambiar `fecha_creacion`), el
    pedido podría moverse a otra página. Para casos así, el componente debería
    llamar `forceRefresh()` después de actualizar.
  */
  const updatePedidoLocally = useCallback(
    (id: number, updates: Partial<Pedido>) => {
      queryClient.setQueryData<FetchResult>(["admin-pedidos", dateRange.from, dateRange.to, serverPage], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        };
      });
    },
    [queryClient, dateRange.from, dateRange.to, serverPage],
  );

  // ── Navegación de páginas ─────────────────────────────────────────────────

  const goToServerPage = useCallback(
    (page: number) => {
      /*
        FIX: clamp mejorado.
        Si `totalServerPages` es 0 (sin pedidos), la página válida es 1 (vacía).
        El clamp original permitía esto correctamente, pero ahora es más explícito.
      */
      const maxPage = Math.max(1, totalServerPages);
      const clamped = Math.max(1, Math.min(page, maxPage));
      setServerPage(clamped);
    },
    [totalServerPages],
  );

  // ── Cambio de rango de fechas ─────────────────────────────────────────────

  const changeDateRange = useCallback(
    (newRange: DateRange) => {
      setDateRange(newRange);
      setServerPage(1);
      /*
        Invalida todas las queries de admin-pedidos porque el rango cambió.
        Esto limpia la caché de todas las páginas visitadas previamente.
      */
      queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
    },
    [queryClient],
  );

  // ── Force refresh ──────────────────────────────────────────────────────────

  /*
    FIX: eliminar `refetch` de los exports, usar solo `forceRefresh`.
    La versión original exponía TANTO `refetch` (de useQuery) como `forceRefresh`
    (que invalida queries). Esto es confuso — dos formas de hacer lo mismo.
    `forceRefresh` es mejor porque invalida la caché Y refetchea, mientras que
    `refetch` solo refetchea sin invalidar. Eliminamos `refetch` del return.
  */
  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
    /*
      FIX: toast de feedback al usuario.
      La versión original no daba ninguna indicación de que el refresh se había
      iniciado. Añadido toast.
    */
    toast.info("Actualizando pedidos...");
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

    // Paginación server-side
    serverPage,
    totalServerPages,
    totalCount,
    goToServerPage,
    pageSize: PAGE_SIZE,

    /*
      Legacy compatibility — hardcoded porque este hook usa paginación
      server-side, no infinite scroll.
      - `isLoadingMore: false` — no hay concepto de "cargar más"
      - `hasLoadedAll: true` — siempre "true" porque cada página es completa
    */
    isLoadingMore: false,
    hasLoadedAll: true,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export type { Pedido, DateRange };
export { PAGE_SIZE };
/*
  FIX: `DEFAULT_DATE_RANGE` exportado como función.
  Ahora los consumidores pueden llamar `getDefaultDateRange()` para obtener
  un rango actualizado, en lugar de importar una constante stale.
*/
export { getDefaultDateRange };

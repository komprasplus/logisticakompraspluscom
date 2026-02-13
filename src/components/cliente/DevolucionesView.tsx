import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, DollarSign, AlertCircle, TrendingDown, Package, MapPin, Calendar } from "lucide-react";
import { formatCOP } from "@/lib/tarifas";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  municipio?: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  valor_flete?: number | null;
  intentos_entrega?: number;
  costo_devolucion?: number;
  devolucion_cobrada?: boolean;
}

interface DevolucionesViewProps {
  pedidos: Pedido[];
  loading: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: magic number `12000` extraído como constante.
  Aparecía dos veces: en el cálculo de `totalCobrado` y en el render.
  Si la tarifa por defecto cambia, solo hay que actualizar un lugar.
*/
const COSTO_DEVOLUCION_DEFAULT = 12000;

/**
 * Estados que califican como devolución, normalizados a minúsculas.
 * FIX: set en lugar de dos comparaciones separadas con `||`.
 */
const ESTADOS_DEVOLUCION = new Set(["devolución", "devolucion"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX: `formatDate` movida fuera del componente.
  Era una función pura sin dependencias del scope, recreada en cada render.

  FIX: `new Date(dateStr)` sin timezone parseaba la fecha en UTC,
  lo que podía mostrar un día diferente para usuarios en Colombia
  según la hora del día (ej. "2026-02-01" a las 11pm Bogotá se
  interpretaba como "31 de enero" en UTC-5).
  Corregido forzando la zona `America/Bogota`.
*/
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Resuelve el costo de devolución con fallback seguro.
 * FIX: `||` reemplazado por `??` para que el valor `0` no se descarte
 * como falsy — un costo de devolución de $0 es un valor válido y distinto
 * de "no especificado".
 */
const getCostoDevolucion = (pedido: Pedido): number =>
  pedido.costo_devolucion ?? pedido.valor_flete ?? COSTO_DEVOLUCION_DEFAULT;

// ─── Componente ───────────────────────────────────────────────────────────────

const DevolucionesView = ({ pedidos, loading }: DevolucionesViewProps) => {
  const prefersReducedMotion = useReducedMotion();

  // ── Derivados ──────────────────────────────────────────────────────────────

  const devolucionesPedidos = useMemo(
    () => pedidos.filter((p) => ESTADOS_DEVOLUCION.has(p.estado?.toLowerCase() ?? "")),
    [pedidos],
  );

  const totalCobrado = useMemo(
    () => devolucionesPedidos.filter((p) => p.devolucion_cobrada).reduce((sum, p) => sum + getCostoDevolucion(p), 0),
    [devolucionesPedidos],
  );

  // ── Paginación ─────────────────────────────────────────────────────────────

  const {
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    itemsPerPage,
    goToPage,
    setItemsPerPage,
  } = usePagination({ items: devolucionesPedidos, itemsPerPage: 10 });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 flex-shrink-0">
          <RotateCcw className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Devoluciones y Cobros</h2>
          <p className="text-sm text-muted-foreground">Pedidos devueltos tras 2 intentos fallidos</p>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          className="rounded-2xl bg-card border border-border p-5 shadow-md"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.1 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
              <RotateCcw className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <span className="text-sm text-muted-foreground">Total Devoluciones</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{devolucionesPedidos.length}</p>
        </motion.div>

        <motion.div
          className="rounded-2xl bg-card border border-border p-5 shadow-md"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15">
              <TrendingDown className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
            <span className="text-sm text-muted-foreground">Total Descontado</span>
          </div>
          <p className="text-3xl font-bold text-destructive">{formatCOP(totalCobrado)}</p>
        </motion.div>
      </div>

      {/* Banner informativo */}
      <div role="note" className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-amber-700">Política de Devoluciones</p>
          <p className="text-xs text-amber-600 mt-1">
            Cada pedido tiene 2 intentos de entrega sin cargo. Al tercer intento fallido, el pedido pasa a estado
            "Devolución" y se descuenta el valor del flete de tu saldo.
          </p>
        </div>
      </div>

      {/* Lista de devoluciones */}
      {loading ? (
        <div
          className="flex items-center justify-center py-12"
          /*
            FIX: el spinner no tenía texto accesible — los lectores de pantalla
            no anunciaban que se estaba cargando contenido.
          */
          role="status"
          aria-label="Cargando devoluciones..."
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : devolucionesPedidos.length === 0 ? (
        <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 mx-auto mb-3">
            <Package className="h-6 w-6 text-green-600" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-green-700">¡Sin devoluciones!</h3>
          <p className="text-sm text-green-600 mt-1">No tienes pedidos devueltos. ¡Excelente trabajo!</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedItems.map((pedido, index) => {
              const costoDevolucion = getCostoDevolucion(pedido);

              return (
                <motion.div
                  key={pedido.id}
                  className="rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  /*
                    FIX: delay de animación escalonado condicionado a
                    `prefers-reduced-motion`. Con muchos items y motion
                    activo, el stagger puede llegar a medio segundo de espera.
                  */
                  transition={{ delay: prefersReducedMotion ? 0 : index * 0.05 }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Información del pedido */}
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {pedido.numero_guia ?? `#${pedido.id}`}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Devuelto
                        </span>
                        {/*
                          FIX: `pedido.intentos_entrega && ...` — si
                          `intentos_entrega` es `0` (falsy), el badge se
                          ocultaba aunque existiera el campo. Cambiado a
                          verificación de tipo explícita.
                        */}
                        {typeof pedido.intentos_entrega === "number" && pedido.intentos_entrega >= 2 && (
                          <span className="text-xs text-muted-foreground">({pedido.intentos_entrega} intentos)</span>
                        )}
                      </div>

                      <p className="text-sm text-foreground font-medium truncate">
                        {pedido.cliente_nombre ?? "Sin destinatario"}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{pedido.direccion_entrega ?? "Sin dirección"}</span>
                        {pedido.zona && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-xs flex-shrink-0">
                            {pedido.zona}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        <span>{formatDate(pedido.fecha_creacion)}</span>
                      </div>
                    </div>

                    {/* Costo y estado de cobro */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Costo de Devolución</p>
                        {/*
                          FIX: `costoDevolucion` precalculado con `??` en lugar
                          de `||`. Si `costo_devolucion` es 0, ahora se muestra
                          "$0" en lugar de caer al fallback de `valor_flete`.
                        */}
                        <p className="text-lg font-bold text-destructive">-{formatCOP(costoDevolucion)}</p>
                      </div>
                      {pedido.devolucion_cobrada ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold whitespace-nowrap">
                          <DollarSign className="h-3 w-3" aria-hidden="true" />
                          Descontado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold whitespace-nowrap">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={goToPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </>
      )}
    </motion.div>
  );
};

export default DevolucionesView;

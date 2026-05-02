import { useState, useMemo, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Package,
  Edit,
  Printer,
  Clock,
  Box,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Truck,
  
  MessageSquare,
  Search,
  MapPin,
  DollarSign,
  Calendar,
  Filter,
  X,
  Camera,
  FileText,
} from "lucide-react";

import PedidosSkeleton from "./PedidosSkeleton";
import ManifiestoModal from "./ManifiestoModal";
import PendienteConfirmacionPanel from "./PendienteConfirmacionPanel";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/tarifas";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import StatusChipCarousel from "@/components/StatusChipCarousel";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ─── Constantes ───────────────────────────────────────────────────────────────

const FLETE_DEFAULT = 12000;

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/*
  FIX: `getStatusInfo`, `canEditOrder`, `isDelivered`, `getNetProfit`
  movidas fuera del componente. Eran funciones puras sin dependencias del
  scope recreadas en cada render y en cada iteración de la lista de pedidos.
*/
const getStatusInfo = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case "recibido":
    case "pedido recibido":
    case "recibido en bodega":
      return { label: "En Bodega", color: "bg-primary", textColor: "text-primary-foreground", icon: Box };
    case "pendiente":
      return { label: "Pendiente", color: "bg-amber-500", textColor: "text-white", icon: Clock };
    case "asignado":
      return { label: "Asignado", color: "bg-purple-500", textColor: "text-white", icon: Truck };
    case "en ruta":
    case "en camino":
      return { label: "En Ruta", color: "bg-primary", textColor: "text-primary-foreground", icon: Truck };
    case "entregado":
      return { label: "Entregado", color: "bg-green-500", textColor: "text-white", icon: CheckCircle2 };
    case "cancelado":
    case "anulado":
      return { label: "Cancelado", color: "bg-destructive", textColor: "text-destructive-foreground", icon: XCircle };
    case "novedad":
      return { label: "Novedad", color: "bg-orange-500", textColor: "text-white", icon: AlertTriangle };
    case "liquidado":
      return { label: "Liquidado", color: "bg-emerald-600", textColor: "text-white", icon: CheckCircle2 };
    case "devolución":
    case "devolucion":
      return { label: "Devolución", color: "bg-red-500", textColor: "text-white", icon: XCircle };
    default:
      return { label: status || "Pendiente", color: "bg-muted", textColor: "text-muted-foreground", icon: Package };
  }
};

const canEditOrder = (status: string | null) => status?.toLowerCase() === "pendiente";
const isDelivered = (status: string | null) =>
  status?.toLowerCase() === "entregado" || status?.toLowerCase() === "liquidado";

/*
  FIX: `||` → `??` en cálculos financieros.
  Mismo bug crítico que en DevolucionesView y NovedadesView.
  `valor_flete || 12000` trata `0` (pedido exonerado) como "sin flete".
  El `try/catch` original era falsa seguridad alrededor de un bug, no
  de una excepción real. Eliminado.
*/
const getNetProfit = (pedido: Pedido): number => {
  if (pedido.metodo_pago === "anticipado") return 0;
  if (pedido.utilidad !== null && pedido.utilidad !== undefined) return pedido.utilidad;
  const flete = pedido.valor_flete ?? FLETE_DEFAULT;
  return (pedido.valor_recaudar ?? 0) - flete;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  observaciones?: string | null;
  integration_partner?: string | null;
}

interface PedidosViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onRespond: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
  onRefresh?: () => void;
  error?: Error | null;
  hasCache?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const PedidosView = ({
  pedidos,
  loading,
  onEdit,
  onPrint,
  onRespond,
  onViewEvidence,
  onRefresh,
  error,
  hasCache,
}: PedidosViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [showManifiestoModal, setShowManifiestoModal] = useState(false);

  const { profile } = useAuth();
  const storeName = profile?.store_name || profile?.full_name || "Mi Tienda";

  const prefersReducedMotion = useReducedMotion();
  const uid = useId();

  // ── IDs para labels de filtros avanzados ──────────────────────────────────

  const idMinValue = `${uid}-min`;
  const idMaxValue = `${uid}-max`;
  const idRecipient = `${uid}-recipient`;
  const idMainSearch = `${uid}-search`;

  // ── Conteo de filtros activos ──────────────────────────────────────────────

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (minValue) count++;
    if (maxValue) count++;
    if (recipientFilter.trim()) count++;
    return count;
  }, [dateFrom, dateTo, minValue, maxValue, recipientFilter]);

  const clearAdvancedFilters = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setMinValue("");
    setMaxValue("");
    setRecipientFilter("");
  }, []);

  // ── Filtrado ───────────────────────────────────────────────────────────────

  const filteredPedidos = useMemo(() => {
    let result = pedidos;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.numero_guia?.toLowerCase().includes(q) ||
          p.cliente_nombre?.toLowerCase().includes(q) ||
          p.direccion_entrega?.toLowerCase().includes(q),
      );
    }

    if (statusFilter) {
      result = result.filter((p) => p.estado?.toLowerCase() === statusFilter);
    }

    if (dateFrom || dateTo) {
      /*
        FIX: validación de rango de fechas coherente.
        Si dateFrom > dateTo el filtro producía resultados vacíos sin aviso.
        Se intercambian silenciosamente para que el rango sea siempre válido.
      */
      const from = dateFrom && dateTo && isAfter(dateFrom, dateTo) ? dateTo : dateFrom;
      const to = dateFrom && dateTo && isAfter(dateFrom, dateTo) ? dateFrom : dateTo;

      result = result.filter((p) => {
        if (!p.fecha_creacion) return false;
        try {
          const orderDate = parseISO(p.fecha_creacion);
          if (from && to) return isWithinInterval(orderDate, { start: startOfDay(from), end: endOfDay(to) });
          if (from) return !isBefore(orderDate, startOfDay(from));
          if (to) return !isAfter(orderDate, endOfDay(to));
        } catch {
          return false;
        }
        return true;
      });
    }

    if (minValue || maxValue) {
      const min = minValue ? parseFloat(minValue) : 0;
      const max = maxValue ? parseFloat(maxValue) : Infinity;
      // FIX: ignorar si los valores no son números válidos
      if (!isNaN(min) && !isNaN(max)) {
        result = result.filter((p) => {
          const valor = p.valor_recaudar ?? 0;
          return valor >= min && valor <= max;
        });
      }
    }

    if (recipientFilter.trim()) {
      const q = recipientFilter.toLowerCase();
      result = result.filter((p) => p.cliente_nombre?.toLowerCase().includes(q));
    }

    return result;
  }, [pedidos, searchQuery, statusFilter, dateFrom, dateTo, minValue, maxValue, recipientFilter]);

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
  } = usePagination({ items: filteredPedidos, itemsPerPage: 50 });

  // ── Conteos de estado para el carrusel ────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pedidos.forEach((p) => {
      const status = p.estado?.toLowerCase() || "pendiente";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [pedidos]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30 flex-shrink-0">
          <Package className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground">Mis Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? "s" : ""} encontrado
            {filteredPedidos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowManifiestoModal(true)}
          className="gap-2 hidden sm:inline-flex"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Generar Manifiesto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowManifiestoModal(true)}
          className="sm:hidden"
          aria-label="Generar Manifiesto de Recogida"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda principal */}
          <div className="relative flex-1">
            {/* FIX: label accesible para el input de búsqueda */}
            <label htmlFor={idMainSearch} className="sr-only">
              Buscar pedidos por guía, cliente o dirección
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={idMainSearch}
              type="search"
              placeholder="Buscar por guía, cliente o dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>

          {/* Toggle filtros avanzados */}
          <Button
            type="button"
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2"
            aria-expanded={showAdvancedFilters}
            aria-controls={`${uid}-advanced-filters`}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros
            {activeFiltersCount > 0 && (
              <span
                className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-primary text-xs font-bold"
                aria-label={`${activeFiltersCount} filtros activos`}
              >
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Carrusel de estado */}
        <StatusChipCarousel
          statusCounts={statusCounts}
          selectedStatus={statusFilter}
          onStatusSelect={setStatusFilter}
          totalCount={pedidos.length}
        />

        {/* Panel de filtros avanzados */}
        {/*
          FIX: `exit` animation requiere `AnimatePresence` como padre.
          La versión original tenía `exit={{ opacity: 0, height: 0 }}` pero
          sin `AnimatePresence` la animación de salida nunca se ejecutaba —
          el panel desaparecía abruptamente.
        */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              id={`${uid}-advanced-filters`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Filtros Avanzados</h4>
                  {activeFiltersCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAdvancedFilters}
                      className="h-7 text-xs gap-1"
                      aria-label="Limpiar todos los filtros avanzados"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Limpiar
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Fecha desde */}
                  <div className="space-y-1.5">
                    {/* FIX: labels con htmlFor asociado al trigger del Popover */}
                    <label id={`${uid}-from-label`} className="text-xs font-medium text-muted-foreground">
                      Desde
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          aria-labelledby={`${uid}-from-label`}
                          className={cn(
                            "w-full justify-start text-left font-normal h-9",
                            !dateFrom && "text-muted-foreground",
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                          {dateFrom ? format(dateFrom, "dd MMM yyyy", { locale: es }) : "Fecha inicio"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          locale={es}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Fecha hasta */}
                  <div className="space-y-1.5">
                    <label id={`${uid}-to-label`} className="text-xs font-medium text-muted-foreground">
                      Hasta
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          aria-labelledby={`${uid}-to-label`}
                          className={cn(
                            "w-full justify-start text-left font-normal h-9",
                            !dateTo && "text-muted-foreground",
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                          {dateTo ? format(dateTo, "dd MMM yyyy", { locale: es }) : "Fecha fin"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                          locale={es}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Valor mínimo */}
                  <div className="space-y-1.5">
                    {/* FIX: labels con htmlFor → id */}
                    <label htmlFor={idMinValue} className="text-xs font-medium text-muted-foreground">
                      Valor Mínimo
                    </label>
                    <div className="relative">
                      <DollarSign
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id={idMinValue}
                        type="number"
                        min={0}
                        placeholder="0"
                        value={minValue}
                        onChange={(e) => setMinValue(e.target.value)}
                        className="pl-8 h-9"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  {/* Valor máximo */}
                  <div className="space-y-1.5">
                    <label htmlFor={idMaxValue} className="text-xs font-medium text-muted-foreground">
                      Valor Máximo
                    </label>
                    <div className="relative">
                      <DollarSign
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id={idMaxValue}
                        type="number"
                        min={0}
                        placeholder="Sin límite"
                        value={maxValue}
                        onChange={(e) => setMaxValue(e.target.value)}
                        className="pl-8 h-9"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>

                {/* Filtro por destinatario */}
                <div className="space-y-1.5">
                  <label htmlFor={idRecipient} className="text-xs font-medium text-muted-foreground">
                    Nombre del Destinatario
                  </label>
                  <div className="relative max-w-md">
                    <Search
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id={idRecipient}
                      type="search"
                      placeholder="Buscar por nombre..."
                      value={recipientFilter}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="pl-8 h-9"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Banner de datos en caché */}
      {error && hasCache && pedidos.length > 0 && (
        <div
          className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Mostrando datos guardados. Presiona "Sincronizar" para actualizar.</span>
        </div>
      )}

      {/* Estados de carga / error / vacío / contenido */}
      {loading && pedidos.length === 0 ? (
        /*
          FIX: spinner de carga redundante eliminado.
          La versión original mostraba DOS indicadores de carga en el estado
          inicial: un spinner animado con texto Y el PedidosSkeleton debajo.
          PedidosSkeleton ya tiene `role="status"` con el mensaje accesible —
          el spinner adicional era ruido visual. Solo se usa el skeleton.
        */
        <PedidosSkeleton />
      ) : error && pedidos.length === 0 ? (
        <div className="rounded-2xl neu-flat p-8 text-center" role="alert">
          <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
          <p className="mt-4 font-semibold text-foreground">Error de conexión</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No se pudieron cargar tus pedidos. Verifica tu conexión y presiona "Sincronizar".
          </p>
        </div>
      ) : totalItems === 0 ? (
        <div className="rounded-2xl neu-flat p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">
            {searchQuery || statusFilter || activeFiltersCount > 0
              ? "No se encontraron pedidos con estos filtros"
              : "No tienes pedidos registrados desde el 1 de Enero 2025"}
          </p>
        </div>
      ) : (
        <>
          {/* Grid de alta densidad — Enterprise micro-cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {paginatedItems.map((pedido, index) => {
              const statusInfo = getStatusInfo(pedido.estado);
              const StatusIcon = statusInfo.icon;
              const isEditable = canEditOrder(pedido.estado);
              const isNovedad = pedido.estado?.toLowerCase() === "novedad";
              const isDeliveredPedido = isDelivered(pedido.estado);
              const hasEvidence = !!pedido.foto_evidencia;
              const netProfit = getNetProfit(pedido);
              const locationLine = [pedido.barrio, pedido.municipio].filter(Boolean).join(", ") || "Sin ubicación";

              return (
                <motion.div
                  key={pedido.id}
                  className={`neu-flat overflow-hidden rounded-xl flex flex-col transition-all duration-200 hover:neu-elevated hover:-translate-y-0.5 ${
                    isNovedad ? "ring-2 ring-orange-400/50" : ""
                  }`}
                  initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : Math.min(index * 0.015, 0.3) }}
                >
                  {/* Header ultra-compacto: ID + Badge */}
                  <div className="px-3 pt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground truncate" title={pedido.numero_guia || `#${pedido.id}`}>
                      {pedido.numero_guia || `#${pedido.id}`}
                    </span>
                    <div
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${statusInfo.color} ${statusInfo.textColor} flex-shrink-0`}
                      role="status"
                      aria-label={`Estado: ${statusInfo.label}`}
                    >
                      <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
                      <span className="text-[10px] font-semibold leading-none">{statusInfo.label}</span>
                    </div>
                  </div>

                  {/* Body compacto */}
                  <div className="p-3 pt-2 space-y-2 flex-1 flex flex-col">
                    {/* Cliente + ubicación */}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate" title={pedido.cliente_nombre || ""}>
                        {pedido.cliente_nombre || "Sin destinatario"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1" title={locationLine}>
                        <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{locationLine}</span>
                      </p>
                    </div>

                    {/* Bloque de Producto */}
                    <div className="flex items-center gap-2 bg-muted/50 dark:bg-muted/30 rounded p-1.5">
                      <div className="w-8 h-8 rounded bg-background flex items-center justify-center flex-shrink-0 border border-border/50">
                        <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate" title={pedido.producto_nombre || ""}>
                          {pedido.producto_nombre || "Sin producto"}
                        </p>
                      </div>
                    </div>

                    {/* Bloque Financiero — una línea */}
                    {pedido.metodo_pago === "anticipado" ? (
                      <div className="flex items-center justify-center py-1">
                        <span className="bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ✓ PAGADO ANTICIPADO
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">Recaudo</p>
                          <p className="text-sm font-bold text-foreground truncate">
                            {formatCOP(pedido.valor_recaudar ?? 0)}
                          </p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">Utilidad</p>
                          <p className={`text-sm font-bold truncate ${netProfit > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {formatCOP(netProfit)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alerta de novedad — compacta */}
                    {isNovedad && pedido.tipo_novedad && (
                      <div
                        className="rounded bg-orange-500/10 border border-orange-500/20 px-2 py-1 flex items-center gap-1"
                        role="alert"
                      >
                        <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" aria-hidden="true" />
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium truncate">{pedido.tipo_novedad}</p>
                      </div>
                    )}

                    {/* Spacer para empujar acciones al fondo */}
                    <div className="flex-1" />

                    {/* Acciones — fila compacta */}
                    <div className="flex gap-1.5 pt-1">
                      {isNovedad ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 h-7 px-2 gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                            onClick={() => onRespond(pedido)}
                            aria-label={`Responder novedad ${pedido.numero_guia ?? `#${pedido.id}`}`}
                          >
                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
                            Responder
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => onPrint(pedido)}
                            aria-label={`Imprimir guía ${pedido.numero_guia ?? `#${pedido.id}`}`}
                          >
                            <Printer className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {isEditable && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => onEdit(pedido)}
                              aria-label={`Editar pedido ${pedido.numero_guia ?? `#${pedido.id}`}`}
                            >
                              <Edit className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          )}
                          {hasEvidence && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`h-7 w-7 p-0 flex-shrink-0 ${isDeliveredPedido ? "border-green-500/40 text-green-700 hover:bg-green-500/10 dark:text-green-400" : ""}`}
                              onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                              aria-label={`Ver evidencia ${pedido.numero_guia ?? `#${pedido.id}`}`}
                            >
                              <Camera className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="flex-1 h-7 px-2 gap-1 text-xs"
                            onClick={() => onPrint(pedido)}
                            aria-label={`Imprimir guía ${pedido.numero_guia ?? `#${pedido.id}`}`}
                          >
                            <Printer className="h-3 w-3" aria-hidden="true" />
                            Guía
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Paginación — siempre visible cuando hay resultados */}
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
        </>
      )}

      <ManifiestoModal
        open={showManifiestoModal}
        onClose={() => setShowManifiestoModal(false)}
        pedidos={pedidos}
        storeName={storeName}
      />
    </motion.div>
  );
};

export default PedidosView;

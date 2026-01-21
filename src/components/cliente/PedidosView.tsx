import { motion } from "framer-motion";
import {
  Package,
  Loader2,
  Edit,
  Printer,
  Clock,
  Box,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Truck,
  Image,
  MessageSquare,
  Search,
  MapPin,
  DollarSign,
  TrendingUp,
  Calendar,
  Filter,
  X,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { formatCOP } from "@/lib/tarifas";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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

interface PedidosViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onRespond: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
}

const PedidosView = ({
  pedidos,
  loading,
  onEdit,
  onPrint,
  onRespond,
  onViewEvidence,
}: PedidosViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");

  const getStatusInfo = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "recibido":
      case "pedido recibido":
      case "recibido en bodega":
        return { label: "En Bodega", color: "bg-blue-500", textColor: "text-white", icon: Box };
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
  const isDelivered = (status: string | null) => status?.toLowerCase() === "entregado" || status?.toLowerCase() === "liquidado";
  
  const getNetProfit = (pedido: Pedido) => {
    if (pedido.metodo_pago === "anticipado") return 0;
    if (pedido.utilidad !== null && pedido.utilidad !== undefined) {
      return pedido.utilidad;
    }
    const flete = pedido.valor_flete || 12000;
    return (pedido.valor_recaudar || 0) - flete;
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (minValue) count++;
    if (maxValue) count++;
    if (recipientFilter.trim()) count++;
    return count;
  }, [dateFrom, dateTo, minValue, maxValue, recipientFilter]);

  // Clear all advanced filters
  const clearAdvancedFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setMinValue("");
    setMaxValue("");
    setRecipientFilter("");
  };

  const filteredPedidos = useMemo(() => {
    let result = pedidos;
    
    // Basic search (guía, nombre, dirección)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.numero_guia?.toLowerCase().includes(q) ||
          p.cliente_nombre?.toLowerCase().includes(q) ||
          p.direccion_entrega?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.estado?.toLowerCase() === statusFilter);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      result = result.filter((p) => {
        if (!p.fecha_creacion) return false;
        const orderDate = parseISO(p.fecha_creacion);
        
        if (dateFrom && dateTo) {
          return isWithinInterval(orderDate, {
            start: startOfDay(dateFrom),
            end: endOfDay(dateTo)
          });
        } else if (dateFrom) {
          return orderDate >= startOfDay(dateFrom);
        } else if (dateTo) {
          return orderDate <= endOfDay(dateTo);
        }
        return true;
      });
    }

    // Value range filter
    if (minValue || maxValue) {
      const min = minValue ? parseFloat(minValue) : 0;
      const max = maxValue ? parseFloat(maxValue) : Infinity;
      result = result.filter((p) => {
        const valor = p.valor_recaudar || 0;
        return valor >= min && valor <= max;
      });
    }

    // Recipient name filter
    if (recipientFilter.trim()) {
      const q = recipientFilter.toLowerCase();
      result = result.filter((p) => 
        p.cliente_nombre?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pedidos, searchQuery, statusFilter, dateFrom, dateTo, minValue, maxValue, recipientFilter]);

  // Pagination
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
  } = usePagination({ items: filteredPedidos, itemsPerPage: 10 });

  const statusOptions = [
    { value: null, label: "Todos" },
    { value: "pendiente", label: "Pendiente" },
    { value: "recibido en bodega", label: "En Bodega" },
    { value: "en ruta", label: "En Ruta" },
    { value: "entregado", label: "Entregado" },
    { value: "novedad", label: "Novedad" },
    { value: "devolución", label: "Devolución" },
    { value: "liquidado", label: "Liquidado" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Mis Pedidos</h2>
          <p className="text-sm text-muted-foreground">{filteredPedidos.length} pedidos encontrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Main search + toggle filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por guía, cliente o dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-primary text-xs font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Status filter buttons */}
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-muted/50 border border-border p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Filtros Avanzados</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="h-7 text-xs gap-1">
                  <X className="h-3 w-3" />
                  Limpiar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd MMM yyyy", { locale: es }) : "Fecha inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd MMM yyyy", { locale: es }) : "Fecha fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Value Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor Mínimo</label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor Máximo</label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Sin límite"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Recipient Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre del Destinatario</label>
              <div className="relative max-w-md">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : totalItems === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {searchQuery || statusFilter || activeFiltersCount > 0 ? "No se encontraron pedidos con estos filtros" : "No tienes pedidos registrados"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedItems.map((pedido, index) => {
              const statusInfo = getStatusInfo(pedido.estado);
              const StatusIcon = statusInfo.icon;
              const isEditable = canEditOrder(pedido.estado);
              const isNovedad = pedido.estado?.toLowerCase() === "novedad";
              const hasDeliveryEvidence = isDelivered(pedido.estado) && pedido.foto_evidencia;
              const netProfit = getNetProfit(pedido);

              return (
                <motion.div
                  key={pedido.id}
                  className={`rounded-2xl bg-card border overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${
                    isNovedad 
                      ? "border-orange-300 shadow-lg shadow-orange-500/10" 
                      : "border-border shadow-md shadow-black/5"
                  }`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {/* Card Header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-muted/30">
                    <span className="text-sm font-bold text-foreground">
                      {pedido.numero_guia || `#${pedido.id}`}
                    </span>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusInfo.color} ${statusInfo.textColor}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{statusInfo.label}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Recipient */}
                    <div>
                      <p className="font-bold text-foreground text-base truncate">
                        {pedido.cliente_nombre || "Sin destinatario"}
                      </p>
                      <div className="flex items-start gap-1.5 mt-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {pedido.direccion_entrega || "Sin dirección"}
                          {pedido.barrio && ` - ${pedido.barrio}`}
                        </p>
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-muted/50">
                      {pedido.metodo_pago === "anticipado" ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="bg-primary/15 text-primary text-xs font-bold px-3 py-1 rounded-full">
                            ✓ PAGADO
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recaudar</p>
                              <p className="text-sm font-bold text-green-600">
                                {formatCOP(pedido.valor_recaudar || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div className="flex-1 flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${netProfit > 0 ? 'bg-emerald-500/15' : 'bg-destructive/15'}`}>
                              <TrendingUp className={`h-4 w-4 ${netProfit > 0 ? 'text-emerald-600' : 'text-destructive'}`} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Utilidad</p>
                              <p className={`text-sm font-bold ${netProfit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                {formatCOP(netProfit)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Delivery Evidence Button - Only for delivered orders */}
                    {hasDeliveryEvidence && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 bg-green-500/10 border-green-500/30 text-green-700 hover:bg-green-500/20"
                        onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                      >
                        <Camera className="h-4 w-4" />
                        Ver Foto de Entrega
                      </Button>
                    )}

                    {/* Evidence Thumbnail for non-delivered */}
                    {pedido.foto_evidencia && !isDelivered(pedido.estado) && (
                      <button
                        onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                        className="w-full rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-colors group relative h-24"
                      >
                        <img
                          src={pedido.foto_evidencia}
                          alt="Evidencia"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Image className="h-6 w-6 text-white" />
                        </div>
                      </button>
                    )}

                    {/* Novedad Alert */}
                    {isNovedad && pedido.tipo_novedad && (
                      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <p className="text-xs text-orange-600 font-medium flex-1">{pedido.tipo_novedad}</p>
                      </div>
                    )}
                  </div>

                  {/* Card Footer - Actions */}
                  <div className="px-4 pb-4 pt-0 flex gap-2">
                    {isNovedad ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 h-10 gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => onRespond(pedido)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Responder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 px-4"
                          onClick={() => onPrint(pedido)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {isEditable && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-10 gap-2"
                            onClick={() => onEdit(pedido)}
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isEditable ? "secondary" : "outline"}
                          className={`h-10 gap-2 ${isEditable ? '' : 'flex-1'}`}
                          onClick={() => onPrint(pedido)}
                        >
                          <Printer className="h-4 w-4" />
                          Guía
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination Controls */}
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

export default PedidosView;

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Loader2,
  LogOut,
  Search,
  Eye,
  Printer,
  Store,
  User,
  ArrowLeftRight,
  Ban,
  CalendarCheck,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PedidoDetailModal from "@/components/PedidoDetailModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import BulkPrintGuiasModal from "@/components/BulkPrintGuiasModal";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { getAllZonas } from "@/lib/zonas";
import { Button } from "@/components/ui/button";
import { getStatusConfig, ALL_STATUSES, isOperationalStatus } from "@/lib/orderStatuses";
import QuickReassignPopover from "@/components/admin/QuickReassignPopover";
import BulkReassignModal from "@/components/admin/BulkReassignModal";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DeliveryDateBadge from "@/components/DeliveryDateBadge";
import FutureDateConfirmDialog from "@/components/FutureDateConfirmDialog";
import CriticalErrorBoundary from "@/components/CriticalErrorBoundary";
import {
  isFutureDeliveryDate,
  isTodayOrPastDeliveryDate,
  compareDeliveryDates,
} from "@/lib/dateUtils";

// --- Emergency kill-switch (temporary) ---
const EMERGENCY_DISABLE_DATE_FILTER_UI = true;
// Stop Realtime traffic while Supabase is under pressure (temporary)
const EMERGENCY_DISABLE_REALTIME = true;

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
  municipio?: string | null;
  zona: string | null;
  tipo_novedad: string | null;
  foto_evidencia: string | null;
  foto_paquete: string | null;
  firma_cliente: string | null;
  fecha_actualizacion: string | null;
  client_phone: string | null;
  client_user_id: string | null;
  guia_impresa?: boolean | null;
  guia_impresa_at?: string | null;
  observaciones?: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  store_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean;
}

const DespachadorDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"despacho" | "perfil">("despacho");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [zonaFilter, setZonaFilter] = useState<string>("todos");
  const [storeFilter, setStoreFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [todayOnlyFilter, setTodayOnlyFilter] = useState(false); // New "Ver solo para hoy" filter
  const [searchQuery, setSearchQuery] = useState("");
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, { store_name: string | null; full_name: string }>>({});
  const [assigningPedido, setAssigningPedido] = useState<number | null>(null);
  const [selectedForBulk, setSelectedForBulk] = useState<number[]>([]);
  const [showPrintGuia, setShowPrintGuia] = useState(false);
  const [selectedPedidoForPrint, setSelectedPedidoForPrint] = useState<Pedido | null>(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPedidoForDetail, setSelectedPedidoForDetail] = useState<Pedido | null>(null);
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  // Future date confirmation dialog state
  const [showFutureDateConfirm, setShowFutureDateConfirm] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ pedidoId: number; motorizadoUserId: string; pedido: Pedido } | null>(null);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  // Guards to avoid request storms / setState after unmount
  const pedidosFetchInFlight = useRef(false);
  const isMountedRef = useRef(true);

  const pagination = usePagination({ items: filteredPedidos, itemsPerPage: 10 });

  useEffect(() => {
    isMountedRef.current = true;

    fetchPedidos();
    fetchMotorizados();
    fetchClientProfiles();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Emergency: ensure disabled filters can't get stuck enabled
  useEffect(() => {
    if (!EMERGENCY_DISABLE_DATE_FILTER_UI) return;
    setDateFilter("");
    setTodayOnlyFilter(false);
  }, []);

  const normalizePedido = useCallback((p: Pedido): Pedido => {
    return {
      ...p,
      numero_guia: p.numero_guia ?? null,
      cliente_nombre: p.cliente_nombre ?? "—",
      direccion_entrega: p.direccion_entrega ?? "—",
      zona: p.zona ?? "—",
      barrio: p.barrio ?? "—",
      fecha_entrega: p.fecha_entrega ?? null,
    };
  }, []);

  // Real-time subscription for pedidos changes
  useEffect(() => {
    if (EMERGENCY_DISABLE_REALTIME) return;

    const channel = supabase
      .channel('despachador-pedidos')
      // Only listen for INSERTs to reduce traffic/CPU; updates are reflected on manual refresh or local optimistic updates.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, (payload) => {
        const next = normalizePedido(payload.new as Pedido);
        setPedidos((prev) => [next, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Listen for real-time reassignment notifications from motorizados
  useEffect(() => {
    if (EMERGENCY_DISABLE_REALTIME) return;

    const notificationChannel = supabase
      .channel('admin-notifications')
      .on('broadcast', { event: 'order-reassigned' }, (payload) => {
        const data = payload.payload as {
          pedido_id: number;
          numero_guia: string | null;
          previous_motorizado: string;
          new_motorizado: string;
          timestamp: string;
        };
        
        // Show toast notification
        toast.info(`🔄 Reasignación por escaneo`, {
          description: `Guía ${data.numero_guia || `#${data.pedido_id}`}: ${data.previous_motorizado} → ${data.new_motorizado}`,
          duration: 8000,
        });
        
        console.log("📡 Notificación de reasignación recibida:", data);
      })
      .subscribe();

    return () => { supabase.removeChannel(notificationChannel); };
  }, []);

  // Memoized filter function to prevent unnecessary re-renders
  const filterPedidos = useCallback(() => {
    try {
      let filtered = [...pedidos];

      if (statusFilter === "sin_asignar") {
        filtered = filtered.filter((p) => !p.motorizado_asignado && isOperationalStatus(p.estado));
      } else if (statusFilter === "anulado") {
        filtered = filtered.filter((p) => p.estado?.toLowerCase() === "anulado");
      } else if (statusFilter !== "todos") {
        filtered = filtered.filter((p) => p.estado?.toLowerCase() === statusFilter.toLowerCase());
      } else {
        filtered = filtered.filter((p) => isOperationalStatus(p.estado));
      }

      if (zonaFilter !== "todos") {
        filtered = filtered.filter((p) => p.zona === zonaFilter);
      }

      if (storeFilter !== "todos") {
        filtered = filtered.filter((p) => {
          if (!p.client_user_id) return false;
          const prof = clientProfiles[p.client_user_id];
          return (prof?.store_name || prof?.full_name || "") === storeFilter;
        });
      }

      if (dateFilter) {
        filtered = filtered.filter((p) => {
          if (!p.fecha_creacion) return false;
          // Compare only YYYY-MM-DD (ignore time + avoid UTC shifting)
          const dateOnly = p.fecha_creacion.includes("T")
            ? p.fecha_creacion.split("T")[0]
            : p.fecha_creacion;
          return dateOnly === dateFilter;
        });
      }

      // Filter for "Ver solo para hoy"
      if (todayOnlyFilter) {
        filtered = filtered.filter((p) => isTodayOrPastDeliveryDate(p.fecha_entrega));
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((p) =>
          p.numero_guia?.toLowerCase().includes(q) ||
          p.cliente_nombre?.toLowerCase().includes(q) ||
          p.motorizado_asignado?.toLowerCase().includes(q) ||
          p.barrio?.toLowerCase().includes(q) ||
          p.zona?.toLowerCase().includes(q)
        );
      }

      // Sort by fecha_entrega ascending (nearest first) using centralized utility
      filtered.sort((a, b) => compareDeliveryDates(a.fecha_entrega, b.fecha_entrega));

      setFilteredPedidos(filtered);
    } catch (error) {
      console.error("Error filtering pedidos:", error);
      setFilteredPedidos([]);
    }
  }, [pedidos, statusFilter, zonaFilter, storeFilter, dateFilter, todayOnlyFilter, searchQuery, clientProfiles]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterPedidos();
  }, [filterPedidos]);

  /**
   * EMERGENCY PERFORMANCE MODE
   * - Keep initial load ultra-light (no complex filters on load; those run client-side)
   * - Fetch only the first 20 most recent orders
   * - Select minimal columns needed to render the table without breaking UI
   */
  const PEDIDO_COLUMNS = `
    id,
    numero_guia,
    cliente_nombre,
    direccion_entrega,
    estado,
    fecha_creacion,
    fecha_entrega,
    motorizado_asignado,
    motorizado_id,
    barrio,
    zona,
    municipio,
    metodo_pago,
    valor_recaudar,
    client_phone,
    client_user_id,
    guia_impresa,
    guia_impresa_at,
    tipo_novedad
  `;

  const fetchPedidos = useCallback(async () => {
    if (pedidosFetchInFlight.current) return;
    pedidosFetchInFlight.current = true;
    if (isMountedRef.current) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(PEDIDO_COLUMNS)
        .order("fecha_creacion", { ascending: false })
        .limit(20);

      if (error) throw error;
      const normalized = (data || []).map((p) => normalizePedido(p as Pedido));
      if (isMountedRef.current) setPedidos(normalized);
    } catch (error: any) {
      console.error("Error fetching pedidos:", error);
      if (error?.code === "57014") {
        toast.error("La consulta tardó demasiado. Usa el botón Refrescar.");
      } else {
        toast.error("Error al cargar los pedidos");
      }
      // Never block rendering: keep previous data if any, otherwise show empty state.
      if (isMountedRef.current && pedidos.length === 0) {
        setPedidos([]);
      }
    } finally {
      pedidosFetchInFlight.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, [normalizePedido, pedidos.length]);

  const fetchMotorizados = async () => {
    try {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "motorizado");
      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", roles.map((r) => r.user_id)).eq("status", "activo");
        setMotorizados(profiles || []);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  };

  const fetchClientProfiles = async () => {
    try {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "cliente");
      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, store_name, full_name").in("user_id", roles.map((r) => r.user_id));
        if (profiles) {
          const map: Record<string, { store_name: string | null; full_name: string }> = {};
          profiles.forEach((p) => { map[p.user_id] = { store_name: p.store_name, full_name: p.full_name }; });
          setClientProfiles(map);
        }
      }
    } catch (error) {
      console.error("Error fetching client profiles:", error);
    }
  };

  // Initiate assignment - check for future date first
  const initiateAssignMotorizado = (pedidoId: number, motorizadoUserId: string) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    if (isFutureDeliveryDate(pedido.fecha_entrega)) {
      setPendingAssignment({ pedidoId, motorizadoUserId, pedido });
      setShowFutureDateConfirm(true);
    } else {
      assignMotorizado(pedidoId, motorizadoUserId);
    }
  };

  // Actual assignment function
  const assignMotorizado = async (pedidoId: number, motorizadoUserId: string) => {
    const motorizado = motorizados.find(m => m.user_id === motorizadoUserId);
    if (!motorizado) {
      toast.error("Motorizado no encontrado");
      return;
    }

    setAssigningPedido(pedidoId);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_asignado: motorizado.full_name,
          motorizado_id: motorizadoUserId,
          estado: "Asignado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? { ...p, motorizado_asignado: motorizado.full_name, motorizado_id: motorizadoUserId, estado: "Asignado" }
            : p
        )
      );

      toast.success(`Pedido asignado a ${motorizado.full_name}`);
    } catch (error) {
      console.error("Error assigning motorizado:", error);
      toast.error("Error al asignar motorizado");
    } finally {
      setAssigningPedido(null);
    }
  };

  const handleFutureDateConfirm = () => {
    if (pendingAssignment) {
      assignMotorizado(pendingAssignment.pedidoId, pendingAssignment.motorizadoUserId);
    }
    setShowFutureDateConfirm(false);
    setPendingAssignment(null);
  };

  const handleFutureDateCancel = () => {
    setShowFutureDateConfirm(false);
    setPendingAssignment(null);
  };

  const toggleBulkSelect = (pedidoId: number) => {
    setSelectedForBulk((prev) => prev.includes(pedidoId) ? prev.filter((id) => id !== pedidoId) : [...prev, pedidoId]);
  };

  /**
   * Optimistic update callback for QuickReassignPopover.
   * Updates local state instantly without refetching.
   */
  const handleOptimisticPedidoUpdate = useCallback(
    (
      pedidoId: number,
      updates: { motorizado_id: string | null; motorizado_asignado: string | null; estado: string }
    ) => {
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? { ...p, ...updates, fecha_actualizacion: new Date().toISOString() }
            : p
        )
      );
    },
    []
  );

  // Allow reprinting for any order except cancelled
  const canReprintGuia = (pedido: Pedido) => {
    const estado = pedido.estado?.toLowerCase();
    return estado !== "anulado";
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getStoreName = (clientUserId: string | null) => {
    if (!clientUserId) return "—";
    const prof = clientProfiles[clientUserId];
    return prof?.store_name || prof?.full_name || "—";
  };

  // Build remitentes map for bulk print
  const remitentesMap: Record<string, string> = {};
  Object.entries(clientProfiles).forEach(([userId, data]) => {
    remitentesMap[userId] = data.store_name || data.full_name;
  });

  const uniqueStores = Array.from(new Set(Object.values(clientProfiles).map((p) => p.store_name || p.full_name))).filter(Boolean);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">Despachos</h1>
              <p className="text-xs text-muted-foreground">{profile?.full_name || "Despachador"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection("despacho")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeSection === "despacho" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Package className="h-5 w-5" />
            <span className="font-medium">Despachos</span>
          </button>
          <button
            onClick={() => setActiveSection("perfil")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeSection === "perfil" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <User className="h-5 w-5" />
            <span className="font-medium">Mi Perfil</span>
          </button>
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {activeSection === "despacho" ? (
          <CriticalErrorBoundary
            title="Despachos"
            fallbackMessage="La tabla de despachos falló al renderizar. El panel seguirá disponible para que puedas reintentar."
          >
            <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Gestión de Despachos</h1>
                <p className="text-muted-foreground">
                  {loading ? "Cargando pedidos..." : `${filteredPedidos.length} pedidos`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => fetchPedidos()}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refrescar
                </Button>
                {selectedForBulk.length > 0 && (
                  <Button
                    onClick={() => setShowBulkReassign(true)}
                    className="gap-2"
                    variant="outline"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Reasignar ({selectedForBulk.length})
                  </Button>
                )}
                <Button
                  onClick={() => setShowBulkPrint(true)}
                  variant="outline"
                  className="gap-2"
                  disabled={selectedForBulk.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Selección {selectedForBulk.length > 0 && `(${selectedForBulk.length})`}
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border border-border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar guía, cliente, barrio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="todos">Todos los estados</option>
                <option value="sin_asignar">Sin asignar</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
              <select
                value={zonaFilter}
                onChange={(e) => setZonaFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="todos">Todas las zonas</option>
                {getAllZonas().map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="todos">Todas las tiendas</option>
                {uniqueStores.map((s) => (
                  <option key={s} value={s!}>{s}</option>
                ))}
              </select>
              {!EMERGENCY_DISABLE_DATE_FILTER_UI && (
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              )}

              <Button
                onClick={() => fetchPedidos()}
                variant="outline"
                size="sm"
                disabled={loading}
                className="gap-1.5"
                title="Actualizar"
              >
                <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
              
              {!EMERGENCY_DISABLE_DATE_FILTER_UI && (
                <button
                  onClick={() => setTodayOnlyFilter(!todayOnlyFilter)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    todayOnlyFilter
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  <CalendarCheck className="h-4 w-4" />
                  Ver solo para hoy
                </button>
              )}

              {(statusFilter !== "todos" || zonaFilter !== "todos" || storeFilter !== "todos" || (!EMERGENCY_DISABLE_DATE_FILTER_UI && (dateFilter || todayOnlyFilter))) && (
                <button 
                  onClick={() => { setStatusFilter("todos"); setZonaFilter("todos"); setStoreFilter("todos"); setDateFilter(""); setTodayOnlyFilter(false); }} 
                  className="text-sm text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Cargando…</span>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">
                        <input
                          type="checkbox"
                          checked={selectedForBulk.length === pagination.paginatedItems.length && pagination.paginatedItems.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedForBulk(pagination.paginatedItems.map((p) => p.id));
                            } else {
                              setSelectedForBulk([]);
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Guía</th>
                      <th className="px-4 py-3 text-left font-semibold">Tienda</th>
                      <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-left font-semibold">Zona</th>
                      <th className="px-4 py-3 text-left font-semibold">F. Entrega</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Motorizado</th>
                      <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagination.paginatedItems.map((pedido) => {
                      const statusConfig = getStatusConfig(pedido.estado);
                      return (
                        <tr key={pedido.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedForBulk.includes(pedido.id)}
                              onChange={() => toggleBulkSelect(pedido.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{pedido.numero_guia || `#${pedido.id}`}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium dark:bg-violet-900/30 dark:text-violet-300">
                              <Store className="h-3 w-3" />
                              {getStoreName(pedido.client_user_id)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{pedido.cliente_nombre || "—"}</td>
                          <td className="px-4 py-3">{pedido.zona || "—"}</td>
                          {/* Fecha Entrega Column */}
                          <td className="px-4 py-3">
                            <DeliveryDateBadge fechaEntrega={pedido.fecha_entrega} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", statusConfig.bgColor, statusConfig.textColor)}>
                              {statusConfig.icon} {pedido.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {pedido.motorizado_asignado ? (
                              <span className="text-sm">{pedido.motorizado_asignado}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Sin asignar</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center gap-1">
                                {/* Ver detalle */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedPedidoForDetail(pedido);
                                        setShowDetailModal(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalle</TooltipContent>
                                </Tooltip>

                                {/* Re-imprimir Guía */}
                                {canReprintGuia(pedido) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSelectedPedidoForPrint(pedido);
                                          setShowPrintGuia(true);
                                        }}
                                      >
                                        <Printer className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Re-imprimir Guía</TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Reasignar */}
                                <QuickReassignPopover
                                  pedidoId={pedido.id}
                                  currentMotorizadoId={pedido.motorizado_id}
                                  currentMotorizadoName={pedido.motorizado_asignado}
                                  currentStatus={pedido.estado}
                                  onOptimisticUpdate={handleOptimisticPedidoUpdate}
                                />

                                {/* Anulado indicator */}
                                {pedido.estado?.toLowerCase() === "anulado" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center justify-center h-8 w-8 text-destructive">
                                        <Ban className="h-4 w-4" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Pedido anulado</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredPedidos.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No hay pedidos que coincidan con los filtros
                </div>
              )}
            </div>

            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.goToPage}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
            />
            </div>
          </CriticalErrorBoundary>
        ) : (
          // Profile Section
          <div className="max-w-lg mx-auto">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{profile?.full_name || "Despachador"}</h2>
                  <p className="text-muted-foreground">{profile?.email || "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span className="font-medium">{profile?.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Rol</span>
                  <span className="font-medium text-emerald-600">Despachador</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showDetailModal && selectedPedidoForDetail && (
        <PedidoDetailModal
          isOpen={showDetailModal}
          pedido={selectedPedidoForDetail}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPedidoForDetail(null);
          }}
          remitente={selectedPedidoForDetail.client_user_id ? getStoreName(selectedPedidoForDetail.client_user_id) : undefined}
        />
      )}

      {showPrintGuia && selectedPedidoForPrint && (
        <CriticalErrorBoundary
          title="Impresión de Guía"
          fallbackMessage="La impresión de guía falló. Puedes cerrar y reintentar sin perder el acceso al panel."
          minHeightClassName="min-h-[120px]"
        >
          <PrintGuiaModal
            isOpen={showPrintGuia}
            onClose={() => {
              setShowPrintGuia(false);
              setSelectedPedidoForPrint(null);
            }}
            pedido={selectedPedidoForPrint}
            remitente={
              selectedPedidoForPrint.client_user_id
                ? getStoreName(selectedPedidoForPrint.client_user_id)
                : undefined
            }
          />
        </CriticalErrorBoundary>
      )}

      {showBulkPrint && (
        <BulkPrintGuiasModal
          isOpen={showBulkPrint}
          onClose={() => {
            setShowBulkPrint(false);
          }}
          pedidos={pedidos.filter((p) => selectedForBulk.includes(p.id) && canReprintGuia(p))}
          remitentes={remitentesMap}
          onPrintComplete={(ids) => {
            // Mark guias as printed locally (no refetch needed)
            setPedidos((prev) =>
              prev.map((p) =>
                ids.includes(p.id)
                  ? { ...p, guia_impresa: true, guia_impresa_at: new Date().toISOString() }
                  : p
              )
            );
            setSelectedForBulk([]);
          }}
        />
      )}

      {showBulkReassign && (
        <BulkReassignModal
          isOpen={showBulkReassign}
          onClose={() => setShowBulkReassign(false)}
          selectedPedidoIds={selectedForBulk}
          onOptimisticBulkUpdate={(updates) => {
            // Apply optimistic updates locally
            setPedidos((prev) =>
              prev.map((p) => {
                const upd = updates.find((u) => u.id === p.id);
                return upd ? { ...p, ...upd, fecha_actualizacion: new Date().toISOString() } : p;
              })
            );
            setSelectedForBulk([]);
          }}
        />
      )}

      {/* Future Date Confirmation Dialog */}
      <FutureDateConfirmDialog
        isOpen={showFutureDateConfirm}
        onClose={handleFutureDateCancel}
        onConfirm={handleFutureDateConfirm}
        fechaEntrega={pendingAssignment?.pedido.fecha_entrega || null}
        numeroGuia={pendingAssignment?.pedido.numero_guia}
      />
    </div>
  );
};

export default DespachadorDashboard;

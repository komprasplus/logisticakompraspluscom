import { useState, useEffect, useCallback } from "react";
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
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const pagination = usePagination({ items: filteredPedidos, itemsPerPage: 10 });

  useEffect(() => {
    fetchPedidos();
    fetchMotorizados();
    fetchClientProfiles();
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('despachador-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPedidos((prev) => [payload.new as Pedido, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setPedidos((prev) => prev.map((p) => (p.id === (payload.new as Pedido).id ? payload.new as Pedido : p)));
        } else if (payload.eventType === 'DELETE') {
          setPedidos((prev) => prev.filter((p) => p.id !== (payload.old as { id: number }).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    filterPedidos();
  }, [statusFilter, zonaFilter, storeFilter, dateFilter, searchQuery, pedidos, clientProfiles]);

  const fetchPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Error fetching pedidos:", error);
      toast.error("Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

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

  const filterPedidos = () => {
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
        return new Date(p.fecha_creacion).toISOString().split("T")[0] === dateFilter;
      });
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

    setFilteredPedidos(filtered);
  };

  const toggleBulkSelect = (pedidoId: number) => {
    setSelectedForBulk((prev) => prev.includes(pedidoId) ? prev.filter((id) => id !== pedidoId) : [...prev, pedidoId]);
  };

  const canPrintGuia = (pedido: Pedido) => {
    const estado = pedido.estado?.toLowerCase();
    return estado === "recibido en bodega" || estado === "asignado";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

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
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Gestión de Despachos</h1>
                <p className="text-muted-foreground">{filteredPedidos.length} pedidos</p>
              </div>
              <div className="flex items-center gap-2">
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
                >
                  <Printer className="h-4 w-4" />
                  Impresión Masiva
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
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
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
                            <div className="flex items-center gap-1">
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
                              <QuickReassignPopover
                                pedidoId={pedido.id}
                                currentMotorizadoId={pedido.motorizado_id}
                                currentMotorizadoName={pedido.motorizado_asignado}
                                currentStatus={pedido.estado}
                                onReassigned={fetchPedidos}
                              />
                              {canPrintGuia(pedido) && (
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
                              )}
                            </div>
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
        <PrintGuiaModal
          isOpen={showPrintGuia}
          onClose={() => {
            setShowPrintGuia(false);
            setSelectedPedidoForPrint(null);
          }}
          pedido={selectedPedidoForPrint}
          remitente={selectedPedidoForPrint.client_user_id ? getStoreName(selectedPedidoForPrint.client_user_id) : undefined}
        />
      )}

      {showBulkPrint && (
        <BulkPrintGuiasModal
          isOpen={showBulkPrint}
          onClose={() => setShowBulkPrint(false)}
          pedidos={pedidos.filter((p) => canPrintGuia(p))}
          remitentes={remitentesMap}
          onPrintComplete={(ids) => fetchPedidos()}
        />
      )}

      {showBulkReassign && (
        <BulkReassignModal
          isOpen={showBulkReassign}
          onClose={() => setShowBulkReassign(false)}
          selectedPedidoIds={selectedForBulk}
          onSuccess={() => {
            setSelectedForBulk([]);
            fetchPedidos();
          }}
        />
      )}
    </div>
  );
};

export default DespachadorDashboard;

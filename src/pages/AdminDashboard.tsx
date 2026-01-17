import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Users,
  Loader2,
  LogOut,
  UserPlus,
  UserCheck,
  Map,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Box,
  XCircle,
  Plus,
  Bell,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import AdminMap from "@/components/AdminMap";
import CreateUserModal from "@/components/CreateUserModal";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  motorizado_asignado: string | null;
  latitud: number | null;
  longitud: number | null;
  barrio: string | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

const AdminDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "map" | "users">("orders");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [barrioFilter, setBarrioFilter] = useState<string>("todos");
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [assigningPedido, setAssigningPedido] = useState<number | null>(null);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  // Fetch initial data
  useEffect(() => {
    fetchPedidos();
    fetchUsers();
    fetchMotorizados();
  }, []);

  // Real-time subscription for pedidos
  useEffect(() => {
    const channel = supabase
      .channel('pedidos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          console.log('Realtime pedido change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newPedido = payload.new as Pedido;
            setPedidos((prev) => [newPedido, ...prev]);
            setNewOrdersCount((c) => c + 1);
            
            // Show toast notification
            toast.success(
              `🔔 Nuevo pedido: ${newPedido.cliente_nombre || 'Cliente'}`,
              {
                description: newPedido.direccion_entrega || 'Sin dirección',
                duration: 5000,
              }
            );
          } else if (payload.eventType === 'UPDATE') {
            const updatedPedido = payload.new as Pedido;
            setPedidos((prev) =>
              prev.map((p) => (p.id === updatedPedido.id ? updatedPedido : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number }).id;
            setPedidos((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    filterPedidos();
  }, [statusFilter, barrioFilter, metodoPagoFilter, dateFilter, searchQuery, pedidos]);

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

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMotorizados = async () => {
    try {
      // Get all user_roles with role = 'motorizado'
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const motorizadoIds = roles.map((r) => r.user_id);
        
        // Get profiles for these users that are 'activo'
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", motorizadoIds)
          .eq("status", "activo");

        if (profilesError) throw profilesError;
        setMotorizados(profiles || []);
      } else {
        setMotorizados([]);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  };

  const filterPedidos = () => {
    let filtered = [...pedidos];

    // Status filter
    if (statusFilter === "sin_asignar") {
      filtered = filtered.filter((p) => !p.motorizado_asignado);
    } else if (statusFilter !== "todos") {
      filtered = filtered.filter(
        (p) => p.estado?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Barrio filter
    if (barrioFilter !== "todos") {
      filtered = filtered.filter((p) => p.barrio === barrioFilter);
    }

    // Método de pago filter
    if (metodoPagoFilter !== "todos") {
      filtered = filtered.filter((p) => p.metodo_pago === metodoPagoFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter((p) => {
        if (!p.fecha_creacion) return false;
        const pedidoDate = new Date(p.fecha_creacion).toISOString().split("T")[0];
        return pedidoDate === dateFilter;
      });
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.numero_guia?.toLowerCase().includes(query) ||
          p.cliente_nombre?.toLowerCase().includes(query) ||
          p.motorizado_asignado?.toLowerCase().includes(query) ||
          p.barrio?.toLowerCase().includes(query)
      );
    }

    setFilteredPedidos(filtered);
  };

  const assignMotorizado = async (pedidoId: number, motorizadoName: string) => {
    setAssigningPedido(pedidoId);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_asignado: motorizadoName,
          estado: "En Ruta",
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Update local state
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? { ...p, motorizado_asignado: motorizadoName, estado: "En Ruta" }
            : p
        )
      );

      toast.success(`Pedido asignado a ${motorizadoName}`);
    } catch (error) {
      console.error("Error assigning motorizado:", error);
      toast.error("Error al asignar motorizado");
    } finally {
      setAssigningPedido(null);
    }
  };

  const confirmUserEmail = async (userId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("No hay sesión activa");
        return;
      }

      const res = await fetch(
        `https://hhjygradtikonvfzarrn.supabase.co/functions/v1/admin-confirm-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "No se pudo confirmar el usuario");
      }

      toast.success("Email confirmado. El usuario ya puede iniciar sesión.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo confirmar el usuario");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const clearNewOrdersNotification = () => {
    setNewOrdersCount(0);
  };

  // Get unique barrios for filter
  const uniqueBarrios = [...new Set(pedidos.map((p) => p.barrio).filter(Boolean))].sort();

  // Status badge with icon
  const StatusBadge = ({ status }: { status: string | null }) => {
    const s = status?.toLowerCase();

    const getConfig = () => {
      switch (s) {
        case "entregado":
          return {
            icon: CheckCircle2,
            bg: "bg-green-500",
            text: "text-white",
            label: "Entregado",
            shortLabel: "OK",
          };
        case "en ruta":
        case "en camino":
          return {
            icon: Truck,
            bg: "bg-primary",
            text: "text-primary-foreground",
            label: "En Ruta",
            shortLabel: "Ruta",
          };
        case "pendiente":
          return {
            icon: Clock,
            bg: "bg-amber-500",
            text: "text-white",
            label: "Pendiente",
            shortLabel: "Pend",
          };
        case "en bodega":
          return {
            icon: Box,
            bg: "bg-secondary",
            text: "text-secondary-foreground",
            label: "En Bodega",
            shortLabel: "Bod",
          };
        case "cancelado":
          return {
            icon: XCircle,
            bg: "bg-destructive",
            text: "text-destructive-foreground",
            label: "Cancelado",
            shortLabel: "Canc",
          };
        default:
          if (s?.includes("novedad")) {
            return {
              icon: AlertTriangle,
              bg: "bg-orange-500",
              text: "text-white",
              label: "Novedad",
              shortLabel: "Nov",
            };
          }
          return {
            icon: Package,
            bg: "bg-muted",
            text: "text-muted-foreground",
            label: status || "Sin estado",
            shortLabel: "—",
          };
      }
    };

    const config = getConfig();
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}
      >
        <Icon className="h-3 w-3" />
        <span className="hidden sm:inline">{config.label}</span>
        <span className="sm:hidden">{config.shortLabel}</span>
      </span>
    );
  };

  const stats = {
    total: pedidos.length,
    pending: pedidos.filter(
      (p) => !p.motorizado_asignado || p.estado?.toLowerCase() === "pendiente" || p.estado?.toLowerCase() === "en bodega"
    ).length,
    unassigned: pedidos.filter((p) => !p.motorizado_asignado).length,
    inTransit: pedidos.filter(
      (p) => p.estado?.toLowerCase() === "en ruta" || p.estado?.toLowerCase() === "en camino"
    ).length,
    delivered: pedidos.filter((p) => p.estado?.toLowerCase() === "entregado").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
            <span className="hidden sm:inline-block text-sm font-medium text-muted-foreground">
              Panel Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* New orders notification */}
            {newOrdersCount > 0 && (
              <button
                onClick={clearNewOrdersNotification}
                className="relative flex items-center gap-2 rounded-full bg-green-500 px-3 py-1.5 text-white animate-pulse"
              >
                <Bell className="h-4 w-4" />
                <span className="text-sm font-bold">{newOrdersCount} nuevo(s)</span>
              </button>
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Stats Cards */}
        <motion.div
          className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div
            className="rounded-xl bg-amber-500/20 p-4 shadow-card cursor-pointer hover:ring-2 ring-amber-500 transition-all"
            onClick={() => setStatusFilter("sin_asignar")}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-muted-foreground">Sin Asignar</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.unassigned}</p>
          </div>
          <div className="rounded-xl bg-secondary/20 p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-secondary-foreground" />
              <span className="text-sm text-muted-foreground">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-secondary-foreground">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-primary/20 p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">En Ruta</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.inTransit}</p>
          </div>
          <div className="rounded-xl bg-green-500/20 p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">Entregados</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "orders", label: "Pedidos", icon: Package },
            { key: "map", label: "Mapa", icon: Map },
            { key: "users", label: "Usuarios", icon: Users },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Actions & Filters */}
            <div className="mb-4 flex flex-col gap-3">
              <button
                onClick={() => setShowNuevoPedido(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 sm:w-auto sm:self-start"
              >
                <Plus className="h-4 w-4" />
                Nuevo Pedido
              </button>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por guía, cliente, motorizado o barrio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                
                {/* Estado Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="sin_asignar">⚠️ Sin Asignar</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en bodega">En Bodega</option>
                  <option value="en ruta">En Ruta</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>

                {/* Barrio Filter */}
                <select
                  value={barrioFilter}
                  onChange={(e) => setBarrioFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="todos">Todos los barrios</option>
                  {uniqueBarrios.map((barrio) => (
                    <option key={barrio} value={barrio!}>
                      {barrio}
                    </option>
                  ))}
                </select>

                {/* Método de Pago Filter */}
                <select
                  value={metodoPagoFilter}
                  onChange={(e) => setMetodoPagoFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="todos">Todos los pagos</option>
                  <option value="efectivo">Contra Entrega</option>
                  <option value="anticipado">Pago Anticipado</option>
                </select>

                {/* Date Filter */}
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />

                {/* Clear Filters */}
                {(statusFilter !== "todos" ||
                  barrioFilter !== "todos" ||
                  metodoPagoFilter !== "todos" ||
                  dateFilter) && (
                  <button
                    onClick={() => {
                      setStatusFilter("todos");
                      setBarrioFilter("todos");
                      setMetodoPagoFilter("todos");
                      setDateFilter("");
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Orders Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-xl bg-card shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Guía
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Cliente
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden lg:table-cell">
                          Barrio
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden md:table-cell">
                          Pago
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Motorizado
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPedidos.map((pedido) => {
                        const isPendingAssignment = !pedido.motorizado_asignado;
                        return (
                          <tr
                            key={pedido.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isPendingAssignment ? "bg-amber-50 dark:bg-amber-950/20" : ""
                            }`}
                          >
                            <td className="px-3 py-3 font-medium text-foreground text-xs sm:text-sm">
                              <div className="flex items-center gap-2">
                                {isPendingAssignment && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                )}
                                {pedido.numero_guia || `#${pedido.id}`}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                              {pedido.cliente_nombre || "-"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground hidden lg:table-cell">
                              {pedido.barrio || "-"}
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  pedido.metodo_pago === "anticipado"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {pedido.metodo_pago === "anticipado" ? "Anticipado" : "Contra Entrega"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs sm:text-sm">
                              {isPendingAssignment ? (
                                <select
                                  disabled={assigningPedido === pedido.id}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      assignMotorizado(pedido.id, e.target.value);
                                    }
                                  }}
                                  className="w-full min-w-[120px] rounded-lg border-2 border-amber-400 bg-card px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    {assigningPedido === pedido.id ? "Asignando..." : "⚠️ Asignar"}
                                  </option>
                                  {motorizados.map((m) => (
                                    <option key={m.id} value={m.full_name}>
                                      {m.full_name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-muted-foreground">
                                  {pedido.motorizado_asignado}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={pedido.estado} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredPedidos.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No se encontraron pedidos con los filtros seleccionados
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Map Tab */}
        {activeTab === "map" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-card shadow-card overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <h2 className="font-bold text-foreground">Mapa Logístico de Bogotá</h2>
              <div className="flex flex-wrap gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-muted-foreground">Sin Asignar</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">En Ruta</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">Entregado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-muted-foreground">Novedad</span>
                </div>
              </div>
            </div>
            <div className="h-[500px] relative">
              <AdminMap pedidos={pedidos} />
            </div>
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="font-bold text-foreground">Gestión de Usuarios</h2>
              <button
                onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <UserPlus className="h-4 w-4" />
                Crear Usuario
              </button>
            </div>

            <div className="rounded-xl bg-card shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground hidden sm:table-cell">
                        Teléfono
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {user.full_name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {user.email || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {user.phone || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => confirmUserEmail(user.user_id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                            title="Confirmar email para permitir inicio de sesión inmediato"
                          >
                            <UserCheck className="h-4 w-4" />
                            Confirmar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No hay usuarios registrados
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        onUserCreated={fetchUsers}
      />

      {/* Nuevo Pedido Modal */}
      <NuevoPedidoModal
        isOpen={showNuevoPedido}
        onClose={() => setShowNuevoPedido(false)}
        onSuccess={fetchPedidos}
        isAdmin={true}
      />
    </div>
  );
};

export default AdminDashboard;

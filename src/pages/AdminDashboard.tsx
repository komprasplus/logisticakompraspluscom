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
  MapPinned,
  ScanLine,
  RotateCcw,
  ArrowLeftRight,
  DollarSign,
  Warehouse,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import AdminMap from "@/components/AdminMap";
import CreateUserModal from "@/components/CreateUserModal";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import QRScannerModal from "@/components/QRScannerModal";
import { ZONAS, getAllZonas, type ZonaCodigo } from "@/lib/zonas";
import { Button } from "@/components/ui/button";
import { getStatusConfig, ALL_STATUSES } from "@/lib/orderStatuses";

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
  zona: string | null;
  tipo_novedad: string | null;
  firma_cliente: string | null;
  foto_paquete: string | null;
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
  const [activeTab, setActiveTab] = useState<"map" | "orders" | "users">("map");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [barrioFilter, setBarrioFilter] = useState<string>("todos");
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string>("todos");
  const [zonaFilter, setZonaFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [assigningPedido, setAssigningPedido] = useState<number | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<number[]>([]);
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
  }, [statusFilter, barrioFilter, metodoPagoFilter, zonaFilter, dateFilter, searchQuery, pedidos]);

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

      if (rolesError) {
        console.error("Error fetching motorizado roles:", rolesError);
        throw rolesError;
      }

      console.log("Motorizado roles found:", roles);

      if (roles && roles.length > 0) {
        const motorizadoIds = roles.map((r) => r.user_id);
        
        // Get profiles for these users that are 'activo'
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", motorizadoIds)
          .eq("status", "activo");

        if (profilesError) {
          console.error("Error fetching motorizado profiles:", profilesError);
          throw profilesError;
        }

        console.log("Motorizado profiles found:", profiles);
        setMotorizados(profiles || []);
      } else {
        console.log("No motorizado roles found");
        setMotorizados([]);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
      toast.error("Error al cargar motorizados");
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

    // Zona filter
    if (zonaFilter !== "todos") {
      filtered = filtered.filter((p) => p.zona === zonaFilter);
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
          p.barrio?.toLowerCase().includes(query) ||
          p.zona?.toLowerCase().includes(query)
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
          estado: "Asignado",
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Update local state
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? { ...p, motorizado_asignado: motorizadoName, estado: "Asignado" }
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

  // Bulk assign motorizados to selected pedidos
  const bulkAssignMotorizado = async (motorizadoName: string) => {
    if (selectedForBulk.length === 0) {
      toast.error("No hay pedidos seleccionados");
      return;
    }

    setBulkAssigning(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_asignado: motorizadoName,
          estado: "Asignado",
        })
        .in("id", selectedForBulk);

      if (error) throw error;

      // Update local state
      setPedidos((prev) =>
        prev.map((p) =>
          selectedForBulk.includes(p.id)
            ? { ...p, motorizado_asignado: motorizadoName, estado: "Asignado" }
            : p
        )
      );

      toast.success(`${selectedForBulk.length} pedidos asignados a ${motorizadoName}`);
      setSelectedForBulk([]);
    } catch (error) {
      console.error("Error bulk assigning:", error);
      toast.error("Error al asignar pedidos");
    } finally {
      setBulkAssigning(false);
    }
  };

  // Toggle selection for bulk assignment
  const toggleBulkSelect = (pedidoId: number) => {
    setSelectedForBulk((prev) =>
      prev.includes(pedidoId)
        ? prev.filter((id) => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  // Select all unassigned in current filter
  const selectAllUnassigned = () => {
    const unassigned = filteredPedidos
      .filter((p) => !p.motorizado_asignado)
      .map((p) => p.id);
    setSelectedForBulk(unassigned);
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

  // Zona Badge component with colors
  const ZonaBadge = ({ zona }: { zona: string | null }) => {
    if (!zona) return <span className="text-muted-foreground">-</span>;

    const config = ZONAS[zona as ZonaCodigo];
    if (!config) return <span className="text-muted-foreground">{zona}</span>;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.bgColor} ${config.textColor}`}
      >
        <MapPinned className="h-3 w-3" />
        {config.codigo}
      </span>
    );
  };

  // Status badge with icon - using centralized config
  const StatusBadge = ({ status }: { status: string | null }) => {
    const config = getStatusConfig(status);

    const getIcon = () => {
      const s = status?.toLowerCase();
      switch (s) {
        case "recibido en bodega": return Warehouse;
        case "asignado": return CheckCircle2;
        case "en ruta":
        case "en camino": return Truck;
        case "entregado": return CheckCircle2;
        case "rechazado": return XCircle;
        case "devolución": return RotateCcw;
        case "liquidado": return DollarSign;
        default:
          if (s?.includes("novedad")) return AlertTriangle;
          return Package;
      }
    };

    const Icon = getIcon();

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.textColor}`}
      >
        <Icon className="h-3 w-3" />
        <span className="hidden sm:inline">{config.label}</span>
        <span className="sm:hidden">{config.label.substring(0, 4)}</span>
      </span>
    );
  };

  const stats = {
    total: pedidos.length,
    pending: pedidos.filter(
      (p) => !p.motorizado_asignado || p.estado?.toLowerCase() === "recibido en bodega"
    ).length,
    unassigned: pedidos.filter((p) => !p.motorizado_asignado).length,
    inTransit: pedidos.filter(
      (p) => p.estado?.toLowerCase() === "en ruta" || p.estado?.toLowerCase() === "en camino"
    ).length,
    delivered: pedidos.filter((p) => p.estado?.toLowerCase() === "entregado").length,
    novedad: pedidos.filter((p) => p.estado?.toLowerCase().includes("novedad")).length,
    liquidado: pedidos.filter((p) => p.estado?.toLowerCase() === "liquidado").length,
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

      <main className="container px-4 py-4">
        {/* Stats Cards - More compact */}
        <motion.div
          className="mb-4 grid grid-cols-3 sm:grid-cols-6 gap-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-card p-3 shadow-card">
            <div className="flex items-center gap-1 mb-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div
            className="rounded-xl bg-amber-500/20 p-3 shadow-card cursor-pointer hover:ring-2 ring-amber-500 transition-all"
            onClick={() => setStatusFilter("sin_asignar")}
          >
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Sin Asignar</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{stats.unassigned}</p>
          </div>
          <div className="rounded-xl bg-sky-500/20 p-3 shadow-card">
            <div className="flex items-center gap-1 mb-1">
              <Truck className="h-4 w-4 text-sky-600" />
              <span className="text-xs text-muted-foreground">En Ruta</span>
            </div>
            <p className="text-xl font-bold text-sky-600">{stats.inTransit}</p>
          </div>
          <div className="rounded-xl bg-green-500/20 p-3 shadow-card">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Entregado</span>
            </div>
            <p className="text-xl font-bold text-green-600">{stats.delivered}</p>
          </div>
          <div className="rounded-xl bg-orange-500/20 p-3 shadow-card">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">Novedad</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{stats.novedad}</p>
          </div>
          <div className="rounded-xl bg-teal-500/20 p-3 shadow-card">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-teal-600" />
              <span className="text-xs text-muted-foreground">Liquidado</span>
            </div>
            <p className="text-xl font-bold text-teal-600">{stats.liquidado}</p>
          </div>
        </motion.div>

        {/* Tabs - Map first */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "map", label: "Mapa", icon: Map },
            { key: "orders", label: "Pedidos", icon: Package },
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
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowNuevoPedido(true)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Pedido
                </button>
                <Button
                  onClick={() => setShowQRScanner(true)}
                  variant="secondary"
                  className="gap-2"
                >
                  <ScanLine className="h-4 w-4" />
                  Escanear QR
                </Button>
              </div>

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

                {/* Zona Filter */}
                <select
                  value={zonaFilter}
                  onChange={(e) => setZonaFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="todos">Todas las zonas</option>
                  {getAllZonas().map((zona) => (
                    <option key={zona} value={zona}>
                      {zona} - {ZONAS[zona].nombre}
                    </option>
                  ))}
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
                  zonaFilter !== "todos" ||
                  dateFilter) && (
                  <button
                    onClick={() => {
                      setStatusFilter("todos");
                      setBarrioFilter("todos");
                      setMetodoPagoFilter("todos");
                      setZonaFilter("todos");
                      setDateFilter("");
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              {/* Bulk Assignment Bar */}
              {selectedForBulk.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-foreground">
                    {selectedForBulk.length} pedido(s) seleccionado(s)
                  </span>
                  <select
                    disabled={bulkAssigning}
                    onChange={(e) => {
                      if (e.target.value) {
                        bulkAssignMotorizado(e.target.value);
                      }
                    }}
                    className="rounded-lg border border-primary bg-card px-3 py-1.5 text-sm font-medium focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {bulkAssigning ? "Asignando..." : "Asignar a..."}
                    </option>
                    {motorizados.map((m) => (
                      <option key={m.id} value={m.full_name}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setSelectedForBulk([])}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Select All Unassigned Button */}
              {filteredPedidos.filter((p) => !p.motorizado_asignado).length > 0 &&
                selectedForBulk.length === 0 && (
                  <button
                    onClick={selectAllUnassigned}
                    className="text-sm text-primary hover:underline"
                  >
                    Seleccionar todos sin asignar ({filteredPedidos.filter((p) => !p.motorizado_asignado).length})
                  </button>
                )}
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
                        <th className="px-2 py-3 text-left w-8">
                          <span className="sr-only">Seleccionar</span>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Guía
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">
                          Cliente
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden sm:table-cell">
                          Zona
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
                        const isSelected = selectedForBulk.includes(pedido.id);
                        return (
                          <tr
                            key={pedido.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isPendingAssignment ? "bg-amber-50 dark:bg-amber-950/20" : ""
                            } ${isSelected ? "bg-primary/10" : ""}`}
                          >
                            <td className="px-2 py-3">
                              {isPendingAssignment && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleBulkSelect(pedido.id)}
                                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                              )}
                            </td>
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
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <ZonaBadge zona={pedido.zona} />
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

        {/* Map Tab - Central Full Screen View */}
        {activeTab === "map" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-card shadow-card overflow-hidden"
          >
            <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-foreground text-lg">🗺️ Centro de Control Logístico</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowNuevoPedido(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQRScanner(true)}
                  className="gap-1"
                >
                  <ScanLine className="h-4 w-4" />
                  QR
                </Button>
              </div>
            </div>
            
            {/* Legend */}
            <div className="px-3 py-2 bg-muted/30 border-b border-border flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-800"></div>
                <span className="text-muted-foreground">🏭 Bodega</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-muted-foreground">Sin Asignar</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-muted-foreground">En Bodega</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-muted-foreground">Asignado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                <span className="text-muted-foreground">En Ruta</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-muted-foreground">Entregado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-muted-foreground">Novedad</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-muted-foreground">Rechazado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-muted-foreground">Devolución</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span className="text-muted-foreground">Liquidado</span>
              </div>
            </div>
            
            {/* Full height map */}
            <div className="h-[calc(100vh-320px)] min-h-[400px] relative">
              <AdminMap 
                pedidos={filteredPedidos} 
                onPedidoClick={(p) => setSelectedPedido(p as Pedido)}
                selectedPedidoId={selectedPedido?.id}
              />
            </div>

            {/* Selected Pedido Quick Panel */}
            <AnimatePresence>
              {selectedPedido && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card rounded-xl shadow-elevated p-4 border border-border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-foreground">
                        {selectedPedido.numero_guia || `#${selectedPedido.id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPedido.cliente_nombre}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPedido(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    📍 {selectedPedido.direccion_entrega}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={selectedPedido.estado} />
                    {selectedPedido.tipo_novedad && (
                      <span className="text-xs text-orange-600">
                        ({selectedPedido.tipo_novedad})
                      </span>
                    )}
                  </div>
                  {!selectedPedido.motorizado_asignado ? (
                    <select
                      disabled={assigningPedido === selectedPedido.id}
                      onChange={(e) => {
                        if (e.target.value) {
                          assignMotorizado(selectedPedido.id, e.target.value);
                          setSelectedPedido(null);
                        }
                      }}
                      className="w-full rounded-lg border-2 border-amber-400 bg-card px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {assigningPedido === selectedPedido.id ? "Asignando..." : "⚠️ Asignar motorizado..."}
                      </option>
                      {motorizados.map((m) => (
                        <option key={m.id} value={m.full_name}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      🏍️ <span className="font-medium">{selectedPedido.motorizado_asignado}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={fetchPedidos}
      />
    </div>
  );
};

export default AdminDashboard;

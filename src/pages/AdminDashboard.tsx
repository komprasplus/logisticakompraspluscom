import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

const AdminDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "map" | "users">("orders");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPedidos();
    fetchUsers();
  }, []);

  useEffect(() => {
    filterPedidos();
  }, [statusFilter, dateFilter, searchQuery, pedidos]);

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

  const filterPedidos = () => {
    let filtered = [...pedidos];

    if (statusFilter !== "todos") {
      filtered = filtered.filter(
        (p) => p.estado?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (dateFilter) {
      filtered = filtered.filter((p) => {
        if (!p.fecha_creacion) return false;
        const pedidoDate = new Date(p.fecha_creacion).toISOString().split("T")[0];
        return pedidoDate === dateFilter;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.numero_guia?.toLowerCase().includes(query) ||
          p.cliente_nombre?.toLowerCase().includes(query) ||
          p.motorizado_asignado?.toLowerCase().includes(query)
      );
    }

    setFilteredPedidos(filtered);
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

  // Status badge with icon for mobile optimization
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
        case "novedad":
          return {
            icon: AlertTriangle,
            bg: "bg-orange-500",
            text: "text-white",
            label: "Novedad",
            shortLabel: "Nov",
          };
        default:
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
      (p) => p.estado?.toLowerCase() === "pendiente" || p.estado?.toLowerCase() === "en bodega"
    ).length,
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
          className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Actions & Filters */}
            <div className="mb-4 flex flex-col gap-3">
              <button
                onClick={() => setShowNuevoPedido(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 sm:w-auto sm:self-start"
              >
                <Plus className="h-4 w-4" />
                Nuevo Pedido
              </button>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por guía, cliente o motorizado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en bodega">En Bodega</option>
                    <option value="en ruta">En Ruta</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
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
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Guía</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Cliente</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden md:table-cell">Dirección</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden sm:table-cell">Motorizado</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Estado</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPedidos.map((pedido) => (
                        <tr key={pedido.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-3 font-medium text-foreground text-xs sm:text-sm">
                            {pedido.numero_guia || `#${pedido.id}`}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                            {pedido.cliente_nombre || "-"}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                            {pedido.direccion_entrega || "-"}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">
                            {pedido.motorizado_asignado || "-"}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={pedido.estado} />
                          </td>
                          <td className="px-3 py-3 text-muted-foreground hidden lg:table-cell">
                            {pedido.fecha_creacion
                              ? new Date(pedido.fecha_creacion).toLocaleDateString("es-CO")
                              : "-"}
                          </td>
                        </tr>
                      ))}
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
              <div className="flex gap-4 mt-2 text-xs">
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
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
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground hidden sm:table-cell">Teléfono</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{user.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{user.phone || "-"}</td>
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

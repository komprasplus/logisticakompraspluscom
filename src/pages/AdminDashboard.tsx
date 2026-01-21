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
  Key,
  Ban,
  Eye,
  Printer,
  FileCheck,
  Store,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import AdminMap from "@/components/AdminMap";
import AdminSidebar from "@/components/AdminSidebar";
import NovedadesPanel from "@/components/NovedadesPanel";
import CreateUserModal from "@/components/CreateUserModal";
import ResetUserPasswordModal from "@/components/ResetUserPasswordModal";
import DeleteUserModal from "@/components/DeleteUserModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import QRScannerModal from "@/components/QRScannerModal";
import PedidoDetailModal from "@/components/PedidoDetailModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import BulkPrintGuiasModal from "@/components/BulkPrintGuiasModal";
import LiquidacionesPanel from "@/components/LiquidacionesPanel";
import StoreLiquidacionesPanel from "@/components/StoreLiquidacionesPanel";
import AdminReportesPanel from "@/components/AdminReportesPanel";
import UserCardsGrid from "@/components/UserCardsGrid";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { ZONAS, getAllZonas, type ZonaCodigo } from "@/lib/zonas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStatusConfig, ALL_STATUSES, isOperationalStatus } from "@/lib/orderStatuses";
import AdminNotesInput from "@/components/AdminNotesInput";

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

interface UserRole {
  user_id: string;
  role: string;
}

const AdminDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("mapa");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [barrioFilter, setBarrioFilter] = useState<string>("todos");
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string>("todos");
  const [zonaFilter, setZonaFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [mapDateFilter, setMapDateFilter] = useState<string>(""); // Separate filter for map historical view
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<Profile | null>(null);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [selectedPedidoForCancel, setSelectedPedidoForCancel] = useState<Pedido | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPedidoForDetail, setSelectedPedidoForDetail] = useState<Pedido | null>(null);
  const [clientProfiles, setClientProfiles] = useState<Record<string, { store_name: string | null; full_name: string }>>({});
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [assigningPedido, setAssigningPedido] = useState<number | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<number[]>([]);
  const [showPrintGuia, setShowPrintGuia] = useState(false);
  const [selectedPedidoForPrint, setSelectedPedidoForPrint] = useState<Pedido | null>(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<number[]>([]);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  // Pagination for despacho table
  const despachoPageState = usePagination({ items: filteredPedidos, itemsPerPage: 10 });

  // Fetch initial data
  useEffect(() => {
    fetchPedidos();
    fetchUsers();
    fetchMotorizados();
    fetchClientProfiles();
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchClientProfiles = async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, store_name, full_name")
          .in("user_id", roles.map(r => r.user_id));

        if (profiles) {
          const profileMap: Record<string, { store_name: string | null; full_name: string }> = {};
          profiles.forEach(p => {
            profileMap[p.user_id] = { store_name: p.store_name, full_name: p.full_name };
          });
          setClientProfiles(profileMap);
        }
      }
    } catch (error) {
      console.error("Error fetching client profiles:", error);
    }
  };

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
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const motorizadoIds = roles.map((r) => r.user_id);
        
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
      toast.error("Error al cargar motorizados");
    }
  };

  const filterPedidos = () => {
    let filtered = [...pedidos];

    // For operational views (map, table), exclude cancelled orders unless specifically filtering for them
    if (statusFilter === "sin_asignar") {
      filtered = filtered.filter((p) => !p.motorizado_asignado && isOperationalStatus(p.estado));
    } else if (statusFilter === "anulado") {
      // Show only cancelled orders
      filtered = filtered.filter((p) => p.estado?.toLowerCase() === "anulado");
    } else if (statusFilter !== "todos") {
      filtered = filtered.filter(
        (p) => p.estado?.toLowerCase() === statusFilter.toLowerCase()
      );
    } else {
      // "todos" filter - exclude cancelled orders from default view
      filtered = filtered.filter((p) => isOperationalStatus(p.estado));
    }

    if (barrioFilter !== "todos") {
      filtered = filtered.filter((p) => p.barrio === barrioFilter);
    }

    if (metodoPagoFilter !== "todos") {
      filtered = filtered.filter((p) => p.metodo_pago === metodoPagoFilter);
    }

    if (zonaFilter !== "todos") {
      filtered = filtered.filter((p) => p.zona === zonaFilter);
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
          p.motorizado_asignado?.toLowerCase().includes(query) ||
          p.barrio?.toLowerCase().includes(query) ||
          p.zona?.toLowerCase().includes(query)
      );
    }

    setFilteredPedidos(filtered);
  };

  const assignMotorizado = async (pedidoId: number, motorizadoUserId: string) => {
    // Find the motorizado by user_id to get both name and id
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

  const bulkAssignMotorizado = async (motorizadoUserId: string) => {
    if (selectedForBulk.length === 0) {
      toast.error("No hay pedidos seleccionados");
      return;
    }

    // Find the motorizado by user_id
    const motorizado = motorizados.find(m => m.user_id === motorizadoUserId);
    if (!motorizado) {
      toast.error("Motorizado no encontrado");
      return;
    }

    setBulkAssigning(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          motorizado_asignado: motorizado.full_name,
          motorizado_id: motorizadoUserId,
          estado: "Asignado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .in("id", selectedForBulk);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) =>
          selectedForBulk.includes(p.id)
            ? { ...p, motorizado_asignado: motorizado.full_name, motorizado_id: motorizadoUserId, estado: "Asignado" }
            : p
        )
      );

      toast.success(`${selectedForBulk.length} pedidos asignados a ${motorizado.full_name}`);
      setSelectedForBulk([]);
    } catch (error) {
      console.error("Error bulk assigning:", error);
      toast.error("Error al asignar pedidos");
    } finally {
      setBulkAssigning(false);
    }
  };

  const toggleBulkSelect = (pedidoId: number) => {
    setSelectedForBulk((prev) =>
      prev.includes(pedidoId)
        ? prev.filter((id) => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  const selectAllUnassigned = () => {
    const unassigned = filteredPedidos
      .filter((p) => !p.motorizado_asignado)
      .map((p) => p.id);
    setSelectedForBulk(unassigned);
  };

  // Toggle select for bulk printing
  const togglePrintSelect = (pedidoId: number) => {
    setSelectedForPrint((prev) =>
      prev.includes(pedidoId)
        ? prev.filter((id) => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  // Check if order can have guide printed (only 'Recibido en Bodega' or 'Asignado')
  const canPrintGuia = (pedido: Pedido) => {
    const estado = pedido.estado?.toLowerCase();
    return estado === "recibido en bodega" || estado === "asignado";
  };

  // Mark guides as printed in the database
  const markGuiasAsPrinted = async (pedidoIds: number[]) => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          guia_impresa: true,
          guia_impresa_at: new Date().toISOString(),
        })
        .in("id", pedidoIds);

      if (error) throw error;

      // Update local state
      setPedidos((prev) =>
        prev.map((p) =>
          pedidoIds.includes(p.id)
            ? { ...p, guia_impresa: true, guia_impresa_at: new Date().toISOString() }
            : p
        )
      );

      toast.success(`${pedidoIds.length} guía(s) marcada(s) como impresa(s)`);
    } catch (error) {
      console.error("Error marking guides as printed:", error);
      toast.error("Error al marcar guías como impresas");
    }
  };

  // Handle individual print
  const handlePrintGuia = (pedido: Pedido) => {
    setSelectedPedidoForPrint(pedido);
    setShowPrintGuia(true);
  };

  // Handle individual print completion
  const handlePrintComplete = async (pedidoIds: number[]) => {
    await markGuiasAsPrinted(pedidoIds);
    setShowPrintGuia(false);
    setSelectedPedidoForPrint(null);
  };

  // Handle bulk print
  const handleBulkPrint = () => {
    if (selectedForPrint.length < 2) {
      toast.error("Selecciona al menos 2 pedidos para impresión masiva");
      return;
    }
    setShowBulkPrint(true);
  };

  // Handle bulk print completion
  const handleBulkPrintComplete = async (pedidoIds: number[]) => {
    await markGuiasAsPrinted(pedidoIds);
    setShowBulkPrint(false);
    setSelectedForPrint([]);
  };

  // Get client remitentes map for bulk print
  const getClientRemitentes = () => {
    const remitentes: Record<string, string> = {};
    Object.entries(clientProfiles).forEach(([userId, profile]) => {
      remitentes[userId] = profile.store_name || profile.full_name;
    });
    return remitentes;
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

  // Cancel order function
  const cancelOrder = async (pedidoId: number) => {
    try {
      const pedido = pedidos.find(p => p.id === pedidoId);
      
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Anulado",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      // Update local state
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? { ...p, estado: "Anulado" }
            : p
        )
      );

      // Notify the client via toast (in-app notification)
      toast.success(
        `Pedido ${pedido?.numero_guia || `#${pedidoId}`} anulado exitosamente`,
        {
          description: "Se ha notificado al cliente",
          duration: 5000,
        }
      );

      // If client has phone, we could send WhatsApp notification
      if (pedido?.client_phone) {
        const phoneNumber = pedido.client_phone.replace(/\D/g, "");
        const message = encodeURIComponent(
          `🚫 *Kompras Plus*\n\nTu pedido con número de guía ${pedido.numero_guia || `#${pedidoId}`} ha sido anulado por el administrador.\n\nSi tienes preguntas, contáctanos al 324 222 3825.`
        );
        // Open WhatsApp in new tab to send notification
        window.open(`https://wa.me/57${phoneNumber}?text=${message}`, "_blank");
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Error al anular el pedido");
      throw error;
    }
  };

  const uniqueBarrios = [...new Set(pedidos.map((p) => p.barrio).filter(Boolean))].sort();

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

  // Filter out cancelled orders from operational metrics
  const operationalPedidos = pedidos.filter(p => isOperationalStatus(p.estado));
  const cancelledCount = pedidos.filter(p => p.estado?.toLowerCase() === "anulado").length;

  const stats = {
    total: operationalPedidos.length,
    pending: operationalPedidos.filter(
      (p) => !p.motorizado_asignado || p.estado?.toLowerCase() === "recibido en bodega"
    ).length,
    unassigned: operationalPedidos.filter((p) => !p.motorizado_asignado).length,
    inTransit: operationalPedidos.filter(
      (p) => p.estado?.toLowerCase() === "en ruta" || p.estado?.toLowerCase() === "en camino"
    ).length,
    delivered: operationalPedidos.filter((p) => p.estado?.toLowerCase() === "entregado").length,
    novedad: operationalPedidos.filter((p) => p.estado?.toLowerCase().includes("novedad")).length,
    liquidado: operationalPedidos.filter((p) => p.estado?.toLowerCase() === "liquidado").length,
    cancelled: cancelledCount,
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case "mapa":
        // Filter pedidos for map by selected date (using mapDateFilter state)
        const mapFilteredPedidos = mapDateFilter 
          ? filteredPedidos.filter((p) => {
              if (!p.fecha_entrega) return false;
              return p.fecha_entrega === mapDateFilter;
            })
          : filteredPedidos;

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col"
          >
            <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-card">
              <h2 className="font-bold text-foreground text-lg">🗺️ Mapa Real-time</h2>
              <div className="flex gap-2 items-center flex-wrap">
                {/* Date Filter Calendar for Historical Map */}
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={mapDateFilter} 
                    onChange={(e) => setMapDateFilter(e.target.value)} 
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                  {mapDateFilter && (
                    <button 
                      onClick={() => setMapDateFilter("")} 
                      className="text-xs text-primary hover:underline"
                    >
                      Ver hoy
                    </button>
                  )}
                </div>
                <Button size="sm" onClick={() => setShowNuevoPedido(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Nuevo
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowQRScanner(true)} className="gap-1">
                  <ScanLine className="h-4 w-4" />
                  QR
                </Button>
              </div>
            </div>

            {/* Date indicator */}
            {mapDateFilter && (
              <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 text-sm text-primary font-medium">
                📅 Mostrando entregas del: {new Date(mapDateFilter + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <span className="ml-2 text-muted-foreground">({mapFilteredPedidos.length} pedidos)</span>
              </div>
            )}
            
            {/* Legend */}
            <div className="px-3 py-2 bg-muted/30 border-b border-border flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-800"></div><span>🏭 Bodega</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-400"></div><span>Sin Asignar</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-500"></div><span>En Bodega</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span>Asignado</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-sky-500"></div><span>En Ruta</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>Entregado</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span>Novedad</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>Rechazado</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span>Devolución</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-teal-500"></div><span>Liquidado</span></div>
            </div>
            
            {/* Map */}
            <div className="flex-1 relative min-h-[500px]">
              <AdminMap 
                pedidos={mapFilteredPedidos} 
                onPedidoClick={(p) => setSelectedPedido(p as Pedido)}
                selectedPedidoId={selectedPedido?.id}
              />
            </div>

            {/* Selected Pedido Panel */}
            <AnimatePresence>
              {selectedPedido && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 right-4 w-80 bg-card rounded-xl shadow-elevated p-4 border border-border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-foreground">{selectedPedido.numero_guia || `#${selectedPedido.id}`}</p>
                      <p className="text-sm text-muted-foreground">{selectedPedido.cliente_nombre}</p>
                    </div>
                    <button onClick={() => setSelectedPedido(null)} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">📍 {selectedPedido.direccion_entrega}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={selectedPedido.estado} />
                    {selectedPedido.tipo_novedad && (
                      <span className="text-xs text-orange-600">({selectedPedido.tipo_novedad})</span>
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
                      <option value="" disabled>{assigningPedido === selectedPedido.id ? "Asignando..." : "⚠️ Asignar motorizado..."}</option>
                      {motorizados.map((m) => (
                        <option key={m.id} value={m.full_name}>{m.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-muted-foreground">🏍️ <span className="font-medium">{selectedPedido.motorizado_asignado}</span></div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case "despacho":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
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
                <Button onClick={() => setShowQRScanner(true)} variant="secondary" className="gap-2">
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
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="todos">Todos los estados</option>
                  <option value="sin_asignar">⚠️ Sin Asignar</option>
                  <option value="recibido en bodega">Recibido en Bodega</option>
                  <option value="asignado">Asignado</option>
                  <option value="en ruta">En Ruta</option>
                  <option value="entregado">Entregado</option>
                  <option value="novedad">Novedad</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="devolución">Devolución</option>
                  <option value="liquidado">Liquidado</option>
                  <option value="anulado">🚫 Anulados ({stats.cancelled})</option>
                </select>

                <select value={barrioFilter} onChange={(e) => setBarrioFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="todos">Todos los barrios</option>
                  {uniqueBarrios.map((barrio) => (
                    <option key={barrio} value={barrio!}>{barrio}</option>
                  ))}
                </select>

                <select value={metodoPagoFilter} onChange={(e) => setMetodoPagoFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="todos">Todos los pagos</option>
                  <option value="efectivo">Contra Entrega</option>
                  <option value="anticipado">Pago Anticipado</option>
                </select>

                <select value={zonaFilter} onChange={(e) => setZonaFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="todos">Todas las zonas</option>
                  {getAllZonas().map((zona) => (
                    <option key={zona} value={zona}>{zona} - {ZONAS[zona].nombre}</option>
                  ))}
                </select>

                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none" />

                {(statusFilter !== "todos" || barrioFilter !== "todos" || metodoPagoFilter !== "todos" || zonaFilter !== "todos" || dateFilter) && (
                  <button onClick={() => { setStatusFilter("todos"); setBarrioFilter("todos"); setMetodoPagoFilter("todos"); setZonaFilter("todos"); setDateFilter(""); }} className="text-sm text-primary hover:underline">
                    Limpiar filtros
                  </button>
                )}
              </div>

              {/* Bulk Assignment Bar */}
              {selectedForBulk.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-foreground">{selectedForBulk.length} pedido(s) seleccionado(s)</span>
                  <select
                    disabled={bulkAssigning}
                    onChange={(e) => { if (e.target.value) bulkAssignMotorizado(e.target.value); }}
                    className="rounded-lg border border-primary bg-card px-3 py-1.5 text-sm font-medium focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>{bulkAssigning ? "Asignando..." : "Asignar a..."}</option>
                    {motorizados.map((m) => (
                      <option key={m.id} value={m.user_id}>{m.full_name}</option>
                    ))}
                  </select>
                  <button onClick={() => setSelectedForBulk([])} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              )}

              {filteredPedidos.filter((p) => !p.motorizado_asignado).length > 0 && selectedForBulk.length === 0 && (
                <button onClick={selectAllUnassigned} className="text-sm text-primary hover:underline">
                  Seleccionar todos sin asignar ({filteredPedidos.filter((p) => !p.motorizado_asignado).length})
                </button>
              )}

              {/* Bulk Print Bar */}
              {selectedForPrint.length >= 2 && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700">
                  <Printer className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-foreground">{selectedForPrint.length} guía(s) seleccionada(s)</span>
                  <Button size="sm" onClick={handleBulkPrint} className="gap-1">
                    <Printer className="h-4 w-4" />
                    Generar Guías Masivas
                  </Button>
                  <button onClick={() => setSelectedForPrint([])} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              )}
            </div>

            {/* Orders Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="rounded-xl bg-card shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-2 py-3 text-left w-8"><span className="sr-only">Seleccionar Asig.</span></th>
                        <th className="px-2 py-3 text-left w-8"><span className="sr-only">Seleccionar Guía</span></th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Guía</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Cliente</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden sm:table-cell">Zona</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Barrio</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden md:table-cell">Pago</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Motorizado</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Estado</th>
                        <th className="px-2 py-3 text-center font-semibold text-foreground text-xs sm:text-sm w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPedidos.map((pedido) => {
                        const isPendingAssignment = !pedido.motorizado_asignado;
                        const isSelected = selectedForBulk.includes(pedido.id);
                        const isCancelled = pedido.estado?.toLowerCase() === "anulado";
                        const canCancel = !isCancelled && pedido.estado?.toLowerCase() !== "entregado" && pedido.estado?.toLowerCase() !== "liquidado";
                        const isPrintable = canPrintGuia(pedido);
                        const isPrintSelected = selectedForPrint.includes(pedido.id);
                        const isGuiaImpresa = pedido.guia_impresa;
                        
                        return (
                          <tr key={pedido.id} className={`hover:bg-muted/30 transition-colors ${isPendingAssignment && !isCancelled ? "bg-amber-50 dark:bg-amber-950/20" : ""} ${isSelected ? "bg-primary/10" : ""} ${isPrintSelected ? "bg-emerald-50 dark:bg-emerald-950/20" : ""} ${isCancelled ? "opacity-60" : ""}`}>
                            {/* Bulk assignment checkbox */}
                            <td className="px-2 py-3">
                              {isPendingAssignment && !isCancelled && (
                                <input type="checkbox" checked={isSelected} onChange={() => toggleBulkSelect(pedido.id)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                              )}
                            </td>
                            {/* Bulk print checkbox */}
                            <td className="px-2 py-3">
                              {isPrintable && !isCancelled && (
                                <input 
                                  type="checkbox" 
                                  checked={isPrintSelected} 
                                  onChange={() => togglePrintSelect(pedido.id)} 
                                  className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500" 
                                  title="Seleccionar para impresión masiva"
                                />
                              )}
                            </td>
                            <td className="px-3 py-3 font-medium text-foreground text-xs sm:text-sm">
                              <div className="flex items-center gap-2">
                                {isPendingAssignment && !isCancelled && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                {isGuiaImpresa && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-600" title="Guía Impresa">
                                    <FileCheck className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {pedido.numero_guia || `#${pedido.id}`}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">{pedido.cliente_nombre || "-"}</td>
                            <td className="px-3 py-3 hidden sm:table-cell"><ZonaBadge zona={pedido.zona} /></td>
                            <td className="px-3 py-3 text-muted-foreground hidden lg:table-cell">{pedido.barrio || "-"}</td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pedido.metodo_pago === "anticipado" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                {pedido.metodo_pago === "anticipado" ? "Anticipado" : "Contra Entrega"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs sm:text-sm">
                              {isCancelled ? (
                                <span className="text-muted-foreground">-</span>
                              ) : isPendingAssignment ? (
                                <select
                                  disabled={assigningPedido === pedido.id}
                                  onChange={(e) => { if (e.target.value) assignMotorizado(pedido.id, e.target.value); }}
                                  className="w-full min-w-[120px] rounded-lg border-2 border-amber-400 bg-card px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                                  defaultValue=""
                                >
                                  <option value="" disabled>{assigningPedido === pedido.id ? "Asignando..." : "⚠️ Asignar"}</option>
                                  {motorizados.map((m) => (<option key={m.id} value={m.user_id}>{m.full_name}</option>))}
                                </select>
                              ) : (
                                <span className="text-muted-foreground">{pedido.motorizado_asignado}</span>
                              )}
                            </td>
                            <td className="px-3 py-3"><StatusBadge status={pedido.estado} /></td>
                            <td className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Print Button */}
                                {isPrintable && !isCancelled && (
                                  <button
                                    onClick={() => handlePrintGuia(pedido)}
                                    className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
                                      isGuiaImpresa 
                                        ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                        : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-600"
                                    }`}
                                    title={isGuiaImpresa ? "Reimprimir guía" : "Imprimir guía"}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                )}
                                {/* Detail Button */}
                                <button
                                  onClick={() => {
                                    setSelectedPedidoForDetail(pedido);
                                    setShowDetailModal(true);
                                  }}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {canCancel && (
                                  <button
                                    onClick={() => {
                                      setSelectedPedidoForCancel(pedido);
                                      setShowCancelOrder(true);
                                    }}
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                    title="Anular pedido"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </button>
                                )}
                                {isCancelled && (
                                  <span className="text-xs text-muted-foreground">Anulado</span>
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
                  <div className="p-8 text-center text-muted-foreground">No se encontraron pedidos con los filtros seleccionados</div>
                )}
              </div>
            )}
          </motion.div>
        );

      case "novedades":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <NovedadesPanel pedidos={pedidos} onPedidoClick={(p) => setSelectedPedido(p as Pedido)} />
          </motion.div>
        );

      case "inventario":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Warehouse className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold text-foreground">Inventario de Bodega</h3>
              <p className="text-muted-foreground mt-2">Módulo en desarrollo</p>
            </div>
          </motion.div>
        );

      case "liquidaciones":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <h2 className="font-bold text-foreground text-xl mb-4">💰 Liquidaciones</h2>
            <Tabs defaultValue="motorizados" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="motorizados" className="gap-2">
                  <Truck className="h-4 w-4" />
                  Motorizados
                </TabsTrigger>
                <TabsTrigger value="tiendas" className="gap-2">
                  <Store className="h-4 w-4" />
                  Tiendas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="motorizados">
                <LiquidacionesPanel onLiquidacionComplete={fetchPedidos} />
              </TabsContent>
              <TabsContent value="tiendas">
                <StoreLiquidacionesPanel onLiquidacionComplete={fetchPedidos} />
              </TabsContent>
            </Tabs>
          </motion.div>
        );

      case "informes":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <AdminReportesPanel />
          </motion.div>
        );

      case "configuracion":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            {/* Admin Notes Section */}
            <div className="mb-8">
              <h2 className="font-bold text-foreground text-lg mb-4">📢 Notas para Motorizados</h2>
              <AdminNotesInput />
            </div>

            <div className="mb-4 flex justify-between items-center">
              <h2 className="font-bold text-foreground text-lg">Gestión de Usuarios</h2>
              <button
                onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <UserPlus className="h-4 w-4" />
                Crear Usuario
              </button>
            </div>

            {/* User Cards Grid */}
            <UserCardsGrid
              users={users}
              userRoles={userRoles}
              onResetPassword={(user) => {
                setSelectedUserForReset(user);
                setShowResetPassword(true);
              }}
              onConfirmEmail={confirmUserEmail}
              onDeleteUser={(user) => {
                setSelectedUserForDelete(user);
                setShowDeleteUser(true);
              }}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <AdminSidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        novedadesCount={stats.novedad}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            {/* Stats Row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-bold">{stats.total}</span>
                <span className="text-muted-foreground hidden sm:inline">Total</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-bold">{stats.unassigned}</span>
                <span className="hidden sm:inline">Sin Asignar</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-sky-600">
                <Truck className="h-4 w-4" />
                <span className="font-bold">{stats.inTransit}</span>
                <span className="hidden sm:inline">En Ruta</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-bold">{stats.delivered}</span>
                <span className="hidden sm:inline">Entregados</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {newOrdersCount > 0 && (
                <button
                  onClick={clearNewOrdersNotification}
                  className="relative flex items-center gap-2 rounded-full bg-green-500 px-3 py-1.5 text-white animate-pulse"
                >
                  <Bell className="h-4 w-4" />
                  <span className="text-sm font-bold">{newOrdersCount} nuevo(s)</span>
                </button>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name}</span>
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

        {/* Main Area */}
        <main className="flex-1 overflow-auto relative bg-muted/30">
          {renderMainContent()}
        </main>
      </div>

      {/* Modals */}
      <CreateUserModal isOpen={showCreateUser} onClose={() => setShowCreateUser(false)} onUserCreated={() => { fetchUsers(); fetchUserRoles(); }} />
      <ResetUserPasswordModal 
        isOpen={showResetPassword} 
        onClose={() => {
          setShowResetPassword(false);
          setSelectedUserForReset(null);
        }} 
        user={selectedUserForReset} 
      />
      <DeleteUserModal
        isOpen={showDeleteUser}
        onClose={() => {
          setShowDeleteUser(false);
          setSelectedUserForDelete(null);
        }}
        user={selectedUserForDelete}
        onUserDeleted={() => { fetchUsers(); fetchUserRoles(); }}
      />
      <NuevoPedidoModal isOpen={showNuevoPedido} onClose={() => setShowNuevoPedido(false)} onSuccess={fetchPedidos} isAdmin={true} />
      <QRScannerModal isOpen={showQRScanner} onClose={() => setShowQRScanner(false)} onSuccess={fetchPedidos} />
      <CancelOrderModal 
        isOpen={showCancelOrder} 
        onClose={() => {
          setShowCancelOrder(false);
          setSelectedPedidoForCancel(null);
        }} 
        pedido={selectedPedidoForCancel}
        onConfirm={cancelOrder}
      />
      <PedidoDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPedidoForDetail(null);
        }}
        pedido={selectedPedidoForDetail}
        remitente={selectedPedidoForDetail?.client_user_id 
          ? clientProfiles[selectedPedidoForDetail.client_user_id]?.store_name || 
            clientProfiles[selectedPedidoForDetail.client_user_id]?.full_name 
          : undefined}
        onStatusChange={() => {
          fetchPedidos();
        }}
      />
      <PrintGuiaModal
        isOpen={showPrintGuia}
        onClose={() => {
          handlePrintComplete(selectedPedidoForPrint ? [selectedPedidoForPrint.id] : []);
        }}
        pedido={selectedPedidoForPrint}
        remitente={selectedPedidoForPrint?.client_user_id 
          ? clientProfiles[selectedPedidoForPrint.client_user_id]?.store_name || 
            clientProfiles[selectedPedidoForPrint.client_user_id]?.full_name 
          : undefined}
      />
      <BulkPrintGuiasModal
        isOpen={showBulkPrint}
        onClose={() => {
          setShowBulkPrint(false);
          setSelectedForPrint([]);
        }}
        pedidos={filteredPedidos.filter(p => selectedForPrint.includes(p.id))}
        remitentes={getClientRemitentes()}
        onPrintComplete={handleBulkPrintComplete}
      />
    </div>
  );
};

export default AdminDashboard;

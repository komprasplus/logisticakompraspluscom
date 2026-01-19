import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  History,
  Search,
  Loader2,
  LogOut,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  Truck,
  Warehouse,
  Plus,
  Edit,
  Printer,
  Clock,
  Box,
  AlertTriangle,
  XCircle,
  Shield,
  MessageSquare,
  Image,
  Filter,
  RotateCcw,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import MotorcycleIcon from "@/components/MotorcycleIcon";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import EditPedidoModal from "@/components/EditPedidoModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import SecuritySettings from "@/components/SecuritySettings";
import ClientStatsCards from "@/components/ClientStatsCards";
import ClientOrderInstructions from "@/components/ClientOrderInstructions";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
import { Button } from "@/components/ui/button";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

const SUPPORT_PHONE = "324 222 3825";
const WAREHOUSE_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá";
const FLETE_COSTO = 3500; // Costo flete fijo

const ClienteDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "tracking" | "security">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackingResult, setTrackingResult] = useState<Pedido | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [printingPedido, setPrintingPedido] = useState<Pedido | null>(null);
  const [filterNovedades, setFilterNovedades] = useState(false);
  const [instructionsPedido, setInstructionsPedido] = useState<Pedido | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const { signOut, profile, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      fetchPedidos();
    }
  }, [user?.id]);

  const fetchPedidos = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("client_user_id", user.id)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Error fetching pedidos:", error);
      toast.error("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthPedidos = pedidos.filter((p) => {
      if (!p.fecha_creacion) return false;
      const date = new Date(p.fecha_creacion);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalMonth = monthPedidos.length;
    const deliveredCount = monthPedidos.filter(
      (p) => p.estado?.toLowerCase() === "entregado" || p.estado?.toLowerCase() === "liquidado"
    ).length;

    // Calculate pending balance (delivered orders not yet "liquidado")
    const pendingBalance = pedidos
      .filter((p) => p.estado?.toLowerCase() === "entregado" && p.metodo_pago !== "anticipado")
      .reduce((sum, p) => sum + (p.valor_recaudar || 0) - FLETE_COSTO, 0);

    return { totalMonth, deliveredCount, pendingBalance: Math.max(0, pendingBalance) };
  }, [pedidos]);

  // Filter pedidos
  const filteredPedidos = useMemo(() => {
    if (filterNovedades) {
      return pedidos.filter((p) => p.estado?.toLowerCase() === "novedad");
    }
    return pedidos;
  }, [pedidos, filterNovedades]);

  // Count novedades
  const novedadesCount = useMemo(() => {
    return pedidos.filter((p) => p.estado?.toLowerCase() === "novedad").length;
  }, [pedidos]);

  // Calculate delivery attempts (simple count based on estado changes)
  const getDeliveryAttempts = (pedido: Pedido) => {
    if (pedido.estado?.toLowerCase() === "novedad") return "2+";
    if (pedido.estado?.toLowerCase() === "entregado") return "1";
    return "-";
  };

  // Calculate net profit
  const getNetProfit = (pedido: Pedido) => {
    if (pedido.metodo_pago === "anticipado") return 0;
    return (pedido.valor_recaudar || 0) - FLETE_COSTO;
  };

  const handleTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setTrackingError("");
    setIsSearching(true);
    setTrackingResult(null);

    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .ilike("numero_guia", `%${searchQuery.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTrackingResult(data);
      } else {
        setTrackingError(
          "No encontramos tu guía, por favor verifica el número o comunícate con Kompras Plus al 324 222 3825"
        );
      }
    } catch (err) {
      console.error("Error searching:", err);
      setTrackingError("Error al buscar el pedido. Por favor intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getStatusInfo = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "recibido":
      case "pedido recibido":
      case "recibido en bodega":
        return { label: "Recibido en Bodega", step: 2, color: "bg-blue-500 text-white", icon: Box };
      case "pendiente":
        return { label: "Pendiente", step: 1, color: "bg-amber-500 text-white", icon: Clock };
      case "asignado":
        return { label: "Asignado", step: 2, color: "bg-purple-500 text-white", icon: Truck };
      case "en ruta":
      case "en camino":
        return { label: "En Ruta", step: 3, color: "bg-primary text-primary-foreground", icon: Truck };
      case "entregado":
        return { label: "Entregado", step: 4, color: "bg-green-500 text-white", icon: CheckCircle2 };
      case "cancelado":
      case "anulado":
        return { label: "Cancelado", step: 0, color: "bg-destructive text-destructive-foreground", icon: XCircle };
      case "novedad":
        return { label: "Novedad", step: 0, color: "bg-orange-500 text-white", icon: AlertTriangle };
      case "liquidado":
        return { label: "Liquidado", step: 4, color: "bg-emerald-600 text-white", icon: CheckCircle2 };
      default:
        return { label: status || "Pendiente", step: 1, color: "bg-muted text-muted-foreground", icon: Package };
    }
  };

  const canEditOrder = (status: string | null) => {
    return status?.toLowerCase() === "pendiente";
  };

  const statusSteps = [
    { key: 1, label: "Recibido", icon: Package },
    { key: 2, label: "En Bodega", icon: Warehouse },
    { key: 3, label: "En Ruta", icon: Truck },
    { key: 4, label: "Entregado", icon: CheckCircle2 },
  ];

  const getMotorcyclePosition = (step: number) => {
    switch (step) {
      case 1: return 0;
      case 2: return 33;
      case 3: return 66;
      case 4: return 100;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Pure White with Logo */}
      <header className="sticky top-0 z-40 border-b border-border bg-white shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {profile?.full_name || "Cliente"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Support Info */}
        <motion.div
          className="mb-6 flex items-center justify-between rounded-xl bg-white border border-border p-4 shadow-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bodega Central</p>
              <p className="text-sm font-medium text-foreground">{WAREHOUSE_ADDRESS}</p>
            </div>
          </div>
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
            className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{SUPPORT_PHONE}</span>
          </a>
        </motion.div>

        {/* Stats Cards */}
        {activeTab === "history" && (
          <ClientStatsCards
            totalMonth={stats.totalMonth}
            deliveredCount={stats.deliveredCount}
            pendingBalance={stats.pendingBalance}
          />
        )}

        {/* Tabs + Action Buttons */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <History className="h-4 w-4" />
            Mi Historial
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "tracking"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Search className="h-4 w-4" />
            Rastrear Pedido
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "security"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Shield className="h-4 w-4" />
            Seguridad
          </button>

          {/* 3D Style Action Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <motion.button
              onClick={() => setShowNuevoPedido(true)}
              className="relative group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* 3D Background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-700 rounded-b-xl" />
              
              <div className="relative flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 shadow-inner">
                  <Plus className="h-4 w-4" />
                </div>
                <span>Crear Pedido</span>
              </div>
            </motion.button>

            <motion.button
              onClick={() => {
                if (pedidos.length > 0) {
                  setPrintingPedido(pedidos[0]);
                }
              }}
              className="relative group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* 3D Background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 rounded-xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/70 rounded-b-xl" />
              
              <div className="relative flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 shadow-inner">
                  <Download className="h-4 w-4" />
                </div>
                <span className="hidden sm:inline">Descargar Guías</span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* History Tab */}
        {activeTab === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filter bar */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                Historial de Pedidos ({filteredPedidos.length})
              </h2>
              
              <button
                onClick={() => setFilterNovedades(!filterNovedades)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filterNovedades
                    ? "bg-orange-500 text-white"
                    : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
                }`}
              >
                {filterNovedades ? <XCircle className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                Novedades ({novedadesCount})
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPedidos.length === 0 ? (
              <div className="rounded-2xl bg-white border border-border p-8 text-center shadow-card">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  {filterNovedades ? "No tienes pedidos con novedad" : "No tienes pedidos registrados"}
                </p>
                {filterNovedades && (
                  <button
                    onClick={() => setFilterNovedades(false)}
                    className="mt-4 text-sm text-primary font-medium hover:underline"
                  >
                    Ver todos los pedidos
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPedidos.map((pedido, index) => {
                  const statusInfo = getStatusInfo(pedido.estado);
                  const StatusIcon = statusInfo.icon;
                  const isEditable = canEditOrder(pedido.estado);
                  const isNovedad = pedido.estado?.toLowerCase() === "novedad";
                  const netProfit = getNetProfit(pedido);
                  const attempts = getDeliveryAttempts(pedido);

                  return (
                    <motion.div
                      key={pedido.id}
                      className={`rounded-xl bg-white border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                        isNovedad ? "border-orange-300 bg-orange-50/30" : "border-border"
                      }`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      {/* Header with status indicator */}
                      <div className={`px-4 py-2 flex items-center justify-between ${statusInfo.color}`}>
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase">{statusInfo.label}</span>
                        </div>
                        <span className="text-xs font-medium opacity-90">
                          {pedido.numero_guia || `#${pedido.id}`}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Evidence Photo Thumbnail */}
                          {pedido.foto_evidencia ? (
                            <button
                              onClick={() => setEvidencePhoto(pedido.foto_evidencia)}
                              className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors group"
                            >
                              <img
                                src={pedido.foto_evidencia}
                                alt="Evidencia"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Image className="h-5 w-5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}

                          {/* Order Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-foreground truncate">
                                  {pedido.cliente_nombre || "Sin destinatario"}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {pedido.direccion_entrega || "Sin dirección"}
                                </p>
                              </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <RotateCcw className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Intentos:</span>
                                <span className="font-semibold">{attempts}</span>
                              </div>
                              
                              {pedido.metodo_pago !== "anticipado" && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Ganancia:</span>
                                  <span className={`font-bold ${netProfit > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                    ${netProfit.toLocaleString("es-CO")}
                                  </span>
                                </div>
                              )}
                              
                              {pedido.metodo_pago === "anticipado" && (
                                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded">
                                  PAGADO
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Value */}
                          {pedido.valor_recaudar && pedido.metodo_pago !== "anticipado" && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-muted-foreground">A recaudar</p>
                              <p className="text-sm font-bold text-green-600">
                                ${pedido.valor_recaudar.toLocaleString("es-CO")}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Novedad Alert */}
                        {isNovedad && pedido.tipo_novedad && (
                          <div className="mt-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <p className="text-xs text-orange-600 font-medium flex-1">{pedido.tipo_novedad}</p>
                          </div>
                        )}

                        {/* Date & Actions */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            {pedido.fecha_creacion
                              ? new Date(pedido.fecha_creacion).toLocaleDateString("es-CO", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </p>
                          <div className="flex items-center gap-2">
                            {isNovedad && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                                onClick={() => setInstructionsPedido(pedido)}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Responder</span>
                              </Button>
                            )}
                            {isEditable && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1"
                                onClick={() => setEditingPedido(pedido)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 gap-1"
                              onClick={() => setPrintingPedido(pedido)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Guía</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Tracking Tab */}
        {activeTab === "tracking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-lg font-bold text-foreground mb-4">
              Rastrear Pedido
            </h2>

            <form onSubmit={handleTracking} className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Número de guía"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border-2 border-border bg-white py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="rounded-xl bg-primary px-6 py-3 font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Buscar"}
              </button>
            </form>

            <AnimatePresence>
              {trackingError && (
                <motion.div
                  className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <p className="text-sm text-destructive">{trackingError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {trackingResult && (
                <motion.div
                  className="rounded-2xl bg-white border border-border p-6 shadow-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">
                        {trackingResult.numero_guia || `Pedido #${trackingResult.id}`}
                      </h3>
                      <p className="text-muted-foreground">
                        {trackingResult.cliente_nombre || "Cliente"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        getStatusInfo(trackingResult.estado).color
                      }`}
                    >
                      {getStatusInfo(trackingResult.estado).label}
                    </span>
                  </div>

                  {/* Timeline with Motorcycle */}
                  <div className="relative py-10 px-4">
                    {/* Track */}
                    <div className="absolute top-1/2 left-8 right-8 h-2 -translate-y-1/2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${getMotorcyclePosition(getStatusInfo(trackingResult.estado).step)}%`,
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>

                    {/* Motorcycle */}
                    <motion.div
                      className="absolute z-20"
                      style={{ top: "calc(50% - 24px)" }}
                      initial={{ left: "8px" }}
                      animate={{
                        left: `calc(${getMotorcyclePosition(getStatusInfo(trackingResult.estado).step)}% * 0.82 + 8px)`,
                      }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    >
                      <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
                      >
                        <MotorcycleIcon className="w-12 h-8" />
                      </motion.div>
                    </motion.div>

                    {/* Steps */}
                    <div className="relative flex justify-between">
                      {statusSteps.map((step, index) => {
                        const currentStep = getStatusInfo(trackingResult.estado).step;
                        const isCompleted = step.key < currentStep;
                        const isCurrent = step.key === currentStep;
                        const Icon = step.icon;

                        return (
                          <motion.div
                            key={step.key}
                            className="flex flex-col items-center w-16"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                          >
                            <div
                              className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 shadow-sm transition-all ${
                                isCompleted
                                  ? "bg-green-500 text-white border-green-400"
                                  : isCurrent
                                  ? "bg-primary text-white border-primary ring-4 ring-primary/20"
                                  : "bg-white text-muted-foreground border-muted"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-6 w-6" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <p
                              className={`mt-3 text-xs font-bold text-center ${
                                isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {step.label}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="mt-4 rounded-xl bg-primary/10 p-4 border border-primary/20">
                    <p className="text-sm text-foreground">
                      {getStatusInfo(trackingResult.estado).step === 2
                        ? `Tu pedido está siendo procesado en nuestra bodega central en ${WAREHOUSE_ADDRESS}`
                        : getStatusInfo(trackingResult.estado).step === 3
                        ? "Tu pedido está en camino. El motorizado llegará pronto."
                        : getStatusInfo(trackingResult.estado).step === 4
                        ? "¡Tu pedido ha sido entregado exitosamente!"
                        : "Tu pedido ha sido recibido y será procesado pronto."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-md"
          >
            <SecuritySettings />
          </motion.div>
        )}
      </main>

      {/* Modals */}
      <NuevoPedidoModal
        isOpen={showNuevoPedido}
        onClose={() => setShowNuevoPedido(false)}
        onSuccess={fetchPedidos}
        isAdmin={false}
      />

      <EditPedidoModal
        pedido={editingPedido}
        isOpen={!!editingPedido}
        onClose={() => setEditingPedido(null)}
        onSuccess={fetchPedidos}
      />

      <PrintGuiaModal
        pedido={printingPedido}
        isOpen={!!printingPedido}
        onClose={() => setPrintingPedido(null)}
        remitente={profile?.full_name}
      />

      <ClientOrderInstructions
        pedidoId={instructionsPedido?.id || 0}
        numeroGuia={instructionsPedido?.numero_guia || null}
        tipoNovedad={instructionsPedido?.tipo_novedad || null}
        isOpen={!!instructionsPedido}
        onClose={() => setInstructionsPedido(null)}
        onSuccess={fetchPedidos}
      />

      <EvidencePhotoModal
        imageUrl={evidencePhoto}
        isOpen={!!evidencePhoto}
        onClose={() => setEvidencePhoto(null)}
      />
    </div>
  );
};

export default ClienteDashboard;

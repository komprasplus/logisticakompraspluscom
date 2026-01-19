import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import MotorcycleIcon from "@/components/MotorcycleIcon";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import EditPedidoModal from "@/components/EditPedidoModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import SecuritySettings from "@/components/SecuritySettings";
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
}

const SUPPORT_PHONE = "324 222 3825";
const WAREHOUSE_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá";

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
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      // Clients see their own orders (RLS handles this)
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
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
        return { label: "Cancelado", step: 0, color: "bg-destructive text-destructive-foreground", icon: XCircle };
      case "novedad":
        return { label: "Novedad", step: 0, color: "bg-orange-500 text-white", icon: AlertTriangle };
      default:
        return { label: status || "Pendiente", step: 1, color: "bg-muted text-muted-foreground", icon: Package };
    }
  };

  // Check if order can be edited (only "Pendiente" status)
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5">
              <User className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium text-accent-foreground">
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
          className="mb-6 flex items-center justify-between rounded-xl bg-card p-4 shadow-card"
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
            className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{SUPPORT_PHONE}</span>
          </a>
        </motion.div>

        {/* Tabs + New Order Button */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground"
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
                ? "bg-primary text-primary-foreground"
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
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Shield className="h-4 w-4" />
            Seguridad
          </button>
          <button
            onClick={() => setShowNuevoPedido(true)}
            className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Pedido
          </button>
        </div>

        {/* History Tab */}
        {activeTab === "history" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h2 className="text-lg font-bold text-foreground mb-4">
              Historial de Pedidos ({pedidos.length})
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pedidos.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  No tienes pedidos registrados
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pedidos.map((pedido, index) => {
                  const statusInfo = getStatusInfo(pedido.estado);
                  const StatusIcon = statusInfo.icon;
                  const isEditable = canEditOrder(pedido.estado);

                  return (
                    <motion.div
                      key={pedido.id}
                      className="rounded-xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">
                              {pedido.cliente_nombre || "Sin destinatario"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {pedido.direccion_entrega || "Sin dirección"}
                            </p>
                            {pedido.barrio && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📍 {pedido.barrio}
                              </p>
                            )}
                          </div>
                          {pedido.valor_recaudar && pedido.metodo_pago !== "anticipado" && (
                            <div className="text-right ml-3">
                              <p className="text-xs text-muted-foreground">A recaudar</p>
                              <p className="text-sm font-bold text-green-600">
                                ${pedido.valor_recaudar.toLocaleString("es-CO")}
                              </p>
                            </div>
                          )}
                          {pedido.metodo_pago === "anticipado" && (
                            <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded ml-3">
                              PAGADO
                            </div>
                          )}
                        </div>

                        {/* Date & Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-border">
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
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
                  className="w-full rounded-xl border-2 border-border bg-card py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
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
                  className="rounded-2xl bg-card p-6 shadow-card"
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
                                  ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20"
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

      {/* Nuevo Pedido Modal */}
      <NuevoPedidoModal
        isOpen={showNuevoPedido}
        onClose={() => setShowNuevoPedido(false)}
        onSuccess={fetchPedidos}
        isAdmin={false}
      />

      {/* Edit Pedido Modal */}
      <EditPedidoModal
        pedido={editingPedido}
        isOpen={!!editingPedido}
        onClose={() => setEditingPedido(null)}
        onSuccess={fetchPedidos}
      />

      {/* Print Guia Modal */}
      <PrintGuiaModal
        pedido={printingPedido}
        isOpen={!!printingPedido}
        onClose={() => setPrintingPedido(null)}
        remitente={profile?.full_name}
      />
    </div>
  );
};

export default ClienteDashboard;

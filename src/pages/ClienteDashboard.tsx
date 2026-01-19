import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LogOut,
  User,
  MapPin,
  Phone,
  Plus,
  Shield,
  Search,
  Loader2,
  Package,
  Warehouse,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import EditPedidoModal from "@/components/EditPedidoModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import SecuritySettings from "@/components/SecuritySettings";
import ClientOrderInstructions from "@/components/ClientOrderInstructions";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
import MotorcycleIcon from "@/components/MotorcycleIcon";
import ClienteSidebar, { ClienteView } from "@/components/cliente/ClienteSidebar";
import DashboardView from "@/components/cliente/DashboardView";
import PedidosView from "@/components/cliente/PedidosView";
import NovedadesView from "@/components/cliente/NovedadesView";
import ReportesView from "@/components/cliente/ReportesView";
import { AnimatePresence } from "framer-motion";

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
const FLETE_COSTO = 3500;

const ClienteDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ClienteView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [printingPedido, setPrintingPedido] = useState<Pedido | null>(null);
  const [instructionsPedido, setInstructionsPedido] = useState<Pedido | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  
  // Tracking state
  const [searchQuery, setSearchQuery] = useState("");
  const [trackingResult, setTrackingResult] = useState<Pedido | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  
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

    const pendingBalance = pedidos
      .filter((p) => p.estado?.toLowerCase() === "entregado" && p.metodo_pago !== "anticipado")
      .reduce((sum, p) => sum + (p.valor_recaudar || 0) - FLETE_COSTO, 0);

    return { totalMonth, deliveredCount, pendingBalance: Math.max(0, pendingBalance) };
  }, [pedidos]);

  const novedadesCount = useMemo(() => {
    return pedidos.filter((p) => p.estado?.toLowerCase() === "novedad").length;
  }, [pedidos]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
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

  const getStatusInfo = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "recibido":
      case "pedido recibido":
      case "recibido en bodega":
        return { label: "Recibido en Bodega", step: 2 };
      case "pendiente":
        return { label: "Pendiente", step: 1 };
      case "asignado":
        return { label: "Asignado", step: 2 };
      case "en ruta":
      case "en camino":
        return { label: "En Ruta", step: 3 };
      case "entregado":
      case "liquidado":
        return { label: "Entregado", step: 4 };
      default:
        return { label: status || "Pendiente", step: 1 };
    }
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
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white shadow-sm h-16">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
              className="hidden sm:flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Phone className="h-4 w-4" />
              {SUPPORT_PHONE}
            </a>
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
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

      {/* Sidebar */}
      <ClienteSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        novedadesCount={novedadesCount}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
        <div className="p-6 max-w-5xl mx-auto">
          {/* Support Info Banner */}
          <motion.div
            className="mb-6 flex items-center justify-between rounded-xl bg-white border border-border p-4 shadow-sm"
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
            <motion.button
              onClick={() => setShowNuevoPedido(true)}
              className="relative group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-700 rounded-b-xl" />
              <div className="relative flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo Pedido</span>
              </div>
            </motion.button>
          </motion.div>

          {/* Views */}
          <AnimatePresence mode="wait">
            {activeView === "dashboard" && (
              <DashboardView
                key="dashboard"
                totalMonth={stats.totalMonth}
                deliveredCount={stats.deliveredCount}
                pendingBalance={stats.pendingBalance}
                onCreatePedido={() => setShowNuevoPedido(true)}
                onNavigate={setActiveView}
              />
            )}

            {activeView === "pedidos" && (
              <PedidosView
                key="pedidos"
                pedidos={pedidos}
                loading={loading}
                onEdit={setEditingPedido}
                onPrint={setPrintingPedido}
                onRespond={setInstructionsPedido}
                onViewEvidence={setEvidencePhoto}
              />
            )}

            {activeView === "novedades" && (
              <NovedadesView
                key="novedades"
                pedidos={pedidos}
                loading={loading}
                onRespond={setInstructionsPedido}
                onPrint={setPrintingPedido}
                onViewEvidence={setEvidencePhoto}
              />
            )}

            {activeView === "reportes" && (
              <ReportesView key="reportes" pedidos={pedidos} />
            )}
          </AnimatePresence>

          {/* Security Section - Accessible from sidebar could be added or integrated */}
          {/* For now, security is accessible via profile or a dedicated section */}
        </div>
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

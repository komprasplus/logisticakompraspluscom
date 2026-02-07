import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Upload, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePedidosQuery } from "@/hooks/usePedidosQuery";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import EditPedidoModal from "@/components/EditPedidoModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import ClientOrderInstructions from "@/components/ClientOrderInstructions";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
import ClienteSidebar, { ClienteView } from "@/components/cliente/ClienteSidebar";
import ClienteHeader from "@/components/cliente/ClienteHeader";
import DashboardView from "@/components/cliente/DashboardView";
import PedidosView from "@/components/cliente/PedidosView";
import NovedadesView from "@/components/cliente/NovedadesView";
import ReportesView from "@/components/cliente/ReportesView";
import MiTiendaView from "@/components/cliente/MiTiendaView";
import DevolucionesView from "@/components/cliente/DevolucionesView";
import IntegracionesView from "@/components/cliente/IntegracionesView";
import InventarioView from "@/components/cliente/InventarioView";
import HistorialTransaccionesView from "@/components/cliente/HistorialTransaccionesView";
import WarehouseStatus, { checkWarehouseOpen } from "@/components/cliente/WarehouseStatus";
import BulkOrderUploadModal from "@/components/admin/BulkOrderUploadModal";
import { AnimatePresence } from "framer-motion";

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

const SUPPORT_PHONE = "324 222 3825";
const WAREHOUSE_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá";

const ClienteDashboard = () => {
  // Emergency: prioritize order creation/operations over advanced views
  const [activeView, setActiveView] = useState<ClienteView>("pedidos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [printingPedido, setPrintingPedido] = useState<Pedido | null>(null);
  const [instructionsPedido, setInstructionsPedido] = useState<Pedido | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(checkWarehouseOpen());

  const { signOut, profile, user } = useAuth();
  const navigate = useNavigate();

  // Validate user.id exists before fetching - prevents empty panel issues
  const validUserId = user?.id && user.id !== "undefined" ? user.id : undefined;

  // React Query with SWR pattern - shows cached data instantly, refetches in background
  // Added timeout protection and localStorage fallback for connection failures
  const { pedidos, isLoading, isFetching, refetch, error, hasCache } = usePedidosQuery(validUserId);

  // Log errors for debugging but don't crash
  useEffect(() => {
    if (error) {
      console.warn("[ClienteDashboard] Query error:", error);
    }
  }, [error]);

  // Check warehouse status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setIsWarehouseOpen(checkWarehouseOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats - Wallet only shows liquidated orders
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

    // Saldo Disponible: Only liquidated orders count as available balance
    const availableBalance = pedidos
      .filter((p) => p.estado?.toLowerCase() === "liquidado" && p.metodo_pago !== "anticipado")
      .reduce((sum, p) => {
        // Use stored utilidad or calculate from flete
        const utilidad = p.utilidad ?? ((p.valor_recaudar || 0) - (p.valor_flete || 12000));
        return sum + utilidad;
      }, 0);

    // Saldo Pendiente: Entregado but not yet liquidated
    const pendingBalance = pedidos
      .filter((p) => p.estado?.toLowerCase() === "entregado" && p.metodo_pago !== "anticipado")
      .reduce((sum, p) => {
        const utilidad = p.utilidad ?? ((p.valor_recaudar || 0) - (p.valor_flete || 12000));
        return sum + utilidad;
      }, 0);

    return { 
      totalMonth, 
      deliveredCount, 
      pendingBalance: Math.max(0, pendingBalance),
      availableBalance: Math.max(0, availableBalance)
    };
  }, [pedidos]);

  const novedadesCount = useMemo(() => {
    return pedidos.filter((p) => p.estado?.toLowerCase() === "novedad").length;
  }, [pedidos]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Get store info from profile
  const storeName = profile?.store_name || profile?.full_name || "Mi Tienda";
  const logoUrl = (profile as { logo_url?: string })?.logo_url || null;

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Header with Store Branding */}
      <ClienteHeader
        storeName={storeName}
        logoUrl={logoUrl}
        supportPhone={SUPPORT_PHONE}
        onSignOut={handleSignOut}
        isWarehouseOpen={isWarehouseOpen}
      />

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
        className={`pt-[104px] transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          {/* Warehouse Status + Action Buttons */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <WarehouseStatus isOpen={isWarehouseOpen} address={WAREHOUSE_ADDRESS} />
            </div>
            <div className="flex gap-2 sm:w-auto w-full">
              {/* Sync Button - prominent for manual refresh with error feedback */}
              <motion.button
                onClick={() => refetch()}
                disabled={isFetching}
                className={`relative group flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold overflow-hidden flex-1 sm:flex-none border-2 transition-colors ${
                  error && !hasCache
                    ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                    : isFetching 
                      ? "border-muted bg-muted/50 text-muted-foreground cursor-not-allowed" 
                      : "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                }`}
                whileHover={isFetching ? {} : { scale: 1.02 }}
                whileTap={isFetching ? {} : { scale: 0.98 }}
              >
                <RefreshCw className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">
                  {error && !hasCache
                    ? "Reintentar"
                    : isFetching 
                      ? "Sincronizando..." 
                      : "Sincronizar"}
                </span>
              </motion.button>

              {/* Bulk Upload Button */}
              <motion.button
                onClick={() => setShowBulkUpload(true)}
                className="relative group flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold text-primary overflow-hidden flex-1 sm:flex-none border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Upload className="h-5 w-5" />
                <span className="hidden sm:inline">Carga Masiva</span>
              </motion.button>

              {/* New Order Button */}
              <motion.button
                onClick={() => setShowNuevoPedido(true)}
                className="relative group flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold text-primary-foreground overflow-hidden flex-1 sm:flex-none bg-primary shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  <span>Nuevo Pedido</span>
                </div>
              </motion.button>
            </div>
          </div>

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
                loading={isLoading}
                onEdit={setEditingPedido}
                onPrint={setPrintingPedido}
                onRespond={setInstructionsPedido}
                onViewEvidence={setEvidencePhoto}
                error={error}
                hasCache={hasCache}
              />
            )}

            {activeView === "novedades" && (
              <NovedadesView
                key="novedades"
                pedidos={pedidos}
                loading={isLoading}
                onRespond={setInstructionsPedido}
                onPrint={setPrintingPedido}
                onViewEvidence={setEvidencePhoto}
                onRefresh={refetch}
              />
            )}

            {activeView === "reportes" && (
              <ReportesView key="reportes" pedidos={pedidos} />
            )}

            {activeView === "tienda" && (
              <MiTiendaView key="tienda" />
            )}

            {activeView === "devoluciones" && (
              <DevolucionesView key="devoluciones" pedidos={pedidos} loading={isLoading} />
            )}

            {activeView === "integraciones" && user?.id && (
              <IntegracionesView key="integraciones" clientUserId={user.id} />
            )}

            {activeView === "inventario" && (
              <InventarioView key="inventario" />
            )}

            {activeView === "billetera" && (
              <HistorialTransaccionesView key="billetera" />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <NuevoPedidoModal
        isOpen={showNuevoPedido}
        onClose={() => setShowNuevoPedido(false)}
        onSuccess={refetch}
        isAdmin={false}
      />

      <EditPedidoModal
        pedido={editingPedido}
        isOpen={!!editingPedido}
        onClose={() => setEditingPedido(null)}
        onSuccess={refetch}
      />

      <PrintGuiaModal
        pedido={printingPedido}
        isOpen={!!printingPedido}
        onClose={() => setPrintingPedido(null)}
        remitente={storeName}
      />

      <ClientOrderInstructions
        pedidoId={instructionsPedido?.id || 0}
        numeroGuia={instructionsPedido?.numero_guia || null}
        tipoNovedad={instructionsPedido?.tipo_novedad || null}
        isOpen={!!instructionsPedido}
        onClose={() => setInstructionsPedido(null)}
        onSuccess={refetch}
      />

      <EvidencePhotoModal
        imageUrl={evidencePhoto}
        isOpen={!!evidencePhoto}
        onClose={() => setEvidencePhoto(null)}
      />

      <BulkOrderUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={() => {
          refetch();
          setActiveView("pedidos");
        }}
        clientUserId={user?.id}
        storeName={storeName}
      />
    </div>
  );
};

export default ClienteDashboard;

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { playGlobalNotificationPing } from "@/hooks/useNotificationSound";
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
  Pencil,
  Upload,
  CalendarCheck,
  Banknote,
  Wallet,
} from "lucide-react";
 import { TrendingUp, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
const logo = "/logo-oficial.png";
import AdminMapGoogle from "@/components/AdminMapGoogle";
import AuditOrdersPanel from "@/components/admin/AuditOrdersPanel";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import CriticalErrorBoundary from "@/components/CriticalErrorBoundary";

import AdminSidebar from "@/components/AdminSidebar";
import NovedadesPanel from "@/components/NovedadesPanel";
import NovedadCompactCard from "@/components/NovedadCompactCard";
import FleetMonitor from "@/components/FleetMonitor";
import Map3DCalendarButton from "@/components/Map3DCalendarButton";
import CreateUserModal from "@/components/CreateUserModal";
import ResetUserPasswordModal from "@/components/ResetUserPasswordModal";
import DeleteUserModal from "@/components/DeleteUserModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import NuevoPedidoModal from "@/components/NuevoPedidoModal";
import QRScannerModal from "@/components/QRScannerModal";
import PedidoDetailModal from "@/components/PedidoDetailModal";
import PrintGuiaModal from "@/components/PrintGuiaModal";
import BulkPrintGuiasModal from "@/components/BulkPrintGuiasModal";
import ManifiestoModal from "@/components/cliente/ManifiestoModal";
import ManifiestoRutaModal from "@/components/admin/ManifiestoRutaModal";

import StoreLiquidacionesPanel from "@/components/StoreLiquidacionesPanel";
 import DropiLiquidacionPanel from "@/components/admin/DropiLiquidacionPanel";
import IntegrationsPanel from "@/components/admin/IntegrationsPanel";
import AdminFinanzasPanel from "@/components/admin/AdminFinanzasPanel";
const AdminWalletDashboard = lazy(() => import("@/components/admin/AdminWalletDashboard"));
import MonitorFlexPanel from "@/components/admin/MonitorFlexPanel";
const WebhookMonitorDashboard = lazy(() => import("@/components/admin/WebhookMonitorDashboard"));
const LiquidacionAliadosPanel = lazy(() => import("@/components/admin/LiquidacionAliadosPanel"));
const ManifiestoScannerView = lazy(() => import("@/components/admin/ManifiestoScannerView"));
const ManifiestosListView = lazy(() => import("@/components/admin/ManifiestosListView"));
const SolicitudesRegistroPanel = lazy(() => import("@/components/admin/SolicitudesRegistroPanel"));
import FlexReceptionScanner from "@/components/admin/FlexReceptionScanner";
import MeliFlexScannerModal from "@/components/admin/MeliFlexScannerModal";
import AdminReportesPanel from "@/components/AdminReportesPanel";
import UserCardsGrid from "@/components/UserCardsGrid";
import UserManagementTabs from "@/components/UserManagementTabs";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getStatusConfig, ALL_STATUSES, isOperationalStatus } from "@/lib/orderStatuses";
import AdminNotesInput from "@/components/AdminNotesInput";
const AdminControlTowerEmbed = lazy(() => import("@/pages/AdminControlTower"));
import QuickReassignPopover from "@/components/admin/QuickReassignPopover";
import BulkReassignModal from "@/components/admin/BulkReassignModal";
import AssignCarrierModal from "@/components/admin/AssignCarrierModal";
import BulkOrderUploadModal from "@/components/admin/BulkOrderUploadModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import WarehouseInventoryPanel from "@/components/admin/WarehouseInventoryPanel";
import { useAdminSearch } from "@/hooks/useAdminSearch";
import { useAdminPedidos, type DateRange, getDefaultDateRange } from "@/hooks/useAdminPedidos";
import { useAdminSupportData } from "@/hooks/useAdminSupportData";
import DateRangeFilter from "@/components/admin/DateRangeFilter";
import EditStoreModal from "@/components/EditStoreModal";
import DeliveryDateBadge from "@/components/DeliveryDateBadge";
import FutureDateConfirmDialog from "@/components/FutureDateConfirmDialog";
import RecaudoPanel from "@/components/admin/RecaudoPanel";
const SuperAdminMasterEmbed = lazy(() => import("@/components/admin/SuperAdminPanel"));
import {
  isFutureDeliveryDate,
  isTodayOrPastDeliveryDate,
  compareDeliveryDates,
} from "@/lib/dateUtils";

// --- Emergency kill-switches (temporary) ---
const EMERGENCY_DISABLE_ADMIN_SOUND = true;

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
  aliado_logistico?: string | null;
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
  fulfillment_rate?: number | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

const AdminDashboard = () => {
  // ============ ALL HOOKS AT TOP - CRITICAL FOR REACT ============
  const { signOut, profile, role: userRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Server-side paginated pedidos hook
  const {
    pedidos,
    isLoading: loading,
    isFetching,
    error: pedidosError,
    dateRange,
    changeDateRange,
    updatePedidoLocally,
    forceRefresh: fetchPedidos,
    totalLoaded,
    serverPage,
    totalServerPages,
    totalCount,
    goToServerPage,
    pageSize,
  } = useAdminPedidos();

  // Server-side universal search
  const { searchResults, isSearching, searchOrders, clearSearch } = useAdminSearch();

  // Centralized supporting data via React Query (replaces raw useEffect fetches)
  const {
    users,
    motorizados,
    clientProfiles,
    userRoles,
    refreshAll: refreshSupportData,
  } = useAdminSupportData();

  // UI state
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const isAliado = userRole === "aliado_logistico";
  const [activeSection, setActiveSection] = useState<string>(isAliado ? "despachos" : "analytics");
  // Sub-tab state for consolidated sections
  const [despachosTab, setDespachosTab] = useState<string>("todos");
  const [tesoreriaTab, setTesoreriaTab] = useState<string>("liquidaciones");
  const [monitoreoTab, setMonitoreoTab] = useState<string>("webhook");
  const [configuracionTab, setConfiguracionTab] = useState<string>("usuarios");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [municipioFilter, setMunicipioFilter] = useState<string>("todos");
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string>("todos");
  const [storeFilter, setStoreFilter] = useState<string>("todos");
  const [todayOnlyFilter, setTodayOnlyFilter] = useState(false);
  const [bodegaFilter, setBodegaFilter] = useState<string>("todos");

  // Org names map for cross-tenant aliado view
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isAliado) return;
    supabase.from("organizaciones").select("id, nombre").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(o => { map[o.id] = o.nombre; });
        setOrgNames(map);
      }
    });
  }, [isAliado]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showFlexScanner, setShowFlexScanner] = useState(false);
  const [showMeliFlexScanner, setShowMeliFlexScanner] = useState(false);
  const [mapDateFilter, setMapDateFilter] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isServerSearchActive, setIsServerSearchActive] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<Profile | null>(null);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [selectedPedidoForCancel, setSelectedPedidoForCancel] = useState<Pedido | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPedidoForDetail, setSelectedPedidoForDetail] = useState<Pedido | null>(null);
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
  const [showEditPedido, setShowEditPedido] = useState(false);
  const [selectedPedidoForEdit, setSelectedPedidoForEdit] = useState<Pedido | null>(null);
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [showAssignCarrier, setShowAssignCarrier] = useState(false);
  const [showEditStore, setShowEditStore] = useState(false);
  const [selectedStoreForEdit, setSelectedStoreForEdit] = useState<Profile | null>(null);
  const [showFutureDateConfirm, setShowFutureDateConfirm] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ pedidoId: number; motorizadoUserId: string; pedido: Pedido } | null>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showRecaudoPanel, setShowRecaudoPanel] = useState(false);
  const [showManifiestoModal, setShowManifiestoModal] = useState(false);
  const [showManifiestoRutaModal, setShowManifiestoRutaModal] = useState(false);

  // Refs for preventing race conditions
  const isMountedRef = useRef(true);

  // Cleanup ref on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Display pedidos — server search results override filtered list
  const displayPedidos = isServerSearchActive && searchResults.length > 0 
    ? searchResults as Pedido[]
    : filteredPedidos;

  // normalizePedido helper
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

  // Memoized filter function to prevent unnecessary re-renders
  const filterPedidos = useCallback(() => {
    try {
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

      if (municipioFilter !== "todos") {
        filtered = filtered.filter((p) => p.municipio === municipioFilter);
      }

      if (metodoPagoFilter !== "todos") {
        filtered = filtered.filter((p) => p.metodo_pago === metodoPagoFilter);
      }

      if (storeFilter !== "todos") {
        filtered = filtered.filter((p) => {
          if (!p.client_user_id) return false;
          const profile = clientProfiles[p.client_user_id];
          const storeName = profile?.store_name || profile?.full_name || "";
          return storeName === storeFilter;
        });
      }

      // Bodega filter for aliado cross-tenant view
      if (bodegaFilter !== "todos") {
        filtered = filtered.filter((p: any) => p.organizacion_id === bodegaFilter);
      }

      // Filter for "Ver solo para hoy" - only show orders with fecha_entrega = today or past
      if (todayOnlyFilter) {
        filtered = filtered.filter((p) => isTodayOrPastDeliveryDate(p.fecha_entrega));
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.numero_guia?.toLowerCase().includes(query) ||
            p.cliente_nombre?.toLowerCase().includes(query) ||
            p.motorizado_asignado?.toLowerCase().includes(query) ||
            p.municipio?.toLowerCase().includes(query) ||
            p.barrio?.toLowerCase().includes(query)
        );
      }

      // Sort by fecha_creacion descending (newest first)
      filtered.sort((a, b) => {
        const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return dateB - dateA;
      });

      setFilteredPedidos(filtered);
    } catch (error) {
      console.error("Error filtering pedidos:", error);
      setFilteredPedidos([]);
    }
  }, [pedidos, statusFilter, municipioFilter, metodoPagoFilter, storeFilter, bodegaFilter, todayOnlyFilter, searchQuery, clientProfiles]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterPedidos();
  }, [filterPedidos]);

  // Initiate assignment - check for future date first
  const initiateAssignMotorizado = (pedidoId: number, motorizadoUserId: string) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    // Check if fecha_entrega is in the future
    if (isFutureDeliveryDate(pedido.fecha_entrega)) {
      setPendingAssignment({ pedidoId, motorizadoUserId, pedido });
      setShowFutureDateConfirm(true);
    } else {
      assignMotorizado(pedidoId, motorizadoUserId);
    }
  };

  // Actual assignment function
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

      // Optimistic update
      updatePedidoLocally(pedidoId, {
        motorizado_asignado: motorizado.full_name,
        motorizado_id: motorizadoUserId,
        estado: "Asignado",
      });

      toast.success(`Pedido asignado a ${motorizado.full_name}`);
    } catch (error) {
      console.error("Error assigning motorizado:", error);
      toast.error("Error al asignar motorizado");
    } finally {
      setAssigningPedido(null);
    }
  };

  // Assign carrier ally (Gomilla, Jamv Drive, Derocha)
  const ALIADOS_LOGISTICOS = ["Gomilla", "Jamv Drive", "Derocha"] as const;
  const assignAliadoLogistico = async (pedidoId: number, aliado: string) => {
    const value = aliado || null;
    // Optimistic update first
    updatePedidoLocally(pedidoId, { aliado_logistico: value });
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ aliado_logistico: value, fecha_actualizacion: new Date().toISOString() })
        .eq("id", pedidoId);
      if (error) throw error;
      toast.success(value ? `Aliado asignado: ${value}` : "Aliado removido");
    } catch (err) {
      console.error("Error assigning aliado:", err);
      toast.error("Error al asignar aliado logístico");
    }
  };

  // Handle confirmation of future date assignment
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

      // Optimistic updates for bulk
      selectedForBulk.forEach((id) => {
        updatePedidoLocally(id, {
          motorizado_asignado: motorizado.full_name,
          motorizado_id: motorizadoUserId,
          estado: "Asignado",
        });
      });

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

  // Check if order can have guide printed (only 'Recibido en Bodega' or 'Asignado')
  const canPrintGuia = (pedido: Pedido) => {
    const estado = pedido.estado?.toLowerCase();
    return estado === "recibido en bodega" || estado === "asignado";
  };

  // Get selectable orders on current view (server already paginates)
  const getSelectableOrdersOnPage = useCallback(() => {
    return displayPedidos.filter(
      (p) =>
        p.estado?.toLowerCase() !== "anulado" &&
        p.estado?.toLowerCase() !== "entregado" &&
        p.estado?.toLowerCase() !== "liquidado"
    );
  }, [displayPedidos]);

  // Check if all selectable items on current page are selected
  const allPageSelected = useCallback(() => {
    const selectable = getSelectableOrdersOnPage();
    if (selectable.length === 0) return false;
    return selectable.every((p) => selectedForBulk.includes(p.id));
  }, [getSelectableOrdersOnPage, selectedForBulk]);

  // Toggle select all on current page
  const toggleSelectAllPage = () => {
    const selectable = getSelectableOrdersOnPage();
    if (allPageSelected()) {
      // Deselect all on current page
      const pageIds = selectable.map((p) => p.id);
      setSelectedForBulk((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      // Select all on current page
      const pageIds = selectable.map((p) => p.id);
      setSelectedForBulk((prev) => [...new Set([...prev, ...pageIds])]);
    }
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

      // Optimistic updates
      pedidoIds.forEach((id) => {
        updatePedidoLocally(id, {
          guia_impresa: true,
          guia_impresa_at: new Date().toISOString(),
        });
      });

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

  // Handle bulk print from selection
  const handleBulkPrintFromSelection = () => {
    if (selectedForBulk.length === 0) {
      toast.error("Selecciona al menos 1 pedido para imprimir");
      return;
    }
    // Filter to only printable orders
    const printableIds = selectedForBulk.filter((id) => {
      const pedido = pedidos.find((p) => p.id === id);
      return pedido && canPrintGuia(pedido);
    });
    if (printableIds.length === 0) {
      toast.error("Ninguno de los pedidos seleccionados puede imprimirse (deben estar en 'Recibido en Bodega' o 'Asignado')");
      return;
    }
    setSelectedForPrint(printableIds);
    setShowBulkPrint(true);
  };

  // Handle bulk print completion
  const handleBulkPrintComplete = async (pedidoIds: number[]) => {
    await markGuiasAsPrinted(pedidoIds);
    setShowBulkPrint(false);
    setSelectedForPrint([]);
    setSelectedForBulk([]);
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

      // Optimistic update
      updatePedidoLocally(pedidoId, { estado: "Anulado" });

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

  const uniqueMunicipios = [...new Set(pedidos.map((p) => p.municipio).filter(Boolean))].sort();

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

  const renderSectionById = (sectionId: string): React.ReactNode => {
    switch (sectionId) {
      case "analytics":
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <AdminControlTowerEmbed />
          </Suspense>
        );

      case "mapa":
        // Filter pedidos for map by selected date
        const mapFilteredPedidos = mapDateFilter 
          ? filteredPedidos.filter((p) => {
              if (!p.fecha_entrega) return false;
              const selectedDateStr = mapDateFilter.toISOString().split('T')[0];
              return p.fecha_entrega === selectedDateStr;
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

            {/* Date indicator when historical */}
            {mapDateFilter && (
              <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 text-sm text-primary font-medium">
                📅 Mostrando entregas del: {mapDateFilter.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <span className="ml-2 text-muted-foreground">({mapFilteredPedidos.length} pedidos)</span>
              </div>
            )}
            
            {/* Map with Fleet Monitor sidebar */}
            <div className="flex-1 flex relative min-h-[500px]">
              {/* Main Map with Error Boundary */}
              <div className="flex-1 relative">
                <MapErrorBoundary fallbackMessage="El mapa tuvo un problema. Esto puede deberse a un error de carga de datos de ubicación.">
                  <AdminMapGoogle 
                    pedidos={mapFilteredPedidos}
                    selectedDate={mapDateFilter}
                    onPedidoClick={(p) => setSelectedPedido(p as Pedido)}
                    onMotorizadoClick={(m) => {
                      toast.info(`🏍️ ${m.full_name} - ${m.activeOrders || 0} pedidos activos`, { duration: 3000 });
                    }}
                    selectedPedidoId={selectedPedido?.id}
                  />
                </MapErrorBoundary>
                
                {/* 3D Calendar Button - Floating on map top-right */}
                <div className="absolute top-4 right-4 z-[500]">
                  <Map3DCalendarButton
                    selectedDate={mapDateFilter}
                    onDateChange={setMapDateFilter}
                  />
                </div>
              </div>
              
              {/* Fleet Monitor Sidebar - hidden on mobile */}
              <div className="hidden lg:block w-72 border-l border-border bg-card p-3 overflow-y-auto">
                <FleetMonitor 
                  onMotorizadoClick={(m) => {
                    // Could center map on motorizado location
                    toast.info(`📍 ${m.full_name} - ${m.is_online ? "En línea" : "Desconectado"}`);
                  }}
                />
              </div>
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
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={() => setShowNuevoPedido(true)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Pedido
                </button>
                <Button
                  onClick={() => fetchPedidos()}
                  variant="outline"
                  size="sm"
                  disabled={loading || isFetching}
                  className="gap-1.5"
                >
                  <RotateCcw className={`h-4 w-4 ${(loading || isFetching) ? "animate-spin" : ""}`} />
                  Refrescar
                </Button>
                <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Carga Masiva
                </Button>
                <Button onClick={() => setShowQRScanner(true)} variant="secondary" className="gap-2">
                  <ScanLine className="h-4 w-4" />
                  Escanear QR
                </Button>
                <Button onClick={() => setShowRecaudoPanel(true)} variant="outline" className="gap-2">
                  <Banknote className="h-4 w-4" />
                  Control de Recaudo
                </Button>
              </div>

              {/* Search - with server-side fallback for universal lookup */}
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar guía, cliente o teléfono (Enter = buscar en toda la BD)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      // Clear server search when input changes
                      if (isServerSearchActive && e.target.value.length < 2) {
                        setIsServerSearchActive(false);
                        clearSearch();
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && searchQuery.trim().length >= 2) {
                        // Trigger server-side search
                        setIsServerSearchActive(true);
                        await searchOrders(searchQuery);
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {isServerSearchActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsServerSearchActive(false);
                      setSearchQuery("");
                      clearSearch();
                    }}
                  >
                    ✕ Limpiar
                  </Button>
                )}
                {isSearching && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
              </div>

              {/* Server search results banner */}
              {isServerSearchActive && searchResults.length > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                  <Search className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">
                    {searchResults.length} resultado(s) en toda la base de datos
                  </span>
                  <span className="text-muted-foreground">
                    (ignorando filtros locales)
                  </span>
                </div>
              )}

              {/* Compact Filters Bar */}
              {(() => {
                const activeFilterCount = [
                  statusFilter !== "todos",
                  municipioFilter !== "todos",
                  metodoPagoFilter !== "todos",
                  storeFilter !== "todos",
                  bodegaFilter !== "todos",
                  todayOnlyFilter,
                ].filter(Boolean).length;

                return (
                  <div className="flex flex-wrap gap-2 items-center">

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFiltersSheet(true)}
                      className="gap-2 relative"
                    >
                      <Filter className="h-4 w-4" />
                      Filtros Avanzados
                      {activeFilterCount > 0 && (
                        <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary text-primary-foreground">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>

                    {/* Date Range Filter - always visible */}
                    <DateRangeFilter
                      value={dateRange}
                      onChange={changeDateRange}
                      disabled={loading || isFetching}
                    />

                    {/* Server-side pagination indicator */}
                    {totalCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Página {serverPage}/{totalServerPages} · {totalCount} pedidos totales
                      </span>
                    )}

                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setStatusFilter("todos"); setMunicipioFilter("todos"); setMetodoPagoFilter("todos"); setStoreFilter("todos"); setBodegaFilter("todos"); setTodayOnlyFilter(false); }}
                        className="text-sm text-primary hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Filters Sheet (Drawer) */}
              <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
                <SheetContent side="right" className="w-[340px] sm:w-[400px] flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-primary" />
                      Filtros Avanzados
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto space-y-6 py-4">
                    {/* Estado */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Estado</Label>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
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
                    </div>

                    {/* Ciudad / Municipio */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ciudad / Municipio</Label>
                      <select value={municipioFilter} onChange={(e) => setMunicipioFilter(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="todos">Todos los municipios</option>
                        {uniqueMunicipios.map((m, idx) => (
                          <option key={m || `mun-${idx}`} value={m || ""}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Método de Pago */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Método de Pago</Label>
                      <select value={metodoPagoFilter} onChange={(e) => setMetodoPagoFilter(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="todos">Todos los pagos</option>
                        <option value="efectivo">Contra Entrega</option>
                        <option value="anticipado">Pago Anticipado</option>
                      </select>
                    </div>

                    {/* Tienda */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tienda</Label>
                      <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="todos">Todas las tiendas</option>
                        {Object.values(clientProfiles).map((profile, idx) => (
                          <option key={idx} value={profile.store_name || profile.full_name}>{profile.store_name || profile.full_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bodega / Origen - only for aliados */}
                    {isAliado && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Bodega / Origen</Label>
                        <select value={bodegaFilter} onChange={(e) => setBodegaFilter(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value="todos">Todas las bodegas</option>
                          {Object.entries(orgNames).map(([id, nombre]) => (
                            <option key={id} value={id}>{nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Ver solo para hoy */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Fecha de entrega</Label>
                      <button
                        onClick={() => setTodayOnlyFilter(!todayOnlyFilter)}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          todayOnlyFilter
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:bg-muted"
                        }`}
                      >
                        <CalendarCheck className="h-4 w-4" />
                        Ver solo para hoy
                      </button>
                    </div>
                  </div>

                  <SheetFooter className="flex-row gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                         setStatusFilter("todos");
                        setMunicipioFilter("todos");
                        setMetodoPagoFilter("todos");
                        setStoreFilter("todos");
                        setBodegaFilter("todos");
                        setTodayOnlyFilter(false);
                      }}
                    >
                      Limpiar Filtros
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setShowFiltersSheet(false)}
                    >
                      Aplicar Filtros
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              {/* Recaudo Panel */}
              <RecaudoPanel
                open={showRecaudoPanel}
                onOpenChange={setShowRecaudoPanel}
                pedidos={pedidos}
              />

              {/* Dynamic Selection Bar - only visible when items selected */}
              {selectedForBulk.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-primary/10 border-2 border-primary/40 shadow-sm">
                  <Package className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{selectedForBulk.length} pedido(s) seleccionado(s)</span>
                  
                  {/* Print Selection Button - highlighted */}
                  <Button
                    size="sm"
                    onClick={handleBulkPrintFromSelection}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir Selección
                  </Button>
                  
                  {/* Transfer to Motorizado */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkAssigning}
                    onClick={() => setShowBulkReassign(true)}
                    className="gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Transferir a Motorizado
                  </Button>

                  {/* Asignar Proveedor Logístico (3PL/4PL) */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkAssigning}
                    onClick={() => setShowAssignCarrier(true)}
                    className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Truck className="h-4 w-4" />
                    Asignar Proveedor Logístico
                  </Button>

                  {/* Generar Manifiesto de Recogida */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowManifiestoModal(true)}
                    className="gap-2 border-amber-400/60 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <FileCheck className="h-4 w-4" />
                    Generar Manifiesto
                  </Button>

                  <button onClick={() => setSelectedForBulk([])} className="text-sm text-muted-foreground hover:text-foreground">
                    Cancelar selección
                  </button>
                </div>
              )}

              {filteredPedidos.filter((p) => !p.motorizado_asignado).length > 0 && selectedForBulk.length === 0 && (
                <button onClick={selectAllUnassigned} className="text-sm text-primary hover:underline">
                  Seleccionar todos sin asignar ({filteredPedidos.filter((p) => !p.motorizado_asignado).length})
                </button>
              )}
            </div>

            {/* Orders Table */}
            {pedidosError && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-destructive">Problema al cargar pedidos</div>
                  <div className="text-muted-foreground">La conexion fallo. Intenta forzar una recarga.</div>
                </div>
                <Button onClick={() => fetchPedidos()} variant="destructive" size="sm" className="gap-1.5 shrink-0">
                  <RotateCcw className="h-4 w-4" />
                  Forzar Recarga
                </Button>
              </div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-sm text-muted-foreground">Cargando datos...</div>
              </div>
            ) : (
              <div className="rounded-xl bg-card shadow-card overflow-hidden">
                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-3 pb-2 border-b border-border scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {[
                    { key: "todos", label: "Todos", count: stats.total, icon: "📋" },
                    { key: "sin_asignar", label: "Sin Asignar", count: stats.unassigned, icon: "⚠️" },
                    { key: "recibido en bodega", label: "En Bodega", count: operationalPedidos.filter(p => p.estado?.toLowerCase() === "recibido en bodega").length, icon: "📦" },
                    { key: "asignado", label: "Asignados", count: operationalPedidos.filter(p => p.estado?.toLowerCase() === "asignado").length, icon: "✔️" },
                    { key: "en ruta", label: "En Ruta", count: stats.inTransit, icon: "🚚" },
                    { key: "entregado", label: "Entregados", count: stats.delivered, icon: "✅" },
                    { key: "novedad", label: "Novedades", count: stats.novedad, icon: "🔔" },
                    { key: "liquidado", label: "Liquidados", count: stats.liquidado, icon: "💰" },
                    { key: "anulado", label: "Anulados", count: stats.cancelled, icon: "🚫" },
                  ].filter(tab => tab.key === "todos" || tab.count > 0).map((tab) => {
                    const isActive = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span className="whitespace-nowrap">{tab.label}</span>
                        <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          isActive ? "bg-white/20 text-primary-foreground" : "bg-background text-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        {/* Select All Checkbox */}
                        <th className="px-2 py-3 text-left w-10">
                          <input 
                            type="checkbox" 
                            checked={allPageSelected()} 
                            onChange={toggleSelectAllPage}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            title="Seleccionar todo en esta página"
                          />
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Guía</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Cliente</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden xl:table-cell">Tienda</th>
                        {isAliado && <th className="px-3 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Bodega</th>}
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden sm:table-cell">Destino</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden md:table-cell">Pago</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground hidden lg:table-cell">F. Entrega</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Motorizado</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Aliado</th>
                        <th className="px-3 py-3 text-left font-semibold text-foreground text-xs sm:text-sm">Estado</th>
                        <th className="px-2 py-3 text-center font-semibold text-foreground text-xs sm:text-sm w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayPedidos.map((pedido) => {
                        const isPendingAssignment = !pedido.motorizado_asignado;
                        const isSelected = selectedForBulk.includes(pedido.id);
                        const isCancelled = pedido.estado?.toLowerCase() === "anulado";
                        const canCancel = !isCancelled && pedido.estado?.toLowerCase() !== "entregado" && pedido.estado?.toLowerCase() !== "liquidado";
                        const isSelectable = !isCancelled && pedido.estado?.toLowerCase() !== "entregado" && pedido.estado?.toLowerCase() !== "liquidado";
                        const isGuiaImpresa = pedido.guia_impresa;
                        
                        // SLA Traffic Light logic
                        const isActiveNovedad = pedido.estado?.toLowerCase() === "novedad";
                        const lastUpdate = pedido.fecha_actualizacion || pedido.fecha_creacion;
                        const hoursSinceUpdate = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60) : 0;
                        const isFinished = ["entregado", "liquidado", "anulado", "devolución"].includes(pedido.estado?.toLowerCase() || "");
                        const slaRed = !isFinished && (isActiveNovedad || hoursSinceUpdate >= 24);
                        const slaOrange = !isFinished && !slaRed && hoursSinceUpdate >= 12;
                        
                        const slaRowClass = slaRed
                          ? "bg-red-100 dark:bg-red-950/40 border-l-4 border-l-red-500"
                          : slaOrange
                          ? "bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-400"
                          : "";
                        
                        return (
                          <tr key={pedido.id} className={`hover:bg-muted/30 transition-colors ${slaRowClass} ${isPendingAssignment && !isCancelled && !slaRed && !slaOrange ? "bg-amber-50 dark:bg-amber-950/20" : ""} ${isSelected ? "bg-primary/10" : ""} ${isCancelled ? "opacity-60" : ""}`}>
                            {/* Unified checkbox for selection */}
                            <td className="px-2 py-3">
                              {isSelectable && (
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
                            <td className="px-3 py-3 hidden xl:table-cell">
                              {pedido.client_user_id && clientProfiles[pedido.client_user_id] ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                  <Store className="h-3 w-3" />
                                  {clientProfiles[pedido.client_user_id].store_name || clientProfiles[pedido.client_user_id].full_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </td>
                            {isAliado && (
                              <td className="px-3 py-3 hidden lg:table-cell">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-muted text-foreground">
                                  <Warehouse className="h-3 w-3" />
                                  {orgNames[(pedido as any).organizacion_id] || "Sin org"}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <div className="flex flex-col">
                                <span className="inline-flex items-center gap-1">
                                  <MapPinned className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-semibold text-foreground">{pedido.municipio || pedido.zona || "-"}</span>
                                </span>
                                {pedido.barrio && (
                                  <span className="text-[11px] text-muted-foreground ml-4">{pedido.barrio}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pedido.metodo_pago === "anticipado" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                {pedido.metodo_pago === "anticipado" ? "Anticipado" : "Contra Entrega"}
                              </span>
                            </td>
                            {/* Fecha Entrega Column */}
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <DeliveryDateBadge fechaEntrega={pedido.fecha_entrega} />
                            </td>
                            <td className="px-3 py-3 text-xs sm:text-sm">
                              {isCancelled ? (
                                <span className="text-muted-foreground">-</span>
                              ) : isPendingAssignment && isFinished ? (
                                <span className="text-muted-foreground italic text-xs">No registrado</span>
                              ) : isPendingAssignment ? (
                                <select
                                  disabled={assigningPedido === pedido.id}
                                  onChange={(e) => { if (e.target.value) initiateAssignMotorizado(pedido.id, e.target.value); }}
                                  className="w-full min-w-[120px] rounded-lg border-2 border-amber-400 bg-card px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                                  defaultValue=""
                                >
                                  <option value="" disabled>{assigningPedido === pedido.id ? "Asignando..." : "⚠️ Asignar"}</option>
                                  {/* Suggested motorizados first (same zone) */}
                                  {pedido.zona && motorizados.some(m => {
                                    const mZoneOrders = pedidos.filter(p => p.motorizado_id === m.user_id && p.zona === pedido.zona && isOperationalStatus(p.estado));
                                    return mZoneOrders.length > 0;
                                  }) && (
                                    <optgroup label={`⭐ Sugeridos (Zona ${pedido.zona})`}>
                                      {motorizados
                                        .filter(m => pedidos.some(p => p.motorizado_id === m.user_id && p.zona === pedido.zona && isOperationalStatus(p.estado)))
                                        .map((m) => {
                                          const zoneCount = pedidos.filter(p => p.motorizado_id === m.user_id && p.zona === pedido.zona && isOperationalStatus(p.estado)).length;
                                          return <option key={`sug-${m.id}`} value={m.user_id}>⭐ {m.full_name} ({zoneCount} en zona)</option>;
                                        })}
                                    </optgroup>
                                  )}
                                  <optgroup label="Todos los motorizados">
                                    {motorizados.map((m) => (<option key={m.id} value={m.user_id}>{m.full_name}</option>))}
                                  </optgroup>
                                </select>
                              ) : (
                                <span className="text-muted-foreground">{pedido.motorizado_asignado}</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={pedido.aliado_logistico ?? ""}
                                onChange={(e) => assignAliadoLogistico(pedido.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={`min-w-[110px] rounded-lg border px-2 py-1.5 text-xs font-medium bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 ${pedido.aliado_logistico ? "border-primary/40 text-foreground" : "border-dashed border-border text-muted-foreground"}`}
                              >
                                <option value="">Sin asignar</option>
                                {ALIADOS_LOGISTICOS.map((a) => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3"><StatusBadge status={pedido.estado} /></td>
                            <td className="px-2 py-3 text-center">
                              <TooltipProvider delayDuration={200}>
                                <div className="flex items-center justify-center gap-1">
                                  {/* Edit Button */}
                                  {!isCancelled && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => {
                                            setSelectedPedidoForEdit(pedido);
                                            setShowEditPedido(true);
                                          }}
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-600 transition-colors"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar pedido</TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  {/* Detail Button - moved before printer */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => {
                                          setSelectedPedidoForDetail(pedido);
                                          setShowDetailModal(true);
                                        }}
                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver detalle</TooltipContent>
                                  </Tooltip>

                                  {/* Print/Reprint Button - always available for non-cancelled */}
                                  {!isCancelled && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => handlePrintGuia(pedido)}
                                          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
                                            isGuiaImpresa 
                                              ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                              : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-600"
                                          }`}
                                        >
                                          <Printer className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>{isGuiaImpresa ? "Re-imprimir Guía" : "Imprimir Guía"}</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Cancel Button */}
                                  {canCancel && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => {
                                            setSelectedPedidoForCancel(pedido);
                                            setShowCancelOrder(true);
                                          }}
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                        >
                                          <Ban className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Anular pedido</TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  {/* Reassign Button */}
                                  {!isCancelled && (
                                    <QuickReassignPopover
                                      pedidoId={pedido.id}
                                      currentMotorizadoId={pedido.motorizado_id}
                                      currentMotorizadoName={pedido.motorizado_asignado}
                                      currentStatus={pedido.estado}
                                      onReassigned={fetchPedidos}
                                    />
                                  )}
                                  
                                  {isCancelled && (
                                    <span className="text-xs text-muted-foreground">Anulado</span>
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
                  <div className="p-8 text-center text-muted-foreground">No se encontraron pedidos con los filtros seleccionados</div>
                )}
                
                {/* Server-side Pagination */}
                {totalCount > 0 && (
                  <div className="p-4 border-t border-border">
                    <PaginationControls
                      currentPage={serverPage}
                      totalPages={totalServerPages}
                      onPageChange={goToServerPage}
                      startIndex={(serverPage - 1) * pageSize + 1}
                      endIndex={Math.min(serverPage * pageSize, totalCount)}
                      totalItems={totalCount}
                      itemsPerPage={pageSize}
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );

      case "novedades":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <NovedadesPanel 
              pedidos={pedidos} 
              onPedidoClick={(p) => {
                setSelectedPedidoForDetail(p as Pedido);
                setShowDetailModal(true);
              }} 
            />
          </motion.div>
        );

      case "inventario":
        return <WarehouseInventoryPanel />;

      case "liquidaciones":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-primary" />
                Liquidaciones
              </h2>
            </div>
            
            <Tabs defaultValue="tiendas" className="w-full">
               <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="tiendas" className="gap-2">
                  <Store className="h-4 w-4" />
                  <span>Tiendas</span>
                </TabsTrigger>
                 <TabsTrigger value="dropi" className="gap-2">
                   <TrendingUp className="h-4 w-4" />
                   <span>Dropi</span>
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="tiendas" className="mt-0">
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Store className="h-5 w-5 text-emerald-600" />
                      Pago a Tiendas
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pedidos liquidados pendientes de transferir el valor neto a la tienda.
                    </p>
                    <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs font-mono">
                      <span className="text-emerald-600 font-semibold">Neto a Pagar</span> = Total Recaudado − Costo de Envíos
                    </div>
                  </div>
                  <StoreLiquidacionesPanel onLiquidacionComplete={fetchPedidos} />
                </div>
              </TabsContent>

               <TabsContent value="dropi" className="mt-0">
                 <DropiLiquidacionPanel />
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

      case "configuracion-usuarios":
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

            {/* User Management with Tabs */}
            <UserManagementTabs
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
              onEditStore={(user) => {
                setSelectedStoreForEdit(user);
                setShowEditStore(true);
              }}
              onRoleChanged={refreshSupportData}
            />
          </motion.div>
        );

      case "auditoria":
        return (
          <AuditOrdersPanel
            onPedidoClick={(p) => {
              setSelectedPedidoForDetail(p as Pedido);
              setShowDetailModal(true);
            }}
          />
        );

      case "finanzas":
        return <AdminFinanzasPanel />;

      case "admin-wallet":
        return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><AdminWalletDashboard /></Suspense>;

      case "integraciones":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <h2 className="font-bold text-foreground text-lg mb-4">🔗 API Keys & Integraciones</h2>
            <IntegrationsPanel />
          </motion.div>
        );

      case "flex":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-foreground text-lg">⚡ Monitor Mercado Libre Flex</h2>
              <Button size="sm" onClick={() => setShowFlexScanner(true)} className="gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                <ScanLine className="h-4 w-4" />
                Recepción Flex
              </Button>
            </div>
            <MonitorFlexPanel />
          </motion.div>
        );

      case "webhook-monitor":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <WebhookMonitorDashboard />
            </Suspense>
          </motion.div>
        );

      case "liquidacion-aliados":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <LiquidacionAliadosPanel />
            </Suspense>
          </motion.div>
        );

      case "super-admin":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <SuperAdminMasterEmbed />
            </Suspense>
          </motion.div>
        );

      case "manifiesto-scanner":
        if (!isAliado) return null;
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-cyan-500" />
              <h2 className="text-xl font-bold text-foreground">Escáner & Asignación de Ruta</h2>
            </div>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <ManifiestoScannerView />
            </Suspense>
          </motion.div>
        );

      case "manifiestos":
        if (!isAliado) return null;
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <ManifiestosListView />
            </Suspense>
          </motion.div>
        );

      case "solicitudes-registro":
        return (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <SolicitudesRegistroPanel />
          </Suspense>
        );

      default:
        return null;
    }
  };

  // Consolidated section wrapper: renders Tabs UI for new grouped sections,
  // delegating to legacy section renderers via renderSectionById.
  const renderMainContent = (): React.ReactNode => {
    // Centro de Despachos (Despacho + Novedades)
    if (activeSection === "despachos") {
      return (
        <div className="flex flex-col h-full">
          <div className="px-4 pt-4">
            <Tabs value={despachosTab} onValueChange={setDespachosTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="todos" className="gap-2">
                  <Package className="h-4 w-4" />
                  Todos
                </TabsTrigger>
                <TabsTrigger value="en-ruta" className="gap-2">
                  <Truck className="h-4 w-4" />
                  En Ruta
                </TabsTrigger>
                <TabsTrigger value="novedades" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Novedades
                  {stats.novedad > 0 && (
                    <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {stats.novedad}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1">
            {despachosTab === "novedades"
              ? renderSectionById("novedades")
              : renderSectionById("despacho")}
          </div>
        </div>
      );
    }

    // Tesorería (Liquidaciones + Pagos a Tiendas + Mi Rentabilidad + Liquidación Aliados)
    if (activeSection === "tesoreria") {
      const isSuperAdmin = userRole === "super_admin";
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-foreground">Tesorería</h2>
          </div>
          <Tabs value={tesoreriaTab} onValueChange={setTesoreriaTab} className="w-full">
            <TabsList className={`grid w-full ${isSuperAdmin ? "grid-cols-4" : "grid-cols-3"} mb-4`}>
              <TabsTrigger value="liquidaciones" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Cierre y Liquidación</span>
                <span className="sm:hidden">Cierre</span>
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-2">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Pagos a Tiendas</span>
                <span className="sm:hidden">Pagos</span>
              </TabsTrigger>
              <TabsTrigger value="rentabilidad" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Mi Rentabilidad</span>
                <span className="sm:hidden">Rent.</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="aliados" className="gap-2">
                  <UserCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Liquidación Aliados</span>
                  <span className="sm:hidden">Aliados</span>
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="liquidaciones" className="mt-0">
              {renderSectionById("liquidaciones")}
            </TabsContent>
            <TabsContent value="pagos" className="mt-0">
              {renderSectionById("finanzas")}
            </TabsContent>
            <TabsContent value="rentabilidad" className="mt-0">
              {renderSectionById("admin-wallet")}
            </TabsContent>
            {isSuperAdmin && (
              <TabsContent value="aliados" className="mt-0">
                {renderSectionById("liquidacion-aliados")}
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      );
    }

    // Monitoreo Técnico (Webhook Monitor + Monitor Flex + Auditoría)
    if (activeSection === "monitoreo") {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-violet-600" />
            <h2 className="text-xl font-bold text-foreground">Monitoreo Técnico</h2>
          </div>
          <Tabs value={monitoreoTab} onValueChange={setMonitoreoTab} className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-3 mb-4">
              <TabsTrigger value="webhook">Webhook Monitor</TabsTrigger>
              <TabsTrigger value="flex">Monitor Flex</TabsTrigger>
              <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
            </TabsList>
            <TabsContent value="webhook" className="mt-0">
              {renderSectionById("webhook-monitor")}
            </TabsContent>
            <TabsContent value="flex" className="mt-0">
              {renderSectionById("flex")}
            </TabsContent>
            <TabsContent value="auditoria" className="mt-0">
              {renderSectionById("auditoria")}
            </TabsContent>
          </Tabs>
        </motion.div>
      );
    }

    // Configuración General (Usuarios + API & Integraciones + Súper Admin)
    if (activeSection === "configuracion") {
      const isSuperAdmin = userRole === "super_admin";
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-slate-600" />
            <h2 className="text-xl font-bold text-foreground">Configuración General</h2>
          </div>
          <Tabs value={configuracionTab} onValueChange={setConfiguracionTab} className="w-full">
            <TabsList className={`grid w-full max-w-xl ${isSuperAdmin ? "grid-cols-3" : "grid-cols-2"} mb-4`}>
              <TabsTrigger value="usuarios" className="gap-2">
                <Users className="h-4 w-4" />
                Usuarios
              </TabsTrigger>
              <TabsTrigger value="integraciones" className="gap-2">
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">API & Integraciones</span>
                <span className="sm:hidden">API</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="super-admin" className="gap-2">
                  <UserCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Súper Admin</span>
                  <span className="sm:hidden">Super</span>
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="usuarios" className="mt-0">
              {renderSectionById("configuracion-usuarios")}
            </TabsContent>
            <TabsContent value="integraciones" className="mt-0">
              {renderSectionById("integraciones")}
            </TabsContent>
            {isSuperAdmin && (
              <TabsContent value="super-admin" className="mt-0">
                {renderSectionById("super-admin")}
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      );
    }

    return renderSectionById(activeSection);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <AdminSidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          // Map legacy section IDs to new consolidated sections + pre-select tab
          const legacyMap: Record<string, { parent: string; tab?: string }> = {
            despacho: { parent: "despachos", tab: "todos" },
            novedades: { parent: "despachos", tab: "novedades" },
            liquidaciones: { parent: "tesoreria", tab: "liquidaciones" },
            finanzas: { parent: "tesoreria", tab: "pagos" },
            "admin-wallet": { parent: "tesoreria", tab: "rentabilidad" },
            "liquidacion-aliados": { parent: "tesoreria", tab: "aliados" },
            "webhook-monitor": { parent: "monitoreo", tab: "webhook" },
            flex: { parent: "monitoreo", tab: "flex" },
            auditoria: { parent: "monitoreo", tab: "auditoria" },
            integraciones: { parent: "configuracion", tab: "integraciones" },
            "super-admin": { parent: "configuracion", tab: "super-admin" },
          };
          const resolved = legacyMap[section];
          const target = resolved ? resolved.parent : section;
          if (isAliado && !["despachos", "mapa", "manifiesto-scanner", "manifiestos"].includes(target)) return;
          if (resolved?.tab) {
            if (resolved.parent === "despachos") setDespachosTab(resolved.tab);
            if (resolved.parent === "tesoreria") setTesoreriaTab(resolved.tab);
            if (resolved.parent === "monitoreo") setMonitoreoTab(resolved.tab);
            if (resolved.parent === "configuracion") setConfiguracionTab(resolved.tab);
          }
          setActiveSection(target);
        }}
        novedadesCount={stats.novedad}
        userRole={userRole}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            {/* Stats Row */}
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Panel Admin</span>
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
              {/* User Profile */}
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {profile?.full_name ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-bold text-foreground hidden sm:inline">{profile?.full_name}</span>
              </div>
              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors border border-red-200 dark:border-red-800"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Area */}
        <main className="flex-1 overflow-auto relative bg-muted/30">
          <CriticalErrorBoundary
            title="Panel"
            fallbackMessage="Un módulo del panel falló al renderizar. El layout seguirá disponible para que puedas cambiar de sección o reintentar."
          >
            {renderMainContent()}
          </CriticalErrorBoundary>
        </main>
      </div>

      {/* Modals */}
      <CreateUserModal isOpen={showCreateUser} onClose={() => setShowCreateUser(false)} onUserCreated={() => { refreshSupportData(); }} />
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
        onUserDeleted={() => { refreshSupportData(); }}
      />
      <NuevoPedidoModal isOpen={showNuevoPedido} onClose={() => setShowNuevoPedido(false)} onSuccess={fetchPedidos} isAdmin={true} />
      <QRScannerModal isOpen={showQRScanner} onClose={() => setShowQRScanner(false)} onSuccess={fetchPedidos} />
      <FlexReceptionScanner isOpen={showFlexScanner} onClose={() => setShowFlexScanner(false)} onSuccess={fetchPedidos} />
      <MeliFlexScannerModal isOpen={showMeliFlexScanner} onClose={() => setShowMeliFlexScanner(false)} onSuccess={fetchPedidos} />
      {isAliado && (
        <button
          onClick={() => setShowMeliFlexScanner(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-4 shadow-2xl shadow-amber-500/40 transition-transform hover:scale-105"
          title="Escanear Recolección Mercado Libre Flex"
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">Escanear Recolección (ML Flex)</span>
        </button>
      )}
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
      <CriticalErrorBoundary
        title="Impresión de Guía"
        fallbackMessage="La impresión de guía falló. Puedes cerrar y reintentar sin perder acceso al panel."
        minHeightClassName="min-h-[120px]"
      >
        <PrintGuiaModal
          isOpen={showPrintGuia}
          onClose={() => {
            handlePrintComplete(selectedPedidoForPrint ? [selectedPedidoForPrint.id] : []);
          }}
          pedido={selectedPedidoForPrint}
          remitente={
            selectedPedidoForPrint?.client_user_id
              ? clientProfiles[selectedPedidoForPrint.client_user_id]?.store_name ||
                clientProfiles[selectedPedidoForPrint.client_user_id]?.full_name
              : undefined
          }
        />
      </CriticalErrorBoundary>
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
      <NuevoPedidoModal
        isOpen={showEditPedido}
        onClose={() => {
          setShowEditPedido(false);
          setSelectedPedidoForEdit(null);
        }}
        onSuccess={() => {
          fetchPedidos();
        }}
        isAdmin={true}
        orderToEdit={selectedPedidoForEdit as any}
      />
      <BulkReassignModal
        isOpen={showBulkReassign}
        onClose={() => setShowBulkReassign(false)}
        selectedPedidoIds={selectedForBulk}
        onSuccess={() => {
          fetchPedidos();
          setSelectedForBulk([]);
        }}
      />
      <AssignCarrierModal
        isOpen={showAssignCarrier}
        onClose={() => setShowAssignCarrier(false)}
        selectedPedidoIds={selectedForBulk}
        onSuccess={() => {
          fetchPedidos();
          setSelectedForBulk([]);
        }}
      />
      <BulkOrderUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={fetchPedidos}
      />
      <EditStoreModal
        isOpen={showEditStore}
        onClose={() => {
          setShowEditStore(false);
          setSelectedStoreForEdit(null);
        }}
        store={selectedStoreForEdit}
        onSuccess={() => {
          refreshSupportData();
        }}
      />
      
      {/* Manifiesto de Recogida (Admin genera por tienda) */}
      <ManifiestoModal
        open={showManifiestoModal}
        onClose={() => setShowManifiestoModal(false)}
        pedidos={(displayPedidos as Pedido[])
          .filter((p) => selectedForBulk.includes(p.id))
          .map((p) => ({
            id: p.id,
            numero_guia: p.numero_guia,
            cliente_nombre: p.cliente_nombre,
            municipio: p.municipio,
            direccion_entrega: p.direccion_entrega,
            estado: p.estado,
          }))}
        storeName={(() => {
          const selected = (displayPedidos as Pedido[]).filter((p) => selectedForBulk.includes(p.id));
          const storeIds = new Set(selected.map((p) => p.client_user_id).filter(Boolean) as string[]);
          if (storeIds.size === 1) {
            const sid = Array.from(storeIds)[0];
            return clientProfiles[sid]?.store_name || clientProfiles[sid]?.full_name || "Tienda";
          }
          return storeIds.size > 1 ? "Múltiples Tiendas" : "Admin";
        })()}
        onStatusUpdated={() => {
          fetchPedidos();
          setSelectedForBulk([]);
        }}
      />

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

export default AdminDashboard;

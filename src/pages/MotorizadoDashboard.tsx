import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  User,
  Filter,
  Loader2,
  Navigation,
  Camera,
  Phone,
  LogOut,
  AlertTriangle,
  Map,
  RefreshCw,
  Share2,
  Pen,
  ScanLine,
  QrCode,
  WifiOff,
  Cloud,
  Truck,
  ClipboardList,
  MessageCircle,
  Route,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMotorizadoPedidos } from "@/hooks/useMotorizadoPedidos";
import { useHotZones } from "@/hooks/useHotZones";
import { useMotorizadoWallet } from "@/hooks/useMotorizadoWallet";
import {
  clearStoredTheme,
  getAutoTheme,
  isUsingAutoTheme,
  resolveInitialTheme,
  setStoredTheme,
} from "@/lib/theme";
import MotorizadoStatsHeader from "@/components/motorizado/MotorizadoStatsHeader";
import MotorizadoBottomNav, { type MotorizadoTab } from "@/components/motorizado/MotorizadoBottomNav";
import MotorizadoWalletWidget from "@/components/motorizado/MotorizadoWalletWidget";
import MotorizadoWalletSheet from "@/components/motorizado/MotorizadoWalletSheet";
import PedidoActivoCard from "@/components/motorizado/PedidoActivoCard";
import EntregaDelDiaCard from "@/components/motorizado/EntregaDelDiaCard";
import { calculateScore, calculateWeeklyEarnings, formatCOPFull } from "@/lib/motorizado-score";
import PedidoDetailView from "@/components/motorizado/PedidoDetailView";
import MotorizadoHomeHero from "@/components/motorizado/MotorizadoHomeHero";
import MotorizadoDailyStats from "@/components/motorizado/MotorizadoDailyStats";
import QuickActionsGrid from "@/components/motorizado/QuickActionsGrid";
import HotZoneCard from "@/components/motorizado/HotZoneCard";
import TeamNoteCard from "@/components/motorizado/TeamNoteCard";
import MotorizadoWalletInline from "@/components/motorizado/MotorizadoWalletInline";
import MotorizadoStreakBadge from "@/components/motorizado/MotorizadoStreakBadge";
import { useAuth } from "@/hooks/useAuth";
import useGeolocation, { calculateDistance, isWithinGeofence } from "@/hooks/useGeolocation";
import useLocationTracking from "@/hooks/useLocationTracking";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import MotorizadoMapGoogle from "@/components/MotorizadoMapGoogle";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import PedidoQuickActions from "@/components/PedidoQuickActions";
import BodegaSupportButton from "@/components/BodegaSupportButton";
import SignatureCanvas from "@/components/SignatureCanvas";
import ConnectionToggle from "@/components/ConnectionToggle";
import MotorizadoProfile from "@/components/MotorizadoProfile";
import DateHeader from "@/components/DateHeader";
import AdminNotesDisplay from "@/components/AdminNotesDisplay";
import MotorizadoQRScanner from "@/components/MotorizadoQRScanner";
import WeatherWidget from "@/components/WeatherWidget";
import QRPaymentModal from "@/components/QRPaymentModal";
import DarkModeToggle from "@/components/DarkModeToggle";
import LoadManifest from "@/components/motorizado/LoadManifest";
import MotorizadoOrderCard from "@/components/motorizado/MotorizadoOrderCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NOVEDAD_OPTIONS, NOVEDADES_REQUIRE_PHOTO, type NovedadType, getStatusConfig, isOperationalStatus } from "@/lib/orderStatuses";
import { deductInventoryOnDelivery } from "@/lib/inventoryService";
import PedidoChat from "@/components/PedidoChat";
import { optimizeRouteNearestNeighbor, calculateTotalRouteDistance } from "@/lib/routeOptimizer";
import { 
  savePendingDeliveryOffline, 
  savePendingNovedadOffline, 
  syncAllPending, 
  getPendingCount,
  setupOnlineSync,
  isOnline as checkIsOnline 
} from "@/lib/offlineSync";

import { ZONAS, type ZonaCodigo } from "@/lib/zonas";
import { getStartOfTodayBogotaMs } from "@/lib/dateUtils";
import { isCashPayment } from "@/lib/payments";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  foto_evidencia: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  producto_nombre: string | null;
  zona: string | null;
  tipo_novedad?: string | null;
  firma_cliente?: string | null;
  foto_paquete?: string | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  inventory_item_id?: string | null;
  quantity?: number | null;
  client_user_id?: string | null;
  canal?: string | null;
  fecha_actualizacion?: string | null;
}

// Warehouse coordinates for sorting
const BODEGA_LAT = 4.6066;
const BODEGA_LNG = -74.0747;
const BODEGA_ADDRESS = "Calle 14 # 19-64 Bodega 403, Bogotá, Colombia";
const SUPPORT_PHONE = "324 222 3825";
const GEOFENCE_RADIUS = 200; // 200 meters

const MotorizadoDashboard = () => {
  // React Query for orders - cached, no refetch loops
  const { signOut, profile, refreshProfile, user } = useAuth();
  const {
    pedidos: queryPedidos,
    isLoading: queryLoading,
    refetch: refetchPedidos,
    updatePedidoLocally,
    removePedidoLocally
  } = useMotorizadoPedidos(user?.id);
  const { zones: hotZones } = useHotZones(3);
  const { balance: walletBalance } = useMotorizadoWallet(user?.id);

  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  // Removed: const [loading, setLoading] - now using queryLoading
  const [updating, setUpdating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [packagePhoto, setPackagePhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedNovedadType, setSelectedNovedadType] = useState<NovedadType | null>(null);
  const [novedadReason, setNovedadReason] = useState("");
  const [novedadPhoto, setNovedadPhoto] = useState<string | null>(null);
  const [showMapView, setShowMapView] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [showLoadManifest, setShowLoadManifest] = useState(false);
  const [isDeviationDelivery, setIsDeviationDelivery] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => resolveInitialTheme() === "dark");
  const [chatOpenForPedido, setChatOpenForPedido] = useState<number | null>(null);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [activeTab, setActiveTab] = useState<MotorizadoTab>("pedidos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const novedadPhotoRef = useRef<HTMLInputElement>(null);
  const packagePhotoRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Use geolocation with watch mode for real-time updates
  const { latitude, longitude, error: geoError, loading: geoLoading, refreshLocation } = useGeolocation({
    watch: true,
    enableHighAccuracy: true,
  });

  const userLocation = useMemo(() => {
    if (latitude && longitude) {
      return { lat: latitude, lng: longitude };
    }
    return null;
  }, [latitude, longitude]);

  // Alias queryPedidos to pedidos for backward compatibility
  const pedidos = queryPedidos;
  const loading = queryLoading;

  // Track location every 30 seconds when online and has active orders
  const hasActiveOrders = pedidos.some(p => 
    p.estado?.toLowerCase() !== "entregado" && 
    p.estado?.toLowerCase() !== "novedad"
  );
  
  useLocationTracking({
    enabled: isOnline && hasActiveOrders,
    userId: user?.id,
    intervalMs: 30000,
  });

  // Fetch on mount is handled by React Query - no useEffect needed

  // Setup offline sync and network status monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkOnline(navigator.onLine);
    };

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    // Setup automatic sync when coming online
    const cleanup = setupOnlineSync(async (result) => {
      if (result.syncedDeliveries > 0 || result.syncedNovedades > 0) {
        toast.success(
          `✅ Sincronización completada: ${result.syncedDeliveries} entregas, ${result.syncedNovedades} novedades`,
          { duration: 5000 }
        );
        refetchPedidos(); // Refresh data via React Query
      }
      setPendingSyncCount(await getPendingCount());
    });

    // Get initial pending count
    getPendingCount().then(setPendingSyncCount);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
      cleanup();
    };
  }, []);

  // Sort and filter pedidos - prioritize by proximity to current location or bodega
  useEffect(() => {
    let filtered = [...pedidos];

    if (activeFilter) {
      filtered = filtered.filter((p) => p.corte_horario === activeFilter);
    }

    // Separate delivered/novedad from active
    const delivered = filtered.filter(p => p.estado?.toLowerCase() === "entregado");
    const novedades = filtered.filter(p => p.estado?.toLowerCase().includes("novedad") && p.estado?.toLowerCase() !== "entregado");
    const active = filtered.filter(p => p.estado?.toLowerCase() !== "entregado" && !p.estado?.toLowerCase().includes("novedad"));

    if (isRouteOptimized && userLocation) {
      // TSP nearest-neighbor ordering for active orders
      const optimized = optimizeRouteNearestNeighbor(active, userLocation.lat, userLocation.lng);
      setFilteredPedidos([...optimized, ...novedades, ...delivered]);
    } else {
      // Default: sort by proximity from current point
      const refLat = userLocation?.lat ?? BODEGA_LAT;
      const refLng = userLocation?.lng ?? BODEGA_LNG;

      active.sort((a, b) => {
        const aHasCoords = a.latitud != null && a.longitud != null;
        const bHasCoords = b.latitud != null && b.longitud != null;
        if (aHasCoords && bHasCoords) {
          const distA = calculateDistance(refLat, refLng, a.latitud!, a.longitud!);
          const distB = calculateDistance(refLat, refLng, b.latitud!, b.longitud!);
          return distA - distB;
        }
        if (aHasCoords && !bHasCoords) return -1;
        if (!aHasCoords && bHasCoords) return 1;
        const corteOrder: { [key: string]: number } = { "Corte 1": 1, "Corte 2": 2, "Corte 3": 3 };
        return (corteOrder[a.corte_horario || ""] || 99) - (corteOrder[b.corte_horario || ""] || 99);
      });

      setFilteredPedidos([...active, ...novedades, ...delivered]);
    }
  }, [activeFilter, pedidos, userLocation, isRouteOptimized]);

  // Route optimization handler
  const handleOptimizeRoute = useCallback(() => {
    if (!userLocation) {
      toast.error("Se necesita tu ubicación GPS para optimizar la ruta");
      return;
    }
    const activePedidos = pedidos.filter(p => 
      p.estado?.toLowerCase() !== "entregado" && !p.estado?.toLowerCase().includes("novedad")
    );
    if (activePedidos.length < 2) {
      toast.info("Necesitas al menos 2 pedidos activos para optimizar");
      return;
    }

    setIsRouteOptimized(true);
    
    const beforeDist = calculateTotalRouteDistance(activePedidos, userLocation.lat, userLocation.lng);
    const optimized = optimizeRouteNearestNeighbor(activePedidos, userLocation.lat, userLocation.lng);
    const afterDist = calculateTotalRouteDistance(optimized, userLocation.lat, userLocation.lng);
    const savedKm = ((beforeDist - afterDist) / 1000).toFixed(1);
    
    toast.success(`🗺️ Ruta optimizada — ${savedKm}km ahorrados`, { duration: 4000 });
  }, [pedidos, userLocation]);

  // fetchPedidos is now handled by useMotorizadoPedidos React Query hook
  // Legacy function kept as alias for backward compatibility
  const fetchPedidos = refetchPedidos;

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage, formatFileSize } = await import("@/lib/imageCompression");
        const result = await compressImage(file);
        console.log(`📸 Foto comprimida: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)}`);
        setCapturedPhoto(result.base64);
      } catch {
        // Fallback to raw read
        const reader = new FileReader();
        reader.onloadend = () => setCapturedPhoto(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const openPhotoCapture = () => {
    if (!selectedPedido) return;

    // Check geofence - now allows delivery outside range with deviation flag
    const geofenceResult = validateGeofence(selectedPedido);
    if (!geofenceResult.allowed) {
      return;
    }

    setIsDeviationDelivery(geofenceResult.isDeviation);
    setShowPhotoModal(true);
    setCapturedPhoto(null);
  };

  // GPS Flexibility: Allow delivery outside geofence but require mandatory photo
  const validateGeofence = (pedido: Pedido): { allowed: boolean; isDeviation: boolean } => {
    // If pedido has no coordinates, allow the action (can't validate)
    if (pedido.latitud == null || pedido.longitud == null) {
      return { allowed: true, isDeviation: false };
    }

    // If user location not available, show error
    if (!userLocation) {
      toast.error("No se puede obtener tu ubicación GPS. Por favor habilita el GPS y vuelve a intentar.", {
        duration: 5000,
      });
      return { allowed: false, isDeviation: false };
    }

    const withinGeofence = isWithinGeofence(
      userLocation.lat,
      userLocation.lng,
      pedido.latitud,
      pedido.longitud,
      GEOFENCE_RADIUS
    );

    if (!withinGeofence) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        pedido.latitud,
        pedido.longitud
      );
      // NEW: Allow delivery but flag as deviation - require mandatory photo
      toast.warning(
        `⚠️ Estás a ${Math.round(distance)}m del destino (fuera de rango). Se requerirá FOTO DE EVIDENCIA OBLIGATORIA.`,
        { duration: 6000 }
      );
      return { allowed: true, isDeviation: true };
    }

    return { allowed: true, isDeviation: false };
  };

  const confirmDelivery = async () => {
    if (!selectedPedido) return;

    const isFlexOrder = selectedPedido.canal === "FLEX";

    // Flex orders: mandatory photo AND GPS
    if (isFlexOrder) {
      if (!capturedPhoto) {
        toast.error("📸 FLEX: La foto de evidencia es OBLIGATORIA para pedidos Flex");
        return;
      }
      if (!userLocation) {
        toast.error("📍 FLEX: La ubicación GPS es OBLIGATORIA para pedidos Flex. Habilita el GPS.");
        return;
      }
    } else {
      // Standard orders: photo required for deviations
      if (!capturedPhoto) {
        toast.error(isDeviationDelivery 
          ? "⚠️ FOTO DE EVIDENCIA OBLIGATORIA - Estás fuera del rango GPS"
          : "Debes tomar una foto de evidencia"
        );
        return;
      }
    }

    setUpdating(true);
    
    // Build update data
    const updateData: Record<string, unknown> = {
      estado: "Entregado",
      foto_evidencia: capturedPhoto,
      foto_paquete: packagePhoto || null,
      firma_cliente: signature || null,
      fecha_actualizacion: new Date().toISOString(),
    };

    // If this is a deviation delivery, add system note with GPS coordinates
    if (isDeviationDelivery && userLocation) {
      const deviationNote = `[SISTEMA] ${new Date().toLocaleString()} - ⚠️ ENTREGA CON DESVIACIÓN GPS. Coordenadas reales de entrega: ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
      
      // Fetch current observaciones
      const { data: currentData } = await supabase
        .from("pedidos")
        .select("observaciones")
        .eq("id", selectedPedido.id)
        .single();
      
      const existingObs = currentData?.observaciones || "";
      updateData.observaciones = existingObs ? `${existingObs}\n\n${deviationNote}` : deviationNote;
    }

    try {
      // Check if we're online
      if (!navigator.onLine) {
        // Save offline
        await savePendingDeliveryOffline({
          pedidoId: selectedPedido.id,
          estado: "Entregado",
          foto_evidencia: capturedPhoto,
          foto_paquete: packagePhoto || null,
          firma_cliente: signature || null,
          latitude: userLocation?.lat || null,
          longitude: userLocation?.lng || null,
          isDeviation: isDeviationDelivery,
        });
        
        toast.success("📴 Entrega guardada offline - Se sincronizará cuando haya conexión", {
          duration: 5000,
        });
        
        setPendingSyncCount(await getPendingCount());
      } else {
        // Online: update directly
        const { error } = await supabase
          .from("pedidos")
          .update(updateData)
          .eq("id", selectedPedido.id);

        if (error) throw error;

        // Deduct inventory if linked to inventory item
        if (selectedPedido.inventory_item_id) {
          const inventoryResult = await deductInventoryOnDelivery(
            selectedPedido.id,
            selectedPedido.inventory_item_id,
            selectedPedido.quantity || 1
          );
          if (!inventoryResult.success) {
            console.warn("Inventory deduction failed:", inventoryResult.error);
          }
        }

        toast.success(
          isDeviationDelivery 
            ? "⚠️ Pedido entregado con DESVIACIÓN GPS registrada"
            : "✅ Pedido entregado exitosamente con firma y evidencia"
        );
        }

        // Fire outbound webhook notification (non-blocking)
        if (selectedPedido.client_user_id) {
          supabase.functions.invoke("notify-webhook", {
            body: {
              pedido_id: selectedPedido.id,
              estado_anterior: selectedPedido.estado,
              estado_nuevo: "Entregado",
              numero_guia: selectedPedido.numero_guia,
              client_user_id: selectedPedido.client_user_id,
            },
          }).catch((err) => console.warn("Webhook notification failed:", err));
        }

      // Update local state via React Query optimistic update.
      // Importante: incluye fecha_actualizacion para que dailyStats lo cuente
      // como entrega de hoy aun antes de que llegue el refetch del backend.
      updatePedidoLocally(selectedPedido.id, {
        estado: "Entregado",
        foto_evidencia: capturedPhoto,
        foto_paquete: packagePhoto,
        firma_cliente: signature,
        fecha_actualizacion: new Date().toISOString(),
      });

      // Refrescar desde Supabase para mantener consistencia con la tab "Entregados"
      // (el hook trae Entregados de hoy con fecha_actualizacion autoritativa).
      refetchPedidos();

      setSelectedPedido(null);
      setShowPhotoModal(false);
      setShowSignatureModal(false);
      setCapturedPhoto(null);
      setPackagePhoto(null);
      setSignature(null);
      setIsDeviationDelivery(false);
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  const openNovedadModal = () => {
    if (!selectedPedido) return;

    // Check geofence - now with flexible validation
    const geofenceResult = validateGeofence(selectedPedido);
    if (!geofenceResult.allowed) {
      return;
    }

    setShowNovedadModal(true);
    setSelectedNovedadType(null);
    setNovedadReason("");
    setNovedadPhoto(null);
  };

  const handleNovedadPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage } = await import("@/lib/imageCompression");
        const result = await compressImage(file);
        setNovedadPhoto(result.base64);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => setNovedadPhoto(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePackagePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage } = await import("@/lib/imageCompression");
        const result = await compressImage(file);
        setPackagePhoto(result.base64);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => setPackagePhoto(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const confirmNovedad = async () => {
    if (!selectedPedido || !selectedNovedadType) {
      toast.error("Selecciona el tipo de novedad");
      return;
    }

    // Check if photo is required
    const requiresPhoto = NOVEDADES_REQUIRE_PHOTO.includes(selectedNovedadType);
    if (requiresPhoto && !novedadPhoto) {
      toast.error("Esta novedad requiere foto de evidencia obligatoria");
      return;
    }

    setUpdating(true);
    try {
      // Import delivery attempt handler for automatic return logic
      const { handleDeliveryAttempt } = await import("@/lib/notificationService");
      
      // Get current attempts from the order (need to fetch fresh data)
      const { data: currentOrder, error: fetchError } = await supabase
        .from("pedidos")
        .select("intentos_entrega, valor_flete")
        .eq("id", selectedPedido.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentAttempts = currentOrder?.intentos_entrega || 0;
      const valorFlete = currentOrder?.valor_flete || 12000;
      
      // Process delivery attempt - this will auto-mark as return after 2nd attempt
      const attemptResult = await handleDeliveryAttempt(
        selectedPedido.id,
        currentAttempts,
        valorFlete
      );
      
      // If auto-return was triggered, update local state accordingly
      if (attemptResult.shouldMarkAsReturn) {
        updatePedidoLocally(selectedPedido.id, { 
          estado: "Devolución",
          tipo_novedad: selectedNovedadType,
          foto_evidencia: novedadPhoto || undefined,
        });
        
        toast.warning(attemptResult.message, { duration: 6000 });
      } else {
        // Normal novedad handling (1st attempt)
        const updateData: Record<string, unknown> = {
          estado: "Novedad",
          tipo_novedad: selectedNovedadType,
          fecha_actualizacion: new Date().toISOString(),
        };

        // Capture GPS coordinates
        if (userLocation) {
          updateData.novedad_latitud = userLocation.lat;
          updateData.novedad_longitud = userLocation.lng;
        }

        // Add photo if provided
        if (novedadPhoto) {
          updateData.foto_evidencia = novedadPhoto;
        }

        const { error } = await supabase
          .from("pedidos")
          .update(updateData)
          .eq("id", selectedPedido.id);

        if (error) throw error;

        updatePedidoLocally(selectedPedido.id, { 
          estado: "Novedad",
          tipo_novedad: selectedNovedadType,
          foto_evidencia: novedadPhoto || undefined,
        });
        
        toast.success(`⚠️ ${attemptResult.message}`);
      }

      setSelectedPedido(null);
      setShowNovedadModal(false);
      setSelectedNovedadType(null);
      setNovedadReason("");
      setNovedadPhoto(null);
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al reportar novedad");
    } finally {
      setUpdating(false);
    }
  };

  const openSignatureModal = () => {
    if (!selectedPedido) return;
    setShowSignatureModal(true);
  };

  const handleSignatureSave = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignatureModal(false);
  };

  const openGoogleMaps = (pedido: Pedido) => {
    const encodedOrigin = encodeURIComponent(BODEGA_ADDRESS);
    let destination: string;

    // Use coordinates if available, otherwise use address
    if (pedido.latitud != null && pedido.longitud != null) {
      destination = `${pedido.latitud},${pedido.longitud}`;
    } else {
      destination = encodeURIComponent((pedido.direccion_entrega || "") + ", Bogotá, Colombia");
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${destination}&travelmode=driving`;
    window.open(mapsUrl, "_blank");
  };

  const openWaze = (pedido: Pedido) => {
    let wazeUrl: string;

    if (pedido.latitud != null && pedido.longitud != null) {
      wazeUrl = `https://waze.com/ul?ll=${pedido.latitud},${pedido.longitud}&navigate=yes`;
    } else {
      const address = encodeURIComponent((pedido.direccion_entrega || "") + ", Bogotá, Colombia");
      wazeUrl = `https://waze.com/ul?q=${address}&navigate=yes`;
    }

    window.open(wazeUrl, "_blank");
  };

  const openWhatsApp = (phone?: string | null, customMessage?: string) => {
    const phoneNumber = phone?.replace(/\D/g, "") || "3242223825";
    const message = encodeURIComponent(
      customMessage || `Hola, soy el motorizado de Kompras Plus, voy en camino con tu pedido.`
    );
    window.open(`https://wa.me/57${phoneNumber}?text=${message}`, "_blank");
  };

  const callClient = (phone?: string | null) => {
    const phoneNumber = phone?.replace(/\D/g, "") || "";
    if (!phoneNumber) {
      toast.error("Este cliente no tiene teléfono registrado");
      return;
    }
    window.open(`tel:+57${phoneNumber}`, "_self");
  };

  const shareRoute = (pedido: Pedido) => {
    const phoneNumber = pedido.client_phone?.replace(/\D/g, "") || "";
    if (!phoneNumber) {
      toast.error("Este cliente no tiene teléfono registrado");
      return;
    }

    let message = `🚚 *Kompras Plus - Actualización de tu pedido*\n\n`;
    message += `Hola ${pedido.cliente_nombre || ""}! Tu pedido está *en camino*.\n\n`;
    
    if (userLocation) {
      message += `📍 Mi ubicación actual:\nhttps://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}\n\n`;
    }
    
    message += `¡Estaré llegando pronto! 🏍️`;

    window.open(`https://wa.me/57${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getDistanceText = (pedido: Pedido): string | null => {
    if (!userLocation || pedido.latitud == null || pedido.longitud == null) {
      return null;
    }
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      pedido.latitud,
      pedido.longitud
    );
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  // Inline handlers for the new MotorizadoOrderCard P.O.D drawer
  const handleCardDeliver = useCallback(
    async (pedido: Pedido, photoBase64: string, signatureBase64: string) => {
      try {
        let photoUrl: string = photoBase64;
        let signatureUrl: string = signatureBase64;

        if (navigator.onLine) {
          const { uploadEvidence } = await import("@/lib/evidenceUpload");
          [photoUrl, signatureUrl] = await Promise.all([
            uploadEvidence(pedido.id, "foto", photoBase64),
            uploadEvidence(pedido.id, "firma", signatureBase64),
          ]);
        }

        const updateData: Record<string, unknown> = {
          estado: "Entregado",
          foto_evidencia: photoUrl,
          foto_paquete: photoUrl,
          firma_cliente: signatureUrl,
          evidencia_foto_url: photoUrl,
          evidencia_firma_url: signatureUrl,
          fecha_actualizacion: new Date().toISOString(),
        };

        if (!navigator.onLine) {
          await savePendingDeliveryOffline({
            pedidoId: pedido.id,
            estado: "Entregado",
            foto_evidencia: photoBase64,
            foto_paquete: photoBase64,
            firma_cliente: signatureBase64,
            latitude: userLocation?.lat || null,
            longitude: userLocation?.lng || null,
            isDeviation: false,
          });
          toast.success("📴 Entrega guardada offline - Se sincronizará cuando haya conexión", {
            duration: 5000,
          });
          setPendingSyncCount(await getPendingCount());
        } else {
          const { error } = await supabase
            .from("pedidos")
            .update(updateData)
            .eq("id", pedido.id);
          if (error) throw error;

          if (pedido.inventory_item_id) {
            const inventoryResult = await deductInventoryOnDelivery(
              pedido.id,
              pedido.inventory_item_id,
              pedido.quantity || 1,
            );
            if (!inventoryResult.success) {
              console.warn("Inventory deduction failed:", inventoryResult.error);
            }
          }

          toast.success("✅ Pedido entregado con evidencias guardadas");
        }

        if (pedido.client_user_id) {
          supabase.functions
            .invoke("notify-webhook", {
              body: {
                pedido_id: pedido.id,
                estado_anterior: pedido.estado,
                estado_nuevo: "Entregado",
                numero_guia: pedido.numero_guia,
                client_user_id: pedido.client_user_id,
              },
            })
            .catch((err) => console.warn("Webhook notification failed:", err));
        }

        updatePedidoLocally(pedido.id, {
          estado: "Entregado",
          foto_evidencia: photoUrl,
          firma_cliente: signatureUrl,
        });
      } catch (error) {
        console.error("Error updating estado:", error);
        toast.error("Error al subir evidencias");
        throw error;
      }
    },
    [userLocation, updatePedidoLocally],
  );

  const handleCardNovedad = useCallback(
    async (
      pedido: Pedido,
      novedadType: NovedadType,
      note: string,
      photoBase64: string,
    ) => {
      try {
        const { handleDeliveryAttempt } = await import("@/lib/notificationService");
        const { uploadEvidence } = await import("@/lib/evidenceUpload");

        const llamadaUrl = await uploadEvidence(pedido.id, "llamada", photoBase64);

        const { data: currentOrder, error: fetchError } = await supabase
          .from("pedidos")
          .select("intentos_entrega, valor_flete, observaciones")
          .eq("id", pedido.id)
          .single();
        if (fetchError) throw fetchError;

        const currentAttempts = currentOrder?.intentos_entrega || 0;
        const valorFlete = currentOrder?.valor_flete || 12000;

        const attemptResult = await handleDeliveryAttempt(
          pedido.id,
          currentAttempts,
          valorFlete,
        );

        if (attemptResult.shouldMarkAsReturn) {
          await supabase
            .from("pedidos")
            .update({
              evidencia_llamada_url: llamadaUrl,
              foto_evidencia: llamadaUrl,
              tipo_novedad: novedadType,
            })
            .eq("id", pedido.id);

          updatePedidoLocally(pedido.id, {
            estado: "Devolución",
            tipo_novedad: novedadType,
            foto_evidencia: llamadaUrl,
          });
          toast.warning(attemptResult.message, { duration: 6000 });
        } else {
          const updateData: Record<string, unknown> = {
            estado: "Novedad",
            tipo_novedad: novedadType,
            foto_evidencia: llamadaUrl,
            evidencia_llamada_url: llamadaUrl,
            fecha_actualizacion: new Date().toISOString(),
          };
          if (userLocation) {
            updateData.novedad_latitud = userLocation.lat;
            updateData.novedad_longitud = userLocation.lng;
          }
          const noteEntry = `[NOVEDAD] ${new Date().toLocaleString()} - ${note.trim()}`;
          const existing = currentOrder?.observaciones || "";
          updateData.observaciones = existing
            ? `${existing}\n\n${noteEntry}`
            : noteEntry;

          const { error } = await supabase
            .from("pedidos")
            .update(updateData)
            .eq("id", pedido.id);
          if (error) throw error;

          updatePedidoLocally(pedido.id, {
            estado: "Novedad",
            tipo_novedad: novedadType,
            foto_evidencia: llamadaUrl,
          });

          toast.success(`⚠️ ${attemptResult.message}`);
        }
      } catch (error) {
        console.error("Error reporting novedad:", error);
        toast.error("Error al reportar novedad");
        throw error;
      }
    },
    [userLocation, updatePedidoLocally],
  );


  const pendingCount = pedidos.filter((p) => {
    const s = p.estado?.toLowerCase();
    return s === "asignado" || s === "pendiente" || s === "en bodega";
  }).length;
  const inTransitCount = pedidos.filter(
    (p) =>
      p.estado?.toLowerCase() === "en camino" ||
      p.estado?.toLowerCase() === "en ruta"
  ).length;
  const deliveredCount = pedidos.filter(
    (p) => p.estado?.toLowerCase() === "entregado"
  ).length;

  const getStatusColor = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "pendiente":
      case "en bodega":
        return "bg-secondary text-secondary-foreground";
      case "en camino":
      case "en ruta":
        return "bg-primary text-primary-foreground";
      case "entregado":
        return "bg-green-500 text-white";
      default:
        if (s?.includes("novedad")) return "bg-red-500 text-white";
        return "bg-muted text-muted-foreground";
    }
  };

  const cortes = ["Corte 1", "Corte 2", "Corte 3"];

  // Stats del día: solo cuenta entregas con fecha_actualizacion >= inicio de hoy en Bogotá.
  // metodo_pago normaliza variantes: efectivo, contra entrega, COD, etc.
  const dailyStats = useMemo(() => {
    const startOfTodayMs = getStartOfTodayBogotaMs();
    const todayDelivered = pedidos.filter((p) => {
      if (p.estado?.toLowerCase() !== "entregado") return false;
      if (!p.fecha_actualizacion) return false;
      const t = new Date(p.fecha_actualizacion).getTime();
      return Number.isFinite(t) && t >= startOfTodayMs;
    });
    const collectedAmount = todayDelivered.reduce((sum, p) => {
      if (isCashPayment(p.metodo_pago) && p.valor_recaudar) {
        return sum + Number(p.valor_recaudar);
      }
      return sum;
    }, 0);
    return {
      deliveredCount: todayDelivered.length,
      collectedAmount,
    };
  }, [pedidos]);

  // Sistema de Score / Niveles / Wallet del motorizado
  const motorizadoStats = useMemo(() => {
    const entregados = pedidos.filter((p) => p.estado?.toLowerCase() === "entregado").length;
    const novedades = pedidos.filter((p) => p.estado?.toLowerCase() === "novedad").length;
    const anulados = pedidos.filter((p) => p.estado?.toLowerCase() === "anulado").length;

    // Antigüedad: usar created_at del profile si está, sino estimar por registros
    const createdAt = (profile as { created_at?: string } | null)?.created_at;
    const diasAntiguedad = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const score = calculateScore({
      pedidosEntregados: entregados,
      pedidosConNovedad: novedades,
      pedidosAnulados: anulados,
      diasAntiguedad,
      isOnline,
    });

    // Balance simulado del día: 8% del valor entregado COD.
    // El hook solo trae entregados de hoy en TZ Bogotá, así que aquí ya están filtrados.
    // El acumulado mes/histórico llegará con el sistema de wallet real (Fase 4 del roadmap).
    const codCollectedMonth = pedidos
      .filter((p) => p.estado?.toLowerCase() === "entregado" && isCashPayment(p.metodo_pago))
      .reduce((sum, p) => sum + Number(p.valor_recaudar || 0), 0);

    const ganancias = Math.round(codCollectedMonth * 0.08);
    const fondoGarantia = Math.round(codCollectedMonth * 0.05);

    return {
      score,
      entregadosMes: entregados,
      balanceDisponible: ganancias,
      fondoGarantia,
      codHoyUsado: dailyStats.collectedAmount,
    };
  }, [pedidos, profile, isOnline, dailyStats.collectedAmount]);

  // Pedido activo (el primero "Asignado" o "En Ruta")
  const pedidoActivo = useMemo(() => {
    return (
      pedidos.find((p) => {
        const est = p.estado?.toLowerCase();
        return est === "asignado" || est === "en ruta" || est === "en_ruta";
      }) || null
    );
  }, [pedidos]);

  // Conteo de pedidos pendientes (para badge del bottom nav)
  const pedidosPendientesCount = useMemo(() => {
    return pedidos.filter((p) => {
      const est = p.estado?.toLowerCase();
      return est !== "entregado" && est !== "anulado" && est !== "devolucion" && est !== "devolución";
    }).length;
  }, [pedidos]);

  // Ganancias semanales (últimos 7 días)
  const weeklyEarnings = useMemo(
    () => calculateWeeklyEarnings(pedidos, 0.08),
    [pedidos],
  );

  // Active admin note
  const [activeNote, setActiveNote] = useState<{ message: string; created_at: string } | null>(null);
  useEffect(() => {
    let active = true;
    const loadNote = async () => {
      try {
        const { data } = await supabase
          .from("admin_notes")
          .select("message, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!active || !data || data.length === 0) return;
        setActiveNote({
          message: data[0].message as string,
          created_at: data[0].created_at as string,
        });
      } catch (e) {
        // silent
      }
    };
    loadNote();
    return () => {
      active = false;
    };
  }, []);

  const callWarehouse = useCallback(() => {
    window.location.href = `tel:${SUPPORT_PHONE.replace(/\s/g, "")}`;
  }, []);

  const timeAgoLabel = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  };

  // Get profile with extended data
  const extendedProfile = profile ? {
    id: user?.id || "",
    user_id: user?.id || "",
    full_name: profile.full_name,
    phone: profile.phone,
    email: profile.email,
    avatar_url: profile.avatar_url,
    vehicle_plate: profile.vehicle_plate,
  } : null;

  // Initialize isOnline from profile
  useEffect(() => {
    if (profile?.is_online !== undefined) {
      setIsOnline(profile.is_online);
    }
  }, [profile?.is_online]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Dark mode effect - apply class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Modo automático: si el usuario no eligió manualmente, el tema sigue la
  // hora Bogotá y se re-evalúa cada 5 min para captar el cambio 18:00/06:00.
  useEffect(() => {
    if (!isUsingAutoTheme()) return;
    const interval = window.setInterval(() => {
      if (!isUsingAutoTheme()) return;
      const next = getAutoTheme();
      setIsDarkMode((prev) => (prev === (next === "dark") ? prev : next === "dark"));
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Toggle manual: persiste preferencia y saca del modo automático.
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setStoredTheme(next ? "dark" : "light");
      return next;
    });
  }, []);

  // Volver al modo automático (limpia preferencia y aplica según hora actual).
  const resetToAutoTheme = useCallback(() => {
    clearStoredTheme();
    const next = getAutoTheme();
    setIsDarkMode(next === "dark");
  }, []);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300 pb-20 lg:pb-0">
      {/* Header Premium con Score + Avatar + Acciones */}
      <MotorizadoStatsHeader
        avatarUrl={profile?.avatar_url}
        fullName={profile?.full_name}
        isOnline={isOnline}
        score={motorizadoStats.score}
        notificationCount={pendingSyncCount}
        showMapView={showMapView}
        onToggleMap={() => setShowMapView(!showMapView)}
        onProfileClick={() => setShowProfile(true)}
        onSignOut={handleSignOut}
        dailyStats={{
          deliveries: dailyStats.deliveredCount,
          cashCollected: dailyStats.collectedAmount,
          earnings: motorizadoStats.ganancias,
        }}
      />

      <main className="container px-4 py-4">
        {/* Date Header with Greeting */}
        <DateHeader userName={profile?.full_name} />

        {/* ========== HERO Premium del Motorizado ========== */}
        <div className="space-y-3 mb-4">

          {/* Hero: ganancias + chart + nivel */}
          <MotorizadoHomeHero
            score={motorizadoStats.score}
            isOnline={isOnline}
            weeklyEarnings={weeklyEarnings}
          />

          {/* Connection Toggle (cuando esté offline lo mostramos para activar) */}
          {!isOnline && user?.id && (
            <ConnectionToggle
              userId={user.id}
              isOnline={isOnline}
              onStatusChange={setIsOnline}
              userLocation={userLocation}
            />
          )}

          {/* Wallet inline: saldo retirable + cupo COD + fondo garantía */}
          <MotorizadoWalletInline
            score={motorizadoStats.score}
            codHoyUsado={motorizadoStats.codHoyUsado}
            fondoGarantia={motorizadoStats.fondoGarantia}
            balanceDisponible={walletBalance?.balance_disponible}
            onRetirar={() => setActiveTab("wallet")}
          />

          {/* Badge motivacional con entregas del día — solo se muestra con 3+ */}
          {dailyStats.deliveredCount >= 3 && (
            <div className="flex justify-center">
              <MotorizadoStreakBadge deliveries={dailyStats.deliveredCount} />
            </div>
          )}

          {/* Stats del día */}
          <MotorizadoDailyStats
            pendientes={pendingCount}
            enCamino={inTransitCount}
            entregados={deliveredCount}
          />

          {/* Hot Zone — datos reales desde RPC motorizado_hot_zones */}
          {isOnline && pendingCount === 0 && hotZones.length > 0 && (
            <HotZoneCard
              zoneName={
                ZONAS[hotZones[0].zona as ZonaCodigo]?.nombre ?? hotZones[0].zona
              }
              pedidosDisponibles={Number(hotZones[0].pedidos_disponibles)}
              bonusPerDelivery={Number(hotZones[0].bono_estimado)}
              onAcceptZone={() =>
                toast.info(
                  `Zona ${ZONAS[hotZones[0].zona as ZonaCodigo]?.nombre ?? hotZones[0].zona}: ${hotZones[0].pedidos_disponibles} pedidos sin asignar. Contacta a admin para que te los asigne.`,
                  { duration: 5000 },
                )
              }
            />
          )}

          {/* Quick Actions */}
          <QuickActionsGrid
            onOptimizeRoute={() => {
              if (isRouteOptimized) {
                setIsRouteOptimized(false);
                toast.info("Orden por defecto restaurado");
              } else {
                handleOptimizeRoute();
              }
            }}
            onScanQR={() => setShowLoadManifest(true)}
            onCallWarehouse={callWarehouse}
            pendientesCount={pendingCount}
            isRouteOptimized={isRouteOptimized}
          />

          {/* Team Note (si hay nota activa del admin) */}
          {activeNote && (
            <TeamNoteCard
              text={activeNote.message}
              timeAgo={timeAgoLabel(activeNote.created_at)}
            />
          )}

          {/* GPS Status - solo si online y hay error/loading */}
          {isOnline && (geoError || geoLoading) && (
            <div
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                geoError
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "bg-warning/10 text-warning border border-warning/30"
              }`}
            >
              {geoLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Obteniendo ubicación GPS...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="flex-1">{geoError}</span>
                  <button onClick={refreshLocation} className="p-1 hover:bg-destructive/20 rounded">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Map View Toggle (cuando está activo) */}
          <AnimatePresence mode="wait">
            {showMapView && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="rounded-2xl overflow-hidden border border-border">
                  <div className="h-[280px]">
                    <MapErrorBoundary fallbackMessage="Error al cargar el mapa. Verifica tu conexión y permisos de GPS.">
                      <MotorizadoMapGoogle
                        pedidos={pedidos}
                        userLocation={userLocation}
                        onPedidoClick={(pedido) => setSelectedPedido(pedido as Pedido)}
                      />
                    </MapErrorBoundary>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          (() => {
            const pendientes = filteredPedidos.filter((p) => {
              const s = p.estado?.toLowerCase();
              return s === "asignado" || s === "pendiente" || s === "en bodega";
            });
            const enCamino = filteredPedidos.filter((p) => {
              const s = p.estado?.toLowerCase();
              return s === "en ruta" || s === "en camino" || (s?.includes("novedad") && s !== "entregado");
            });
            const entregados = filteredPedidos.filter(
              (p) => p.estado?.toLowerCase() === "entregado",
            );

            const renderList = (list: Pedido[], emptyText: string) => {
              if (list.length === 0) {
                return (
                  <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">{emptyText}</p>
                  </div>
                );
              }
              const grouped = list.reduce((acc, p) => {
                const zona = p.zona || "SIN_ZONA";
                if (!acc[zona]) acc[zona] = [];
                acc[zona].push(p);
                return acc;
              }, {} as Record<string, Pedido[]>);

              return (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([zona, zonaPedidos]) => {
                    const zonaConfig = ZONAS[zona as ZonaCodigo];
                    return (
                      <div key={zona} className="space-y-2.5">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${zonaConfig ? zonaConfig.bgColor : "bg-muted"}`}
                        >
                          <span
                            className={`text-xs font-bold ${zonaConfig ? zonaConfig.textColor : "text-muted-foreground"}`}
                          >
                            {zonaConfig ? `${zonaConfig.codigo} - ${zonaConfig.nombre}` : "Sin Zona"} ({zonaPedidos.length})
                          </span>
                        </div>
                        {zonaPedidos.map((pedido, idx) => (
                          <MotorizadoOrderCard
                            key={pedido.id}
                            pedido={pedido}
                            userLocation={userLocation}
                            distanceText={getDistanceText(pedido)}
                            borderColor={zonaConfig?.color}
                            routeIndex={idx + 1}
                            routeTotal={zonaPedidos.length}
                            onSelect={() => setSelectedPedido(pedido)}
                            onDeliver={(p, photo, signature) =>
                              handleCardDeliver(p as Pedido, photo, signature)
                            }
                            onNovedad={(p, type, note, photo) =>
                              handleCardNovedad(p as Pedido, type, note, photo)
                            }
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            };

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Tabs defaultValue="en-camino" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="pendientes">
                      Pendientes
                      <span className="ml-1.5 text-xs opacity-70">({pendientes.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="en-camino">
                      En Camino
                      <span className="ml-1.5 text-xs opacity-70">({enCamino.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="entregados">
                      Entregados
                      <span className="ml-1.5 text-xs opacity-70">({entregados.length})</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pendientes">
                    {renderList(pendientes, "No tienes pedidos pendientes por iniciar")}
                  </TabsContent>
                  <TabsContent value="en-camino">
                    {renderList(enCamino, "No tienes pedidos en camino")}
                  </TabsContent>
                  <TabsContent value="entregados">
                    {entregados.length === 0 ? (
                      <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">
                          Aún no has entregado pedidos hoy
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {[...entregados]
                          .sort((a, b) => {
                            const ta = a.fecha_actualizacion
                              ? new Date(a.fecha_actualizacion).getTime()
                              : 0;
                            const tb = b.fecha_actualizacion
                              ? new Date(b.fecha_actualizacion).getTime()
                              : 0;
                            return tb - ta;
                          })
                          .map((pedido) => (
                            <EntregaDelDiaCard
                              key={pedido.id}
                              pedido={pedido}
                              onClick={(p) => setSelectedPedido(p as Pedido)}
                            />
                          ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            );
          })()
        )}
      </main>


      {/* Pedido Detail Modal */}
      <AnimatePresence>
        {selectedPedido && !showPhotoModal && !showNovedadModal && (
          <PedidoDetailView
            pedido={selectedPedido}
            userLocation={userLocation}
            distanceText={getDistanceText(selectedPedido)}
            isWithinRange={
              userLocation &&
              selectedPedido.latitud != null &&
              selectedPedido.longitud != null
                ? isWithinGeofence(
                    userLocation.lat,
                    userLocation.lng,
                    selectedPedido.latitud,
                    selectedPedido.longitud,
                    GEOFENCE_RADIUS,
                  )
                : false
            }
            cupoCODRestante={Math.max(0, 1500000 - motorizadoStats.codHoyUsado)}
            tiendaNombre={null}
            chatOpen={chatOpenForPedido === selectedPedido.id}
            onClose={() => setSelectedPedido(null)}
            onCall={(phone) => callClient(phone)}
            onWhatsApp={(phone) => openWhatsApp(phone)}
            onNavigate={() => openGoogleMaps(selectedPedido)}
            onWaze={() => openWaze(selectedPedido)}
            onShareLocation={() => shareRoute(selectedPedido)}
            onPayWithQR={() => setShowQRPayment(true)}
            onCapturePhoto={openPhotoCapture}
            onReportNovedad={openNovedadModal}
            onToggleChat={() =>
              setChatOpenForPedido(
                chatOpenForPedido === selectedPedido.id ? null : selectedPedido.id,
              )
            }
            chatComponent={
              <PedidoChat
                pedidoId={selectedPedido.id}
                isOpen={chatOpenForPedido === selectedPedido.id}
                onClose={() => setChatOpenForPedido(null)}
              />
            }
          />
        )}
      </AnimatePresence>

      {/* Photo Capture Modal */}
      <AnimatePresence>
        {showPhotoModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowPhotoModal(false);
              setCapturedPhoto(null);
            }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-foreground mb-4">
                Foto de Evidencia
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {capturedPhoto ? (
                <div className="space-y-4">
                  <img
                    src={capturedPhoto}
                    alt="Captura"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl bg-muted py-3 font-medium text-muted-foreground"
                    >
                      Volver a tomar
                    </button>
                    <button
                      onClick={confirmDelivery}
                      disabled={updating}
                      className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {updating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Confirmar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="h-12 w-12" />
                  <span className="font-medium">Tomar foto</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Novedad Modal - Updated with options */}
      <AnimatePresence>
        {showNovedadModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowNovedadModal(false);
              setSelectedNovedadType(null);
              setNovedadPhoto(null);
            }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-foreground mb-4">
                ⚠️ Reportar Novedad
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tipo de novedad
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {NOVEDAD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedNovedadType(option.value)}
                        className={`p-3 rounded-xl text-sm font-medium transition-all ${
                          selectedNovedadType === option.value
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {option.label}
                        {option.requiresPhoto && <span className="block text-xs opacity-75">📷 Requiere foto</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo for novedad */}
                {selectedNovedadType && NOVEDADES_REQUIRE_PHOTO.includes(selectedNovedadType) && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      📷 Foto de evidencia (obligatoria)
                    </label>
                    <input
                      ref={novedadPhotoRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleNovedadPhotoCapture}
                      className="hidden"
                    />
                    {novedadPhoto ? (
                      <div className="relative">
                        <img src={novedadPhoto} alt="Evidencia" className="w-full h-32 object-cover rounded-xl" />
                        <button
                          onClick={() => novedadPhotoRef.current?.click()}
                          className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded text-xs"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => novedadPhotoRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-400 py-6 text-orange-600"
                      >
                        <Camera className="h-6 w-6" />
                        <span>Tomar foto de evidencia</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowNovedadModal(false);
                      setSelectedNovedadType(null);
                      setNovedadPhoto(null);
                    }}
                    className="rounded-xl bg-muted py-3 font-medium text-muted-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmNovedad}
                    disabled={updating || !selectedNovedadType}
                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {updating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        Reportar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {showSignatureModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SignatureCanvas
                onSave={handleSignatureSave}
                onCancel={() => setShowSignatureModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden inputs for package photo */}
      <input
        ref={packagePhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePackagePhotoCapture}
        className="hidden"
      />

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && extendedProfile && (
          <MotorizadoProfile
            profile={extendedProfile}
            onProfileUpdate={refreshProfile}
            dailyStats={dailyStats}
            onClose={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      {user?.id && (
        <MotorizadoQRScanner
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onStartDelivery={(scannedPedido) => {
            // Update local state with the started delivery via React Query
            updatePedidoLocally(scannedPedido.id, { estado: "En Ruta" });
            // Find the full pedido in local state to select it
            const fullPedido = pedidos.find(p => p.id === scannedPedido.id);
            if (fullPedido) {
              setSelectedPedido({ ...fullPedido, estado: "En Ruta" });
            }
          }}
          motorizadoId={user.id}
        />
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
        {/* Load Manifest Button */}
        {inTransitCount > 0 && (
          <motion.button
            onClick={() => setShowLoadManifest(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg hover:opacity-90 transition-opacity"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Resumen de Carga"
          >
            <ClipboardList className="h-6 w-6" />
          </motion.button>
        )}

        {/* QR Scanner Button */}
        <motion.button
          onClick={() => setShowQRScanner(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Escanear Pedido"
        >
          <ScanLine className="h-7 w-7" />
        </motion.button>
      </div>

      {/* Offline Indicator */}
      {(!networkOnline || pendingSyncCount > 0) && (
        <motion.div
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-white text-sm font-medium shadow-lg"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          {!networkOnline ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>Sin conexión</span>
            </>
          ) : (
            <>
              <Cloud className="h-4 w-4" />
              <span>{pendingSyncCount} pendientes</span>
            </>
          )}
        </motion.div>
      )}

      {/* QR Payment Modal */}
      <QRPaymentModal
        isOpen={showQRPayment}
        onClose={() => setShowQRPayment(false)}
        amount={selectedPedido?.valor_recaudar || 0}
        orderId={selectedPedido?.id}
        clientName={selectedPedido?.cliente_nombre || undefined}
      />

      {/* Load Manifest Modal */}
      {user?.id && profile && (
        <LoadManifest
          isOpen={showLoadManifest}
          onClose={() => setShowLoadManifest(false)}
          pedidos={pedidos}
          motorizadoId={user.id}
          motorizadoName={profile.full_name || "Motorizado"}
          onConfirmExit={() => {
            fetchPedidos();
          }}
        />
      )}

      {/* Bottom Navigation - Mobile only */}
      <MotorizadoBottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "mapa") setShowMapView(true);
          if (tab === "perfil") setShowProfile(true);
        }}
        pedidosBadge={pedidosPendientesCount}
      />

      {/* Wallet Sheet - Premium con Tabs (Resumen / Movimientos / Cuenta) */}
      {user?.id && (
        <MotorizadoWalletSheet
          motorizadoId={user.id}
          score={motorizadoStats.score}
          open={activeTab === "wallet"}
          onClose={() => setActiveTab("pedidos")}
        />
      )}
    </div>
  );
};

export default MotorizadoDashboard;

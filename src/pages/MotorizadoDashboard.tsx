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
}

// Warehouse coordinates for sorting
const BODEGA_LAT = 4.6066;
const BODEGA_LNG = -74.0747;
const BODEGA_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá, Colombia";
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chatOpenForPedido, setChatOpenForPedido] = useState<number | null>(null);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
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

      // Update local state via React Query optimistic update
      updatePedidoLocally(selectedPedido.id, { 
        estado: "Entregado", 
        foto_evidencia: capturedPhoto,
        foto_paquete: packagePhoto,
        firma_cliente: signature,
      });

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

  const pendingCount = pedidos.filter(
    (p) =>
      p.estado?.toLowerCase() === "pendiente" ||
      p.estado?.toLowerCase() === "en bodega"
  ).length;
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

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayDelivered = pedidos.filter(
      (p) => p.estado?.toLowerCase() === "entregado"
    );
    const collectedAmount = todayDelivered.reduce((sum, p) => {
      if (p.metodo_pago?.toLowerCase() === "efectivo" && p.valor_recaudar) {
        return sum + Number(p.valor_recaudar);
      }
      return sum;
    }, 0);
    return {
      deliveredCount: todayDelivered.length,
      collectedAmount,
    };
  }, [pedidos]);

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

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header - Glassmorphic */}
      <header className="sticky top-0 z-40 glass-strong border-b border-white/20">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
          </div>
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <DarkModeToggle 
              isDark={isDarkMode} 
              onToggle={() => setIsDarkMode(!isDarkMode)} 
            />
            
            {/* Map Toggle - Neumorphic */}
            <button
              onClick={() => setShowMapView(!showMapView)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                showMapView ? "bg-gradient-button text-white shadow-lg" : "neu-flat hover:shadow-elevated"
              }`}
            >
              <Map className="h-5 w-5" />
            </button>
            
            {/* Profile Avatar Button - Neumorphic */}
            <button
              onClick={() => setShowProfile(true)}
              className="relative"
            >
              <Avatar className="h-11 w-11 border-2 border-white/30 shadow-md">
                <AvatarImage 
                  src={profile?.avatar_url || undefined} 
                  alt={profile?.full_name} 
                />
                <AvatarFallback className="bg-gradient-button text-white text-sm font-bold">
                  {profile ? getInitials(profile.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background shadow-md"></span>
              )}
            </button>
            
            {/* Logout - Neumorphic */}
            <button
              onClick={handleSignOut}
              className="flex h-11 w-11 items-center justify-center rounded-2xl neu-flat hover:shadow-elevated transition-all"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4">
        {/* Date Header with Greeting */}
        <DateHeader userName={profile?.full_name} />

        {/* Weather Widget */}
        <div className="mb-4">
          <WeatherWidget />
        </div>

        {/* Admin Notes / Bulletin Board */}
        <AdminNotesDisplay />

        {/* Connection Toggle */}
        {user?.id && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ConnectionToggle
              userId={user.id}
              isOnline={isOnline}
              onStatusChange={setIsOnline}
              userLocation={userLocation}
            />
          </motion.div>
        )}

        {/* GPS Status - Only show when online */}
        {isOnline && (
          <motion.div
            className={`mb-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
              geoError
                ? "bg-red-50 text-red-600 border border-red-200"
                : userLocation
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {geoLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Obteniendo ubicación GPS...</span>
              </>
            ) : geoError ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span className="flex-1">{geoError}</span>
                <button onClick={refreshLocation} className="p-1 hover:bg-red-100 rounded">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                <span className="flex-1">GPS activo - Lista ordenada por cercanía</span>
                <button onClick={refreshLocation} className="p-1 hover:bg-green-100 rounded">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* Warehouse Address */}
        <motion.div
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <MapPin className="h-4 w-4" />
          <span>Bodega: {BODEGA_ADDRESS.split(",")[0]}, Bogotá</span>
        </motion.div>

        {/* Quick Support Button */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <BodegaSupportButton />
        </motion.div>

        {/* Map View Toggle */}
        <AnimatePresence mode="wait">
          {showMapView && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-card border border-border">
              <div className="h-[300px]">
                <MapErrorBoundary fallbackMessage="Error al cargar el mapa. Verifica tu conexión y permisos de GPS.">
                  <MotorizadoMapGoogle
                    pedidos={pedidos}
                    userLocation={userLocation}
                    onPedidoClick={(pedido) => setSelectedPedido(pedido as Pedido)}
                  />
                </MapErrorBoundary>
              </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                🏭 = Bodega | 📦 = Pedidos (ordenados por cercanía) | 📍 = Tu ubicación
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <motion.div
          className="mb-6 grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-secondary/20 p-4 text-center">
            <p className="text-2xl font-bold text-secondary-foreground">
              {pendingCount}
            </p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </div>
          <div className="rounded-xl bg-primary/20 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{inTransitCount}</p>
            <p className="text-xs text-muted-foreground">En camino</p>
          </div>
          <div className="rounded-xl bg-green-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
            <p className="text-xs text-muted-foreground">Entregados</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="mb-4 flex flex-wrap items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos
          </button>
          {cortes.map((corte) => (
            <button
              key={corte}
              onClick={() => setActiveFilter(corte)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === corte
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {corte}
            </button>
          ))}
        </motion.div>

        {/* Optimize Route Button */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={() => {
              if (isRouteOptimized) {
                setIsRouteOptimized(false);
                toast.info("Orden por defecto restaurado");
              } else {
                handleOptimizeRoute();
              }
            }}
            className={`flex items-center justify-center gap-2 w-full rounded-xl py-3 px-4 font-bold transition-all active:scale-[0.98] shadow-card ${
              isRouteOptimized
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
            }`}
          >
            <Route className="h-5 w-5" />
            <span>{isRouteOptimized ? "✓ Ruta Optimizada — Toca para restablecer" : "Optimizar Mi Ruta"}</span>
          </button>
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Pedidos List */
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-foreground">
              Mis Entregas de Hoy ({filteredPedidos.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              {isRouteOptimized ? "🗺️ Ordenadas por ruta óptima (TSP)" : "Agrupadas por zona para optimizar tu ruta"}
            </p>

            {filteredPedidos.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  No hay pedidos asignados para hoy
                </p>
              </div>
            ) : (
              // Group pedidos by zona
              Object.entries(
                filteredPedidos.reduce((acc, pedido) => {
                  const zona = pedido.zona || "SIN_ZONA";
                  if (!acc[zona]) acc[zona] = [];
                  acc[zona].push(pedido);
                  return acc;
                }, {} as Record<string, Pedido[]>)
              ).map(([zona, zonaPedidos]) => {
                const zonaConfig = ZONAS[zona as ZonaCodigo];
                return (
                  <div key={zona} className="space-y-3">
                    {/* Zona Header */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${zonaConfig ? zonaConfig.bgColor : "bg-muted"}`}>
                      <span className={`text-sm font-bold ${zonaConfig ? zonaConfig.textColor : "text-muted-foreground"}`}>
                        {zonaConfig ? `${zonaConfig.codigo} - ${zonaConfig.nombre}` : "Sin Zona"} ({zonaPedidos.length})
                      </span>
                    </div>
                    
                    {/* Zona Pedidos */}
                    {zonaPedidos.map((pedido, index) => {
                      const distanceText = getDistanceText(pedido);
                      return (
                        <motion.div
                          key={pedido.id}
                          className="rounded-2xl bg-card p-4 shadow-card ml-2 border-l-4"
                          style={{ borderLeftColor: zonaConfig?.color || "#9ca3af" }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => setSelectedPedido(pedido)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {pedido.numero_guia || `#${pedido.id}`}
                                </span>
                                {pedido.corte_horario && (
                                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                                    {pedido.corte_horario}
                                  </span>
                                )}
                                {distanceText && (
                                  <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                                    📍 {distanceText}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm font-medium text-foreground">
                                {pedido.cliente_nombre || "Cliente sin nombre"}
                              </p>
                              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span>{pedido.direccion_entrega || "Sin dirección"}</span>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap ${getStatusColor(
                                pedido.estado
                              )}`}
                            >
                              {pedido.estado?.includes("Novedad")
                                ? "Novedad"
                                : pedido.estado || "Sin estado"}
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <PedidoQuickActions pedido={pedido} userLocation={userLocation} />
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </main>

      {/* Pedido Detail Modal */}
      <AnimatePresence>
        {selectedPedido && !showPhotoModal && !showNovedadModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPedido(null)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl bg-card p-6 max-h-[80vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />

              <h3 className="text-xl font-bold text-foreground">
                {selectedPedido.numero_guia || `Pedido #${selectedPedido.id}`}
              </h3>

              {/* Distance indicator */}
              {userLocation && selectedPedido.latitud && selectedPedido.longitud && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isWithinGeofence(
                        userLocation.lat,
                        userLocation.lng,
                        selectedPedido.latitud,
                        selectedPedido.longitud,
                        GEOFENCE_RADIUS
                      )
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    📍 A {getDistanceText(selectedPedido)} del destino
                  </span>
                  {isWithinGeofence(
                    userLocation.lat,
                    userLocation.lng,
                    selectedPedido.latitud,
                    selectedPedido.longitud,
                    GEOFENCE_RADIUS
                  ) ? (
                    <span className="text-xs text-green-600">✓ Dentro del rango</span>
                  ) : (
                    <span className="text-xs text-amber-600">⚠ Fuera del rango ({GEOFENCE_RADIUS}m)</span>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.cliente_nombre || "Cliente sin nombre"}
                    </p>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => callClient(selectedPedido.client_phone)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35] text-white transition-transform active:scale-95"
                      aria-label="Llamar cliente"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openWhatsApp(selectedPedido.client_phone)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform active:scale-95"
                      aria-label="WhatsApp"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.direccion_entrega || "Sin dirección"}
                    </p>
                    <p className="text-sm text-muted-foreground">Dirección de entrega</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.corte_horario || "Sin corte"}
                    </p>
                    <p className="text-sm text-muted-foreground">Corte horario</p>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons - Large & touch-friendly */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => openGoogleMaps(selectedPedido)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#4285F4] py-4 font-bold text-white transition-all active:scale-95 shadow-md"
                >
                  <Navigation className="h-7 w-7" />
                  <span>Google Maps</span>
                </button>
                <button
                  onClick={() => openWaze(selectedPedido)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#33CCFF] py-4 font-bold text-white transition-all active:scale-95 shadow-md"
                >
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.54 6.63A9.44 9.44 0 0012 2.5a9.44 9.44 0 00-8.54 4.13C1.57 9.19 2.06 12.6 4.5 15c1 1 1.5 2 1.5 3.5v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-1.5.5-2.5 1.5-3.5a6.5 6.5 0 001.5-7 1 1 0 111.8.9 4.5 4.5 0 01-1 4.85c-1.32 1.32-1.8 2.75-1.8 4.75v1a1 1 0 001 1h2a1 1 0 001-1v-1c0-2 .48-3.43 1.8-4.75A7.5 7.5 0 0020.54 6.63z"/>
                    <circle cx="9" cy="9" r="1.5"/>
                    <circle cx="15" cy="9" r="1.5"/>
                  </svg>
                  <span>Waze</span>
                </button>
              </div>

              {/* Share Route Button */}
              <button
                onClick={() => shareRoute(selectedPedido)}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] py-3 font-bold text-white transition-all active:scale-95 shadow-md"
              >
                <Share2 className="h-5 w-5" />
                Compartir mi ubicación con cliente
              </button>

              {/* QR Payment Button - Show for COD orders */}
              {selectedPedido.metodo_pago?.toLowerCase() === "efectivo" && selectedPedido.valor_recaudar && (
                <button
                  onClick={() => setShowQRPayment(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 py-3 font-bold text-white transition-all active:scale-95 shadow-md"
                >
                  <QrCode className="h-5 w-5" />
                  Pagar con QR (${selectedPedido.valor_recaudar?.toLocaleString("es-CO")})
                </button>
              )}

              {/* Flex badge */}
              {selectedPedido.canal === "FLEX" && (
                <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-center">
                  <p className="text-xs font-bold text-amber-600">⚡ PEDIDO FLEX — Foto + GPS obligatorios</p>
                </div>
              )}

              {/* Action Buttons - Only show if order is in "En Ruta" status */}
              {selectedPedido.estado?.toLowerCase() === "en ruta" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={openNovedadModal}
                    className="flex items-center justify-center gap-2 rounded-xl bg-destructive py-3 font-bold text-destructive-foreground transition-all active:scale-95 shadow-md"
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Novedad
                  </button>
                  <button
                    onClick={openPhotoCapture}
                    disabled={selectedPedido.canal === "FLEX" && !userLocation}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="h-5 w-5" />
                    Entregar
                  </button>
                </div>
              )}

              {/* Show status message for non-actionable orders */}
              {selectedPedido.estado?.toLowerCase() !== "en ruta" && (
                <div className="mt-3 rounded-xl bg-muted p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedPedido.estado?.toLowerCase() === "entregado" 
                      ? "✅ Este pedido ya fue entregado"
                      : selectedPedido.estado?.toLowerCase() === "novedad"
                      ? "⚠️ Este pedido tiene novedad reportada"
                      : selectedPedido.estado?.toLowerCase() === "asignado"
                      ? "📦 Usa el escáner QR para iniciar la entrega"
                      : `Estado actual: ${selectedPedido.estado}`
                    }
                  </p>
                </div>
              )}

              {selectedPedido.foto_evidencia && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Foto de evidencia:</p>
                  <img
                    src={selectedPedido.foto_evidencia}
                    alt="Evidencia"
                    className="w-full h-32 object-cover rounded-xl"
                  />
                </div>
              )}

              {/* Chat Button */}
              <button
                onClick={() => setChatOpenForPedido(chatOpenForPedido === selectedPedido.id ? null : selectedPedido.id)}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-muted py-3 font-medium text-foreground hover:bg-muted/80 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                {chatOpenForPedido === selectedPedido.id ? "Cerrar Chat" : "Chat con Tienda"}
              </button>

              {/* Inline Chat */}
              <PedidoChat
                pedidoId={selectedPedido.id}
                isOpen={chatOpenForPedido === selectedPedido.id}
                onClose={() => setChatOpenForPedido(null)}
              />
            </motion.div>
          </motion.div>
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
    </div>
  );
};

export default MotorizadoDashboard;

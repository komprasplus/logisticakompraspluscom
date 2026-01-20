import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import useGeolocation, { calculateDistance, isWithinGeofence } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";
import MotorizadoMap from "@/components/MotorizadoMap";
import PedidoQuickActions from "@/components/PedidoQuickActions";
import BodegaSupportButton from "@/components/BodegaSupportButton";
import SignatureCanvas from "@/components/SignatureCanvas";
import ConnectionToggle from "@/components/ConnectionToggle";
import MotorizadoProfile from "@/components/MotorizadoProfile";
import DateHeader from "@/components/DateHeader";
import AdminNotesDisplay from "@/components/AdminNotesDisplay";
import MotorizadoQRScanner from "@/components/MotorizadoQRScanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NOVEDAD_OPTIONS, NOVEDADES_REQUIRE_PHOTO, type NovedadType, getStatusConfig, isOperationalStatus } from "@/lib/orderStatuses";

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
}

// Warehouse coordinates for sorting
const BODEGA_LAT = 4.6066;
const BODEGA_LNG = -74.0747;
const BODEGA_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá, Colombia";
const SUPPORT_PHONE = "324 222 3825";
const GEOFENCE_RADIUS = 200; // 200 meters

const MotorizadoDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const novedadPhotoRef = useRef<HTMLInputElement>(null);
  const packagePhotoRef = useRef<HTMLInputElement>(null);
  const { signOut, profile, refreshProfile, user } = useAuth();
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

  useEffect(() => {
    if (user?.id) {
      fetchPedidos();
    }
  }, [user?.id]);

  // Sort and filter pedidos - prioritize by proximity to current location or bodega
  useEffect(() => {
    let filtered = [...pedidos];

    if (activeFilter) {
      filtered = filtered.filter((p) => p.corte_horario === activeFilter);
    }

    // Get reference point (user location or bodega)
    const refLat = userLocation?.lat ?? BODEGA_LAT;
    const refLng = userLocation?.lng ?? BODEGA_LNG;

    // Sort by proximity
    filtered.sort((a, b) => {
      // First, prioritize non-delivered orders
      const aDelivered = a.estado?.toLowerCase() === "entregado";
      const bDelivered = b.estado?.toLowerCase() === "entregado";
      if (aDelivered && !bDelivered) return 1;
      if (!aDelivered && bDelivered) return -1;

      // Then prioritize non-novedad orders
      const aNovedad = a.estado?.toLowerCase().includes("novedad");
      const bNovedad = b.estado?.toLowerCase().includes("novedad");
      if (aNovedad && !bNovedad) return 1;
      if (!aNovedad && bNovedad) return -1;

      // If both have coordinates, sort by distance
      const aHasCoords = a.latitud != null && a.longitud != null;
      const bHasCoords = b.latitud != null && b.longitud != null;

      if (aHasCoords && bHasCoords) {
        const distA = calculateDistance(refLat, refLng, a.latitud!, a.longitud!);
        const distB = calculateDistance(refLat, refLng, b.latitud!, b.longitud!);
        return distA - distB;
      }

      // Orders with coordinates first
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;

      // Fallback to corte_horario
      const corteOrder: { [key: string]: number } = {
        "Corte 1": 1,
        "Corte 2": 2,
        "Corte 3": 3,
      };
      const orderA = corteOrder[a.corte_horario || ""] || 99;
      const orderB = corteOrder[b.corte_horario || ""] || 99;
      return orderA - orderB;
    });

    setFilteredPedidos(filtered);
  }, [activeFilter, pedidos, userLocation]);

  const fetchPedidos = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      // Filter by motorizado_id (UUID) - RLS enforces this at database level
      // No date filter - show all pending orders including from previous days
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("motorizado_id", user.id)
        .in("estado", ["Asignado", "En Ruta", "Novedad"])
        .order("id", { ascending: true });

      if (error) throw error;
      // Filter out cancelled orders from motorizado view
      const operationalPedidos = (data || []).filter(p => isOperationalStatus(p.estado));
      setPedidos(operationalPedidos);
      setFilteredPedidos(operationalPedidos);
    } catch (error) {
      console.error("Error fetching pedidos:", error);
      toast.error("Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openPhotoCapture = () => {
    if (!selectedPedido) return;

    // Check geofence before allowing delivery
    if (!validateGeofence(selectedPedido)) {
      return;
    }

    setShowPhotoModal(true);
    setCapturedPhoto(null);
  };

  const validateGeofence = (pedido: Pedido): boolean => {
    // If pedido has no coordinates, allow the action (can't validate)
    if (pedido.latitud == null || pedido.longitud == null) {
      return true;
    }

    // If user location not available, show error
    if (!userLocation) {
      toast.error("No se puede obtener tu ubicación GPS. Por favor habilita el GPS y vuelve a intentar.", {
        duration: 5000,
      });
      return false;
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
      toast.error(
        `Debes estar en la ubicación del cliente para reportar la entrega o novedad. Estás a ${Math.round(distance)} metros del destino (máximo ${GEOFENCE_RADIUS}m).`,
        { duration: 6000 }
      );
      return false;
    }

    return true;
  };

  const confirmDelivery = async () => {
    if (!selectedPedido) return;

    // Check if we have at least the evidence photo
    if (!capturedPhoto) {
      toast.error("Debes tomar una foto de evidencia");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Entregado",
          foto_evidencia: capturedPhoto,
          foto_paquete: packagePhoto || null,
          firma_cliente: signature || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", selectedPedido.id);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === selectedPedido.id
            ? { 
                ...p, 
                estado: "Entregado", 
                foto_evidencia: capturedPhoto,
                foto_paquete: packagePhoto,
                firma_cliente: signature,
              }
            : p
        )
      );

      setSelectedPedido(null);
      setShowPhotoModal(false);
      setShowSignatureModal(false);
      setCapturedPhoto(null);
      setPackagePhoto(null);
      setSignature(null);
      toast.success("✅ Pedido entregado exitosamente con firma y evidencia");
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  const openNovedadModal = () => {
    if (!selectedPedido) return;

    // Check geofence before allowing novedad
    if (!validateGeofence(selectedPedido)) {
      return;
    }

    setShowNovedadModal(true);
    setSelectedNovedadType(null);
    setNovedadReason("");
    setNovedadPhoto(null);
  };

  const handleNovedadPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNovedadPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePackagePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPackagePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
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
      const updateData: any = {
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

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === selectedPedido.id
            ? { 
                ...p, 
                estado: "Novedad",
                tipo_novedad: selectedNovedadType,
                foto_evidencia: novedadPhoto || p.foto_evidencia,
              }
            : p
        )
      );

      setSelectedPedido(null);
      setShowNovedadModal(false);
      setSelectedNovedadType(null);
      setNovedadReason("");
      setNovedadPhoto(null);
      toast.success("⚠️ Novedad reportada - Pin actualizado a naranja");
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMapView(!showMapView)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                showMapView ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              <Map className="h-5 w-5" />
            </button>
            
            {/* Profile Avatar Button */}
            <button
              onClick={() => setShowProfile(true)}
              className="relative"
            >
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage 
                  src={profile?.avatar_url || undefined} 
                  alt={profile?.full_name} 
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {profile ? getInitials(profile.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
              )}
            </button>
            
            <button
              onClick={handleSignOut}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4">
        {/* Date Header with Greeting */}
        <DateHeader userName={profile?.full_name} />

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
                  <MotorizadoMap
                    pedidos={pedidos}
                    userLocation={userLocation}
                    onPedidoClick={(pedido) => setSelectedPedido(pedido as Pedido)}
                  />
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
            <p className="text-xs text-muted-foreground">Agrupadas por zona para optimizar tu ruta</p>

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

              {/* Action Buttons */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={openNovedadModal}
                  disabled={selectedPedido.estado?.toLowerCase() === "entregado"}
                  className="flex items-center justify-center gap-2 rounded-xl bg-destructive py-3 font-bold text-destructive-foreground transition-all active:scale-95 disabled:opacity-50 shadow-md"
                >
                  <AlertTriangle className="h-5 w-5" />
                  Novedad
                </button>
                <button
                  onClick={openPhotoCapture}
                  disabled={selectedPedido.estado?.toLowerCase() === "entregado"}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50 shadow-md"
                >
                  <Camera className="h-5 w-5" />
                  Entregar
                </button>
              </div>

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
            // Update local state with the started delivery
            setPedidos((prev) =>
              prev.map((p) =>
                p.id === scannedPedido.id ? { ...p, estado: "En Ruta" } : p
              )
            );
            // Find the full pedido in local state to select it
            const fullPedido = pedidos.find(p => p.id === scannedPedido.id);
            if (fullPedido) {
              setSelectedPedido({ ...fullPedido, estado: "En Ruta" });
            }
          }}
          motorizadoId={user.id}
        />
      )}

      {/* Floating QR Scanner Button */}
      <motion.button
        onClick={() => setShowQRScanner(true)}
        className="fixed bottom-24 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Escanear Pedido"
      >
        <ScanLine className="h-7 w-7" />
      </motion.button>
    </div>
  );
};

export default MotorizadoDashboard;

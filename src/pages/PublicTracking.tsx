import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Loader2,
  Phone,
  Warehouse,
  MessageCircle,
  ChevronUp,
  DollarSign,
  Navigation,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ── Types ──────────────────────────────────────────────
interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  client_user_id: string | null;
  latitud: number | null;
  longitud: number | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  quantity: number | null;
}

interface StoreProfile {
  store_name: string | null;
  logo_url: string | null;
}

interface MotorizadoProfile {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  vehicle_plate: string | null;
  last_location_lat: number | null;
  last_location_lng: number | null;
}

interface GpsPoint {
  lat: number;
  lng: number;
}

// ── Constants ──────────────────────────────────────────
const SUPPORT_PHONE_CLEAN = "3242223825";
const BOGOTA_CENTER: GpsPoint = { lat: 4.711, lng: -74.0721 };

// ── Helpers ────────────────────────────────────────────
const getStatusInfo = (status: string | null) => {
  const s = status?.toLowerCase();
  switch (s) {
    case "recibido":
    case "pedido recibido":
      return { label: "Pedido Recibido", hero: "¡Recibimos tu pedido!", step: 1 };
    case "en bodega":
    case "pendiente":
    case "recibido en bodega":
      return { label: "En Bodega", hero: "Tu pedido está siendo preparado", step: 2 };
    case "asignado":
      return { label: "Asignado", hero: "Un motorizado recogerá tu pedido", step: 2 };
    case "en ruta":
    case "en camino":
      return { label: "En Camino", hero: "¡Tu pedido está en camino! 🏍️", step: 3 };
    case "entregado":
      return { label: "Entregado", hero: "¡Pedido entregado con éxito! ✅", step: 4 };
    default:
      return { label: status || "Procesando", hero: "Tu pedido está siendo procesado", step: 1 };
  }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

// Extract GPS from webhook payload
const extractGps = (payload: Record<string, unknown>): GpsPoint | null => {
  const lat = Number(
    payload?.latitude ?? payload?.lat ?? payload?.ubicacion_lat ??
    (payload?.location as any)?.latitude ?? (payload?.location as any)?.lat
  );
  const lng = Number(
    payload?.longitude ?? payload?.lng ?? payload?.ubicacion_lng ??
    (payload?.location as any)?.longitude ?? (payload?.location as any)?.lng
  );
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
};

// ── Leaflet Map (lazy) ─────────────────────────────────
const LeafletMap = ({ driverPos, destinationPos }: { driverPos: GpsPoint | null; destinationPos: GpsPoint | null }) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [L, setL] = useState<any>(null);

  // Dynamically import Leaflet
  useEffect(() => {
    let cancelled = false;
    const loadLeaflet = async () => {
      const leaflet = await import("leaflet");
      // Load CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!cancelled) {
        setL(leaflet.default || leaflet);
        setLeafletReady(true);
      }
    };
    loadLeaflet();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!leafletReady || !L) return;
    const container = document.getElementById("tracking-map");
    if (!container) return;

    // Don't re-init
    if (mapRef.current) return;

    const center = driverPos || destinationPos || BOGOTA_CENTER;
    const map = L.map(container, {
      center: [center.lat, center.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Destination marker
    if (destinationPos) {
      const destIcon = L.divIcon({
        html: `<div style="width:32px;height:32px;background:hsl(0,84%,60%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <div style="transform:rotate(45deg);color:white;font-size:14px;font-weight:bold;">📍</div>
        </div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      L.marker([destinationPos.lat, destinationPos.lng], { icon: destIcon }).addTo(map);
    }

    // Driver marker
    if (driverPos) {
      const driverIcon = L.divIcon({
        html: `<div class="driver-marker-pulse"><div class="driver-marker-inner">🏍️</div></div>`,
        className: "",
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      markerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon: driverIcon }).addTo(map);
    }

    mapRef.current = map;

    // Fit bounds if both points exist
    if (driverPos && destinationPos) {
      const bounds = L.latLngBounds([
        [driverPos.lat, driverPos.lng],
        [destinationPos.lat, destinationPos.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [leafletReady, L]); // only init once

  // Smoothly update driver marker position
  useEffect(() => {
    if (!markerRef.current || !driverPos || !L) return;
    const currentLatLng = markerRef.current.getLatLng();
    const targetLat = driverPos.lat;
    const targetLng = driverPos.lng;

    // Animate over 1s
    let start: number | null = null;
    const duration = 1000;
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const lat = startLat + (targetLat - startLat) * eased;
      const lng = startLng + (targetLng - startLng) * eased;
      markerRef.current?.setLatLng([lat, lng]);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    // Pan map
    mapRef.current?.panTo([targetLat, targetLng], { animate: true, duration: 1 });
  }, [driverPos, L]);

  return (
    <div id="tracking-map" className="absolute inset-0 z-0" />
  );
};

// ── Timeline Stepper ───────────────────────────────────
const TimelineStepper = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { key: 1, label: "Preparando", icon: Package },
    { key: 2, label: "En Bodega", icon: Warehouse },
    { key: 3, label: "En Camino", icon: Truck },
    { key: 4, label: "Entregado", icon: CheckCircle2 },
  ];

  return (
    <div className="flex items-center justify-between px-2">
      {steps.map((step, i) => {
        const isCompleted = step.key < currentStep;
        const isCurrent = step.key === currentStep;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={`flex-1 h-0.5 transition-colors duration-500 ${isCompleted || isCurrent ? "bg-primary" : "bg-muted"}`} />
              )}
              <motion.div
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all flex-shrink-0 ${
                  isCompleted
                    ? "bg-green-500 border-green-400 text-white"
                    : isCurrent
                    ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-card border-muted text-muted-foreground"
                }`}
                initial={{ scale: 0.8 }}
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                transition={{ type: "spring" }}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                {isCurrent && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative rounded-full h-3 w-3 bg-primary border-2 border-white" />
                  </span>
                )}
              </motion.div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 transition-colors duration-500 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
            <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight ${
              isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
            }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// ██  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
const PublicTracking = () => {
  const { id_guia } = useParams<{ id_guia: string }>();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [driver, setDriver] = useState<MotorizadoProfile | null>(null);
  const [driverGps, setDriverGps] = useState<GpsPoint | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(true);

  // ── Fetch order via secure RPC ───────────────────────
  useEffect(() => {
    if (!id_guia) { setError("Número de guía no proporcionado"); setIsLoading(false); return; }

    const fetchTracking = async () => {
      try {
        const { data, error: e } = await supabase.rpc("get_public_tracking_info", {
          search_tracking_number: id_guia.trim(),
        });

        if (e) throw e;

        const result = data as any;
        if (!result || !result.found) {
          setError("No encontramos ninguna guía con este número. Por favor verifica los datos.");
          return;
        }

        // Map RPC result to local state
        const pedido: Pedido = {
          id: 0,
          numero_guia: result.numero_guia,
          cliente_nombre: result.cliente_nombre,
          direccion_entrega: result.direccion_entrega,
          estado: result.estado,
          motorizado_asignado: result.motorizado_nombre,
          motorizado_id: null,
          client_user_id: null,
          latitud: result.latitud,
          longitud: result.longitud,
          valor_recaudar: result.valor_recaudar,
          metodo_pago: result.metodo_pago,
          producto_nombre: result.producto_nombre,
          quantity: result.quantity,
        };
        setOrder(pedido);

        setStore({
          store_name: result.store_name,
          logo_url: result.store_logo,
        });

        if (result.motorizado_nombre) {
          const driverProfile: MotorizadoProfile = {
            full_name: result.motorizado_nombre,
            phone: result.motorizado_phone,
            avatar_url: result.motorizado_avatar,
            vehicle_plate: result.motorizado_placa,
            last_location_lat: result.motorizado_lat,
            last_location_lng: result.motorizado_lng,
          };
          setDriver(driverProfile);
          if (result.motorizado_lat && result.motorizado_lng) {
            setDriverGps({ lat: result.motorizado_lat, lng: result.motorizado_lng });
          }
        }
      } catch (err) {
        console.error(err);
        setError("Error al buscar el pedido. Intenta de nuevo.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTracking();
  }, [id_guia]);

  // ── Realtime: refresh via RPC on order status changes ─
  useEffect(() => {
    if (!order?.numero_guia) return;
    const channel = supabase
      .channel(`tracking-realtime-${order.numero_guia}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, async () => {
        // Re-fetch via RPC on any pedidos update (filtered client-side by guia)
        const { data } = await supabase.rpc("get_public_tracking_info", {
          search_tracking_number: order.numero_guia!,
        });
        if (data?.found) {
          setOrder((prev) => prev ? {
            ...prev,
            estado: data.estado,
            latitud: data.latitud,
            longitud: data.longitud,
            valor_recaudar: data.valor_recaudar,
          } : prev);
          if (data.motorizado_nombre) {
            setDriver({
              full_name: data.motorizado_nombre,
              phone: data.motorizado_phone,
              avatar_url: data.motorizado_avatar,
              vehicle_plate: data.motorizado_placa,
              last_location_lat: data.motorizado_lat,
              last_location_lng: data.motorizado_lng,
            });
          }
          if (data.motorizado_lat && data.motorizado_lng) {
            setDriverGps({ lat: data.motorizado_lat, lng: data.motorizado_lng });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.numero_guia]);

  // ── Realtime: GPS from webhook_logs_incoming ─────────
  useEffect(() => {
    if (!order?.numero_guia) return;
    const guia = order.numero_guia.toLowerCase();

    const channel = supabase
      .channel("tracking-gps-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "webhook_logs_incoming" }, (payload) => {
        const p = (payload.new as any).payload as Record<string, unknown>;
        const g = ((p?.guia as string) ?? (p?.tracking as string) ?? (p?.numero_guia as string) ?? "").toLowerCase();
        if (g.includes(guia)) {
          const gps = extractGps(p);
          if (gps) setDriverGps(gps);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order?.numero_guia]);

  // ── Derived ──────────────────────────────────────────
  const statusInfo = order ? getStatusInfo(order.estado) : null;
  const destinationPos = order?.latitud && order?.longitud ? { lat: order.latitud, lng: order.longitud } : null;
  const isEnRuta = statusInfo?.step === 3;
  const isCOD = order?.metodo_pago?.toLowerCase() !== "anticipado";
  const displayName = store?.store_name || "Plus Envíos";

  const openWhatsApp = () => {
    if (!driver?.phone) return;
    const phone = driver.phone.replace(/\D/g, "");
    window.open(`https://wa.me/57${phone}?text=${encodeURIComponent("Hola, ¿cuánto falta para mi entrega?")}`, "_blank");
  };

  const callDriver = () => {
    if (!driver?.phone) return;
    window.open(`tel:+57${driver.phone.replace(/\D/g, "")}`, "_self");
  };

  // ── LOADING ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Buscando tu pedido...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          className="max-w-sm w-full rounded-3xl bg-card p-8 text-center shadow-lg border border-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <Package className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Guía no encontrada</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Link to="/rastreo" className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
              Buscar otra guía
            </Link>
            <a
              href={`https://wa.me/57${SUPPORT_PHONE_CLEAN}?text=${encodeURIComponent("Hola, necesito ayuda con mi guía " + (id_guia || ""))}`}
              className="rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Soporte
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!order || !statusInfo) return null;

  // ── MAIN RENDER ──────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* CSS for driver marker animation */}
      <style>{`
        .driver-marker-pulse {
          width: 48px; height: 48px; position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .driver-marker-pulse::before {
          content: ''; position: absolute; inset: 0;
          border-radius: 50%; background: hsl(191 100% 50% / 0.3);
          animation: driverPulse 2s ease-out infinite;
        }
        .driver-marker-inner {
          width: 36px; height: 36px; border-radius: 50%;
          background: hsl(191 100% 50%); border: 3px solid white;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; z-index: 1;
        }
        @keyframes driverPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .bottom-sheet {
          transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      {/* ═══ FULL-SCREEN MAP ═══ */}
      <div className="absolute inset-0 z-0">
        <LeafletMap driverPos={driverGps} destinationPos={destinationPos} />
      </div>

      {/* ═══ GLASSMORPHISM TOP BAR ═══ */}
      <motion.header
        className="relative z-20 mx-3 mt-3 rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.08)",
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {store?.logo_url ? (
            <img src={store.logo_url} alt={displayName} className="h-9 w-9 rounded-full object-cover border-2 border-primary/20 flex-shrink-0" />
          ) : (
            <BrandLogo size="sm" showIcon />
          )}
          {store?.store_name && (
            <span className="text-xs font-semibold text-foreground truncate hidden sm:block">{store.store_name}</span>
          )}
        </div>

        <div className="flex-1 text-center px-2">
          <motion.p
            className="text-sm sm:text-base font-bold text-foreground leading-tight"
            key={statusInfo.hero}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {statusInfo.hero}
          </motion.p>
        </div>

        {/* Live badge */}
        {isEnRuta && driverGps && (
          <div className="flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="text-[10px] font-bold text-white uppercase tracking-wide">En vivo</span>
          </div>
        )}
      </motion.header>

      {/* ═══ BOTTOM SHEET ═══ */}
      <motion.div
        className="relative z-20 mt-auto mx-2 mb-2 rounded-t-3xl sm:rounded-3xl overflow-hidden bottom-sheet"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          maxHeight: sheetExpanded ? "70vh" : "180px",
        }}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {/* Handle */}
        <button
          onClick={() => setSheetExpanded(!sheetExpanded)}
          className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </button>

        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: "calc(70vh - 40px)" }}>
          {/* ── Guia + Status ── */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Guía</p>
              <p className="text-base font-bold text-foreground">{order.numero_guia || `#${order.id}`}</p>
            </div>
            <motion.span
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.6 }}
            >
              {statusInfo.label}
            </motion.span>
          </div>

          {/* ── Timeline Stepper ── */}
          <div className="mb-5">
            <TimelineStepper currentStep={statusInfo.step} />
          </div>

          {/* ── Driver Section ── */}
          <AnimatePresence>
            {driver && (
              <motion.div
                className="mb-4 rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "rgba(0,209,255,0.08)", border: "1px solid rgba(0,209,255,0.15)" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-md flex-shrink-0">
                  <AvatarImage src={driver.avatar_url || undefined} alt={driver.full_name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                    {getInitials(driver.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{driver.full_name}</p>
                  {driver.vehicle_plate && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{driver.vehicle_plate}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tu motorizado</p>
                </div>
                {driver.phone && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={callDriver}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={openWhatsApp}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md active:scale-95 transition-transform"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── COD Payment Block ── */}
          {isCOD && order.valor_recaudar && order.valor_recaudar > 0 && (
            <motion.div
              className="mb-4 rounded-2xl p-4 text-center"
              style={{
                background: "linear-gradient(135deg, rgba(0,209,255,0.12) 0%, rgba(0,153,204,0.08) 100%)",
                border: "1px solid rgba(0,209,255,0.2)",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Valor a Pagar (Contra Entrega)
                </span>
              </div>
              <p className="text-3xl font-black text-foreground">
                {formatCurrency(order.valor_recaudar)}
              </p>
            </motion.div>
          )}

          {/* ── Order Details ── */}
          <div className="space-y-3 mb-4">
            {order.producto_nombre && (
              <div className="flex items-start gap-3 rounded-xl bg-card/60 p-3 border border-border/50">
                <Package className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Producto</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {order.producto_nombre}
                    {order.quantity && order.quantity > 1 && <span className="text-muted-foreground"> × {order.quantity}</span>}
                  </p>
                </div>
              </div>
            )}
            {order.direccion_entrega && (
              <div className="flex items-start gap-3 rounded-xl bg-card/60 p-3 border border-border/50">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Dirección de entrega</p>
                  <p className="text-sm font-semibold text-foreground">{order.direccion_entrega}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── WhatsApp Support ── */}
          <a
            href={`https://wa.me/57${SUPPORT_PHONE_CLEAN}?text=${encodeURIComponent(`Hola, consulta sobre guía ${order.numero_guia || order.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#25D366] py-3 text-sm font-bold text-white active:scale-[0.98] transition-transform shadow-sm"
          >
            <MessageCircle className="h-4 w-4" />
            Contactar Soporte
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default PublicTracking;

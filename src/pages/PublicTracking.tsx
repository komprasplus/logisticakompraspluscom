import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Phone,
  Warehouse,
  MessageCircle,
  DollarSign,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import MotorcycleIcon from "@/components/MotorcycleIcon";

// ── Types ──────────────────────────────────────────────
interface Pedido {
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  motorizado_asignado: string | null;
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

interface GpsPoint { lat: number; lng: number; }

// ── Constants ──────────────────────────────────────────
const SUPPORT_PHONE = "3242223825";
const BOGOTA: GpsPoint = { lat: 4.711, lng: -74.0721 };

// ── Helpers ────────────────────────────────────────────
const getStatusInfo = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case "recibido": case "pedido recibido":
      return { label: "Recibido", step: 1 };
    case "en bodega": case "pendiente": case "recibido en bodega": case "asignado":
      return { label: "Preparando", step: 2 };
    case "en ruta": case "en camino":
      return { label: "En Camino", step: 3 };
    case "entregado": case "liquidado": case "pagado":
      return { label: "Entregado", step: 4 };
    default:
      return { label: status || "Procesando", step: 1 };
  }
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const extractGps = (p: Record<string, unknown>): GpsPoint | null => {
  const lat = Number(p?.latitude ?? p?.lat ?? p?.ubicacion_lat ?? (p?.location as any)?.latitude ?? (p?.location as any)?.lat);
  const lng = Number(p?.longitude ?? p?.lng ?? p?.ubicacion_lng ?? (p?.location as any)?.longitude ?? (p?.location as any)?.lng);
  return isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 ? null : { lat, lng };
};

// ═══════════════════════════════════════════════════════
// ██  LEAFLET MAP (lazy loaded)
// ═══════════════════════════════════════════════════════
const LeafletMap = ({ driverPos, destPos }: { driverPos: GpsPoint | null; destPos: GpsPoint | null }) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!cancelled) setL(leaflet.default || leaflet);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!L) return;
    const el = document.getElementById("tracking-map");
    if (!el || mapRef.current) return;

    const center = driverPos || destPos || BOGOTA;
    const map = L.map(el, { center: [center.lat, center.lng], zoom: 15, zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    if (destPos) {
      L.marker([destPos.lat, destPos.lng], {
        icon: L.divIcon({
          html: `<div style="width:36px;height:36px;background:hsl(var(--primary));border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:16px;">📍</div></div>`,
          className: "", iconSize: [36, 36], iconAnchor: [18, 36],
        }),
      }).addTo(map);
    }

    if (driverPos) {
      markerRef.current = L.marker([driverPos.lat, driverPos.lng], {
        icon: L.divIcon({
          html: `<div class="driver-pulse"><div class="driver-dot">🏍️</div></div>`,
          className: "", iconSize: [52, 52], iconAnchor: [26, 26],
        }),
      }).addTo(map);
    }

    mapRef.current = map;

    if (driverPos && destPos) {
      map.fitBounds(L.latLngBounds([[driverPos.lat, driverPos.lng], [destPos.lat, destPos.lng]]), { padding: [70, 70] });
    }

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [L]);

  // Smooth marker interpolation
  useEffect(() => {
    if (!markerRef.current || !driverPos || !L) return;
    const cur = markerRef.current.getLatLng();
    let start: number | null = null;
    const sLat = cur.lat, sLng = cur.lng;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      const e = 1 - Math.pow(1 - p, 3);
      markerRef.current?.setLatLng([sLat + (driverPos.lat - sLat) * e, sLng + (driverPos.lng - sLng) * e]);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    mapRef.current?.panTo([driverPos.lat, driverPos.lng], { animate: true, duration: 1 });
  }, [driverPos, L]);

  return <div id="tracking-map" className="absolute inset-0" />;
};

// ═══════════════════════════════════════════════════════
// ██  TIMELINE STEPPER — minimal horizontal
// ═══════════════════════════════════════════════════════
const steps = [
  { key: 1, label: "Recibido", icon: Package },
  { key: 2, label: "Preparando", icon: Warehouse },
  { key: 3, label: "En Camino", icon: Truck },
  { key: 4, label: "Entregado", icon: CheckCircle2 },
] as const;

const Timeline = ({ current }: { current: number }) => (
  <div className="flex items-center w-full">
    {steps.map((s, i) => {
      const done = s.key < current;
      const active = s.key === current;
      const Icon = s.icon;
      return (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <motion.div
              className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                done
                  ? "bg-green-500 border-green-400 text-white"
                  : active
                  ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted/60 border-muted-foreground/20 text-muted-foreground"
              }`}
              animate={{ scale: active ? 1.15 : 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              {active && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative rounded-full h-3 w-3 bg-primary border-2 border-white" />
                </span>
              )}
            </motion.div>
            <span className={`mt-1.5 text-[10px] font-bold text-center leading-tight ${
              done || active ? "text-foreground" : "text-muted-foreground/60"
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-[3px] mx-1 rounded-full transition-colors duration-700 ${
              done ? "bg-green-400" : active ? "bg-primary/40" : "bg-muted-foreground/10"
            }`} />
          )}
        </div>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════
// ██  SKELETON LOADER
// ═══════════════════════════════════════════════════════
const TrackingSkeleton = () => (
  <div className="fixed inset-0 flex flex-col bg-muted/30">
    {/* Map skeleton */}
    <div className="flex-1 bg-muted animate-pulse" style={{ minHeight: "55%" }} />
    {/* Bottom sheet skeleton */}
    <div className="bg-background rounded-t-3xl -mt-6 relative z-10 p-6 space-y-5" style={{ minHeight: "45%" }}>
      <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 mb-4" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="flex items-center justify-between gap-2">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-10 rounded-full" />)}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════
// ██  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
const PublicTracking = () => {
  const { id_guia } = useParams<{ id_guia: string }>();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [driver, setDriver] = useState<MotorizadoProfile | null>(null);
  const [driverGps, setDriverGps] = useState<GpsPoint | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ── Fetch via RPC ───────────────────────────────────
  useEffect(() => {
    if (!id_guia) { setError("Número de guía no proporcionado"); setIsLoading(false); return; }
    (async () => {
      try {
        const { data, error: e } = await supabase.rpc("get_public_tracking_info", { search_tracking_number: id_guia.trim() });
        if (e) throw e;
        const r = data as any;
        if (!r?.found) { setError("No encontramos ninguna guía con este número. Por favor verifica los datos."); return; }

        setOrder({
          numero_guia: r.numero_guia, cliente_nombre: r.cliente_nombre, direccion_entrega: r.direccion_entrega,
          estado: r.estado, motorizado_asignado: r.motorizado_nombre, latitud: r.latitud, longitud: r.longitud,
          valor_recaudar: r.valor_recaudar, metodo_pago: r.metodo_pago, producto_nombre: r.producto_nombre, quantity: r.quantity,
        });
        setStore({ store_name: r.store_name, logo_url: r.store_logo });
        if (r.motorizado_nombre) {
          setDriver({ full_name: r.motorizado_nombre, phone: r.motorizado_phone, avatar_url: r.motorizado_avatar, vehicle_plate: r.motorizado_placa, last_location_lat: r.motorizado_lat, last_location_lng: r.motorizado_lng });
          if (r.motorizado_lat && r.motorizado_lng) setDriverGps({ lat: r.motorizado_lat, lng: r.motorizado_lng });
        }
      } catch { setError("Error al buscar el pedido. Intenta de nuevo."); }
      finally { setIsLoading(false); }
    })();
  }, [id_guia]);

  // ── Realtime: order status ──────────────────────────
  useEffect(() => {
    if (!order?.numero_guia) return;
    const ch = supabase.channel(`pt-${order.numero_guia}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, async () => {
        const { data } = await supabase.rpc("get_public_tracking_info", { search_tracking_number: order.numero_guia! });
        const d = data as any;
        if (d?.found) {
          setOrder(prev => prev ? { ...prev, estado: d.estado, latitud: d.latitud, longitud: d.longitud, valor_recaudar: d.valor_recaudar } : prev);
          if (d.motorizado_nombre) setDriver({ full_name: d.motorizado_nombre, phone: d.motorizado_phone, avatar_url: d.motorizado_avatar, vehicle_plate: d.motorizado_placa, last_location_lat: d.motorizado_lat, last_location_lng: d.motorizado_lng });
          if (d.motorizado_lat && d.motorizado_lng) setDriverGps({ lat: d.motorizado_lat, lng: d.motorizado_lng });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order?.numero_guia]);

  // ── Realtime: GPS webhooks ──────────────────────────
  useEffect(() => {
    if (!order?.numero_guia) return;
    const guia = order.numero_guia.toLowerCase();
    const ch = supabase.channel("pt-gps")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "webhook_logs_incoming" }, (payload) => {
        const p = (payload.new as any).payload as Record<string, unknown>;
        const g = ((p?.guia as string) ?? (p?.tracking as string) ?? (p?.numero_guia as string) ?? "").toLowerCase();
        if (g.includes(guia)) { const gps = extractGps(p); if (gps) setDriverGps(gps); }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order?.numero_guia]);

  // ── Derived ──────────────────────────────────────────
  const statusInfo = order ? getStatusInfo(order.estado) : null;
  const destPos = order?.latitud && order?.longitud ? { lat: order.latitud, lng: order.longitud } : null;
  const isEnRuta = statusInfo?.step === 3;
  const isCOD = order?.metodo_pago?.toLowerCase() !== "anticipado";

  const openWhatsApp = useCallback(() => {
    if (!driver?.phone) return;
    window.open(`https://wa.me/57${driver.phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, ¿cuánto falta para mi entrega?")}`, "_blank");
  }, [driver?.phone]);

  const copyGuia = useCallback(() => {
    if (!order?.numero_guia) return;
    navigator.clipboard.writeText(order.numero_guia);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [order?.numero_guia]);

  // Build personalized message
  const heroMessage = useMemo(() => {
    if (!order) return "";
    const name = order.cliente_nombre?.split(" ")[0] || "";
    const driverName = driver?.full_name?.split(" ")[0] || "";
    if (isEnRuta && driverName && isCOD && order.valor_recaudar) {
      return `¡Hola ${name}! ${driverName} está en camino. Ten listos ${fmtCurrency(order.valor_recaudar)} en efectivo.`;
    }
    if (isEnRuta && driverName) return `¡Hola ${name}! ${driverName} va en camino con tu pedido 🏍️`;
    if (statusInfo?.step === 4) return `¡${name}, tu pedido fue entregado! ✅`;
    if (statusInfo?.step === 2) return `Hola ${name}, estamos preparando tu pedido`;
    return `Hola ${name}, tu pedido está siendo procesado`;
  }, [order, driver, isEnRuta, isCOD, statusInfo]);

  // ── LOADING ──────────────────────────────────────────
  if (isLoading) return <TrackingSkeleton />;

  // ── ERROR ────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div className="max-w-sm w-full rounded-3xl bg-card p-8 text-center shadow-xl border border-border" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <Package className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Guía no encontrada</h2>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <div className="flex flex-col gap-3">
          <Link to="/rastreo" className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">Buscar otra guía</Link>
          <a href={`https://wa.me/57${SUPPORT_PHONE}?text=${encodeURIComponent("Hola, necesito ayuda con mi guía " + (id_guia || ""))}`} className="rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white flex items-center justify-center gap-2">
            <MessageCircle className="h-4 w-4" /> WhatsApp Soporte
          </a>
        </div>
      </motion.div>
    </div>
  );

  if (!order || !statusInfo) return null;

  // ══════════════════════════════════════════════════════
  // ██  MAIN RENDER — Split Screen Layout
  // ══════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Driver marker CSS */}
      <style>{`
        .driver-pulse{width:52px;height:52px;position:relative;display:flex;align-items:center;justify-content:center}
        .driver-pulse::before{content:'';position:absolute;inset:0;border-radius:50%;background:hsl(var(--primary)/.3);animation:dp 2s ease-out infinite}
        .driver-dot{width:40px;height:40px;border-radius:50%;background:hsl(var(--primary));border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:20px;z-index:1}
        @keyframes dp{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}
      `}</style>

      {/* ═══ MAP — Top 55% ═══ */}
      <div className="relative w-full" style={{ height: "55%" }}>
        <LeafletMap driverPos={driverGps} destPos={destPos} />

        {/* Gradient fade into bottom sheet */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

        {/* ═══ GLASSMORPHISM FLOATING MESSAGE ═══ */}
        <motion.div
          className="absolute top-4 left-3 right-3 z-20 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.45)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <div className="flex items-center gap-3">
            {/* Logo */}
            {store?.logo_url ? (
              <img src={store.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-border/30 flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[13px] sm:text-sm font-bold text-foreground leading-snug">{heroMessage}</p>
              {store?.store_name && (
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">vía {store.store_name}</p>
              )}
            </div>

            {/* Live badge */}
            {isEnRuta && driverGps && (
              <div className="flex items-center gap-1.5 rounded-full bg-green-500 px-2.5 py-1 flex-shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative rounded-full h-2 w-2 bg-white" />
                </span>
                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">Live</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══ BOTTOM SHEET — Bottom 45% ═══ */}
      <motion.div
        className="relative z-20 -mt-6 flex-1 rounded-t-3xl bg-background overflow-y-auto"
        style={{ boxShadow: "0 -12px 48px rgba(0,0,0,0.1)" }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* ── Guía number + copy ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Guía</span>
              <span className="text-sm font-bold text-foreground font-mono">{order.numero_guia}</span>
              <button onClick={copyGuia} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <motion.span
              className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold"
              key={statusInfo.label}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              {statusInfo.label}
            </motion.span>
          </div>

          {/* ── SECTION 1: Motorizado ── */}
          <AnimatePresence>
            {driver && (
              <motion.div
                className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-lg flex-shrink-0">
                  <AvatarImage src={driver.avatar_url || undefined} alt={driver.full_name} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">{initials(driver.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{driver.full_name}</p>
                  {driver.vehicle_plate && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MotorcycleIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">{driver.vehicle_plate}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Tu motorizado asignado</p>
                </div>
                {driver.phone && (
                  <button
                    onClick={openWhatsApp}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg active:scale-95 transition-transform flex-shrink-0"
                    aria-label="Contactar por WhatsApp"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SECTION 2: Valor a Pagar (Destacado) ── */}
          {isCOD && order.valor_recaudar && order.valor_recaudar > 0 && (
            <motion.div
              className="rounded-2xl p-5 text-center border border-primary/15"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)/.08), hsl(var(--primary)/.03))" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor a Pagar</span>
              </div>
              <p className="text-4xl font-black text-foreground tracking-tight">
                {fmtCurrency(order.valor_recaudar)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Contra Entrega · Efectivo</p>
            </motion.div>
          )}

          {/* ── SECTION 3: Detalle del Pedido ── */}
          <div className="space-y-2">
            {order.producto_nombre && (
              <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium">Producto</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {order.producto_nombre}
                    {order.quantity && order.quantity > 1 && <span className="text-muted-foreground font-normal"> × {order.quantity}</span>}
                  </p>
                </div>
              </div>
            )}
            {order.direccion_entrega && (
              <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium">Destino</p>
                  <p className="text-sm font-semibold text-foreground">{order.direccion_entrega}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 4: Timeline Stepper ── */}
          <div className="pt-1">
            <Timeline current={statusInfo.step} />
          </div>

          {/* ── Support CTA ── */}
          <a
            href={`https://wa.me/57${SUPPORT_PHONE}?text=${encodeURIComponent(`Hola, consulta sobre guía ${order.numero_guia}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-muted/60 hover:bg-muted py-3 text-sm font-semibold text-muted-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            ¿Necesitas ayuda? Contáctanos
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default PublicTracking;

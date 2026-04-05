import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { getStatusConfig } from "@/lib/orderStatuses";
import {
  Package,
  Truck,
  CheckCircle2,
  Search,
  MapPin,
  Phone,
  ChevronRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

/* ─── Types ─── */
interface OrderRow {
  id: number;
  numero_guia: string | null;
  estado: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  latitud: number | null;
  longitud: number | null;
  motorizado_id: string | null;
  motorizado_asignado: string | null;
  fecha_creacion: string | null;
  zona: string | null;
}

interface MotorizadoProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
}

/* ─── Custom map icon ─── */
const createOrderIcon = (color: string) =>
  L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);"></div>`,
  });

/* ─── Data hooks ─── */
const useControlTowerData = (orgId: string | undefined) => {
  // All orders counts by status
  const countsQuery = useQuery({
    queryKey: ["control-tower-counts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("estado")
        .eq("organizacion_id", orgId!);
      if (error) throw error;

      const total = data.length;
      const enRuta = data.filter((d) => d.estado === "En Ruta").length;
      const entregados = data.filter((d) => d.estado === "Entregado").length;
      const novedades = data.filter((d) => d.estado === "Novedad").length;
      return { total, enRuta, entregados, novedades };
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  // Active orders with coordinates
  const activeQuery = useQuery({
    queryKey: ["control-tower-active", orgId],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero_guia, estado, cliente_nombre, direccion_entrega, latitud, longitud, motorizado_id, motorizado_asignado, fecha_creacion, zona"
        )
        .eq("organizacion_id", orgId!)
        .in("estado", ["Asignado", "En Ruta", "Novedad", "Recibido en Bodega"])
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });

  // Motorizado profiles
  const motorizadosQuery = useQuery({
    queryKey: ["control-tower-motorizados"],
    queryFn: async (): Promise<Record<string, MotorizadoProfile>> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");
      if (!roles?.length) return {};
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, phone")
        .in("user_id", roles.map((r) => r.user_id));
      const map: Record<string, MotorizadoProfile> = {};
      profiles?.forEach((p) => (map[p.user_id] = p));
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Weekly delivery chart data
  const weeklyQuery = useQuery({
    queryKey: ["control-tower-weekly", orgId],
    queryFn: async () => {
      const since = subDays(new Date(), 6);
      const { data, error } = await supabase
        .from("pedidos")
        .select("estado, fecha_creacion")
        .eq("organizacion_id", orgId!)
        .gte("fecha_creacion", startOfDay(since).toISOString());
      if (error) throw error;

      const days: Record<string, { entregas: number; novedades: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "EEE", { locale: es });
        days[d] = { entregas: 0, novedades: 0 };
      }
      data?.forEach((p) => {
        if (!p.fecha_creacion) return;
        const d = format(new Date(p.fecha_creacion), "EEE", { locale: es });
        if (days[d]) {
          if (p.estado === "Entregado") days[d].entregas++;
          if (p.estado === "Novedad") days[d].novedades++;
        }
      });
      return Object.entries(days).map(([name, vals]) => ({ name, ...vals }));
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    counts: countsQuery.data,
    activeOrders: activeQuery.data ?? [],
    motorizados: motorizadosQuery.data ?? {},
    weeklyData: weeklyQuery.data ?? [],
    isLoading:
      countsQuery.isLoading || activeQuery.isLoading || weeklyQuery.isLoading,
  };
};

/* ─── Sub-components ─── */

const KPICard = ({
  icon: Icon,
  iconBg,
  label,
  value,
  trend,
  isLoading,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: number | undefined;
  trend?: { value: string; positive: boolean };
  isLoading: boolean;
}) => (
  <Card className="flex items-center gap-4 px-6 py-5 rounded-2xl shadow-sm border-0 bg-white">
    <div className={`p-3 rounded-xl ${iconBg}`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {isLoading ? (
        <Skeleton className="h-8 w-20 mt-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground">
          {(value ?? 0).toLocaleString()}
        </p>
      )}
    </div>
    {trend && (
      <span
        className={`flex items-center gap-1 text-xs font-semibold ${
          trend.positive ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {trend.positive ? (
          <TrendingUp className="h-3.5 w-3.5" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5" />
        )}
        {trend.value}
      </span>
    )}
  </Card>
);

const OrderCard = ({
  order,
  motorizado,
  isSelected,
  onClick,
}: {
  order: OrderRow;
  motorizado?: MotorizadoProfile;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const config = getStatusConfig(order.estado);
  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-transparent bg-white hover:border-slate-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-foreground">
          #{order.numero_guia || order.id}
        </span>
        <Badge
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: config.color, color: "#fff" }}
        >
          {config.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-2">
        {order.direccion_entrega || "Sin dirección"}
      </p>
      {motorizado && (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
            {motorizado.avatar_url ? (
              <img
                src={motorizado.avatar_url}
                className="h-full w-full object-cover"
                alt=""
              />
            ) : (
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <span className="text-xs font-medium text-foreground truncate">
            {motorizado.full_name}
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ─── */
const AdminControlTower = () => {
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;
  const { counts, activeOrders, motorizados, weeklyData, isLoading } =
    useControlTowerData(orgId ?? undefined);

  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Defer map render to avoid react-leaflet useState-null crash during lazy load
  useEffect(() => {
    const t = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return activeOrders;
    const q = search.toLowerCase();
    return activeOrders.filter(
      (o) =>
        o.numero_guia?.toLowerCase().includes(q) ||
        o.cliente_nombre?.toLowerCase().includes(q) ||
        String(o.id).includes(q)
    );
  }, [activeOrders, search]);

  const ordersWithCoords = useMemo(
    () => activeOrders.filter((o) => o.latitud && o.longitud),
    [activeOrders]
  );

  const mapCenter = useMemo(() => {
    if (ordersWithCoords.length > 0) {
      return [ordersWithCoords[0].latitud!, ordersWithCoords[0].longitud!] as [number, number];
    }
    return [4.711, -74.0721] as [number, number]; // Bogotá default
  }, [ordersWithCoords]);

  // Fleet stats
  const fleetStats = useMemo(() => {
    const uniqueDrivers = new Set(
      activeOrders
        .filter((o) => o.motorizado_id)
        .map((o) => o.motorizado_id!)
    );
    return {
      activeDrivers: uniqueDrivers.size,
      avgPerDriver:
        uniqueDrivers.size > 0
          ? Math.round(activeOrders.length / uniqueDrivers.size)
          : 0,
    };
  }, [activeOrders]);

  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Control Tower Dashboard
          </h1>
          <p className="text-xs text-muted-foreground capitalize">{today}</p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por guía, cliente o ID..."
            className="pl-10 rounded-xl bg-slate-50 border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* ── KPI Bar ── */}
      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          icon={Package}
          iconBg="bg-emerald-500"
          label="Total Envíos"
          value={counts?.total}
          trend={{ value: "+3.45%", positive: true }}
          isLoading={isLoading}
        />
        <KPICard
          icon={Truck}
          iconBg="bg-amber-500"
          label="Envíos Activos"
          value={counts?.enRuta}
          trend={{ value: `-${((counts?.novedades ?? 0) > 0 ? "2.95" : "0")}%`, positive: false }}
          isLoading={isLoading}
        />
        <KPICard
          icon={CheckCircle2}
          iconBg="bg-sky-500"
          label="Total Entregados"
          value={counts?.entregados}
          trend={{ value: "+1.47%", positive: true }}
          isLoading={isLoading}
        />
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="px-6 pb-6 grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 220px)" }}>
        {/* LEFT: Order List */}
        <div className="col-span-3 flex flex-col gap-3">
          <Card className="rounded-2xl shadow-sm border-0 bg-white p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">
                Órdenes Activas
              </h2>
              <Badge variant="outline" className="text-xs rounded-full">
                {filteredOrders.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))
                  : filteredOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        motorizado={
                          order.motorizado_id
                            ? motorizados[order.motorizado_id]
                            : undefined
                        }
                        isSelected={selectedOrderId === order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                      />
                    ))}
                {!isLoading && filteredOrders.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    No hay órdenes activas
                  </p>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* CENTER: Map */}
        <div className="col-span-6 flex flex-col gap-3">
          <Card className="rounded-2xl shadow-sm border-0 bg-white flex-1 overflow-hidden relative">
            <MapContainer
              center={mapCenter}
              zoom={12}
              className="h-full w-full z-0"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              {ordersWithCoords.map((order) => {
                const config = getStatusConfig(order.estado);
                const moto = order.motorizado_id
                  ? motorizados[order.motorizado_id]
                  : undefined;
                return (
                  <Marker
                    key={order.id}
                    position={[order.latitud!, order.longitud!]}
                    icon={createOrderIcon(config.color)}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-bold">
                          #{order.numero_guia || order.id}
                        </p>
                        <p>{order.cliente_nombre}</p>
                        {moto && (
                          <p className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {moto.full_name}
                          </p>
                        )}
                        {moto?.phone && (
                          <a
                            href={`tel:${moto.phone}`}
                            className="flex items-center gap-1 text-primary"
                          >
                            <Phone className="h-3 w-3" /> {moto.phone}
                          </a>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            {/* Floating legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg z-[500] flex gap-4 text-[10px] font-medium">
              {[
                { label: "En Ruta", color: "#0ea5e9" },
                { label: "Asignado", color: "#3b82f6" },
                { label: "Novedad", color: "#f97316" },
                { label: "Bodega", color: "#6366f1" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT: Stats */}
        <div className="col-span-3 flex flex-col gap-3">
          {/* Fleet */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Flota Logística
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Conductores Activos
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fleetStats.activeDrivers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Paquetes / Conductor
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fleetStats.avgPerDriver}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Novedades Hoy
                </span>
                <span className="text-lg font-bold text-amber-600">
                  {counts?.novedades ?? 0}
                </span>
              </div>
            </div>
          </Card>

          {/* Driver efficiency bar */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white p-4">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Rendimiento
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">
              Distribución de estados activos
            </p>
            {counts && counts.total > 0 ? (
              <div className="flex h-5 rounded-full overflow-hidden">
                {[
                  {
                    pct: ((counts.entregados / counts.total) * 100).toFixed(1),
                    color: "bg-emerald-500",
                    label: "Entregado",
                  },
                  {
                    pct: ((counts.enRuta / counts.total) * 100).toFixed(1),
                    color: "bg-sky-500",
                    label: "En Ruta",
                  },
                  {
                    pct: ((counts.novedades / counts.total) * 100).toFixed(1),
                    color: "bg-amber-500",
                    label: "Novedad",
                  },
                ].map((seg) => (
                  <div
                    key={seg.label}
                    className={`${seg.color} flex items-center justify-center`}
                    style={{ width: `${seg.pct}%` }}
                    title={`${seg.label}: ${seg.pct}%`}
                  >
                    {parseFloat(seg.pct) > 10 && (
                      <span className="text-[9px] text-white font-bold">
                        {seg.pct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-5 w-full rounded-full" />
            )}
            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Entregado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                En Ruta
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Novedad
              </span>
            </div>
          </Card>

          {/* Weekly chart */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white p-4 flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Entregas por Día
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">
              Últimos 7 días
            </p>
            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="entregas"
                    fill="#22c55e"
                    radius={[6, 6, 0, 0]}
                    name="Entregas"
                  />
                  <Bar
                    dataKey="novedades"
                    fill="#ef4444"
                    radius={[6, 6, 0, 0]}
                    name="Novedades"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminControlTower;

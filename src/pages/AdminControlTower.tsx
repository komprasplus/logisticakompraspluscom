import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin } from "lucide-react";

/* ─── Marker icon factory ─── */
const statusColors: Record<string, string> = {
  "En Ruta": "#0ea5e9",
  Asignado: "#3b82f6",
  Novedad: "#f97316",
  "Recibido en Bodega": "#6366f1",
};

const createIcon = (color: string) =>
  L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`,
  });

/* ─── Types ─── */
interface MapOrder {
  id: number;
  numero_guia: string | null;
  estado: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  latitud: number | null;
  longitud: number | null;
  motorizado_asignado: string | null;
}

type MockOrder = {
  id: number;
  trackingNumber: string;
  customer: string;
  address: string;
  status: string;
  driver: string;
  eta: string;
  amount: string;
};

const mockOrders: MockOrder[] = [
  {
    id: 1,
    trackingNumber: "KP-1001",
    customer: "Laura Gómez",
    address: "Cra 15 #93-18, Bogotá",
    status: "En ruta",
    driver: "Daniel Rojas",
    eta: "12 min",
    amount: "$18.500",
  },
  {
    id: 2,
    trackingNumber: "KP-1002",
    customer: "Carlos Méndez",
    address: "Cl 127 #19-44, Bogotá",
    status: "Preparando",
    driver: "Valentina Ruiz",
    eta: "28 min",
    amount: "$24.000",
  },
  {
    id: 3,
    trackingNumber: "KP-1003",
    customer: "Andrea Castro",
    address: "Av Suba #116-09, Bogotá",
    status: "Entregado",
    driver: "Miguel Torres",
    eta: "Completado",
    amount: "$0",
  },
];

const AdminControlTower = () => {
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;

  /* ── Map deferred render (prevents react-leaflet hook crash on lazy load) ── */
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Live orders with coordinates ── */
  const [mapOrders, setMapOrders] = useState<MapOrder[]>([]);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const fetchOrders = async () => {
      setMapLoading(true);
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, estado, cliente_nombre, direccion_entrega, latitud, longitud, motorizado_asignado")
        .eq("organizacion_id", orgId)
        .in("estado", ["En Ruta", "Asignado", "Novedad", "Recibido en Bodega"])
        .not("latitud", "is", null)
        .not("longitud", "is", null)
        .order("id", { ascending: false })
        .limit(200);
      if (!error && data) setMapOrders(data as MapOrder[]);
      setMapLoading(false);
    };
    fetchOrders();
  }, [orgId]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (mapOrders.length > 0) return [mapOrders[0].latitud!, mapOrders[0].longitud!];
    return [4.6097, -74.0817];
  }, [mapOrders]);

  const totalOrders = mockOrders.length;
  const activeOrders = mockOrders.filter((order) => order.status !== "Entregado").length;
  const deliveredOrders = mockOrders.filter((order) => order.status === "Entregado").length;

  const kpis = [
    {
      label: "Total de guías",
      value: totalOrders,
      helper: "Mock data temporal para estabilizar la vista.",
    },
    {
      label: "Operaciones activas",
      value: activeOrders,
      helper: "Sin consultas asíncronas ni librerías externas.",
    },
    {
      label: "Entregas completadas",
      value: deliveredOrders,
      helper: "Layout seguro mientras se corrige la versión completa.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {kpi.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {kpi.helper}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <div className="order-2 xl:order-1">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    Órdenes activas
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lista estática de 3 órdenes de prueba.
                  </div>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {mockOrders.length}
                </div>
              </div>

              <div className="space-y-3">
                {mockOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-border bg-background p-4 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">
                          {order.trackingNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer}
                        </div>
                      </div>
                      <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {order.status}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <div>{order.address}</div>
                      <div>Motorizado: {order.driver}</div>
                      <div>ETA: {order.eta}</div>
                      <div>Recaudo: {order.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 xl:order-2">
            <div className="relative min-h-[420px] rounded-3xl border border-border bg-card shadow-sm overflow-hidden xl:min-h-[calc(100vh-220px)]">
              {mapReady ? (
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  className="h-full w-full z-0"
                  style={{ minHeight: "inherit" }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  />
                  {mapOrders.map((order) => (
                    <Marker
                      key={order.id}
                      position={[order.latitud!, order.longitud!]}
                      icon={createIcon(statusColors[order.estado ?? ""] ?? "#94a3b8")}
                    >
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[160px]">
                          <p className="font-bold text-sm">#{order.numero_guia ?? order.id}</p>
                          <p>{order.cliente_nombre ?? "Sin nombre"}</p>
                          <p className="text-muted-foreground">{order.direccion_entrega ?? ""}</p>
                          {order.motorizado_asignado && (
                            <p className="font-medium pt-1">🏍️ {order.motorizado_asignado}</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <div className="flex h-full min-h-[inherit] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* Floating legend */}
              <div className="absolute bottom-4 left-4 z-[500] flex gap-3 rounded-xl bg-card/90 backdrop-blur-sm px-4 py-2.5 shadow-lg border border-border text-[11px] font-medium">
                {Object.entries(statusColors).map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: color }} />
                    <span className="text-foreground">{label}</span>
                  </span>
                ))}
              </div>
              {/* Order count badge */}
              <div className="absolute top-4 right-4 z-[500] flex items-center gap-2 rounded-xl bg-card/90 backdrop-blur-sm px-3 py-2 shadow-lg border border-border">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{mapOrders.length} en mapa</span>
              </div>
            </div>
          </div>

          <div className="order-3 flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="text-lg font-semibold text-foreground">
                  Panel visual {index + 1}
                </div>
                <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/60 px-6 text-center">
                  <div>
                    <div className="text-2xl font-semibold text-foreground">
                      📊 ÁREA DE GRÁFICAS
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Placeholder estático temporal sin Recharts ni dependencias complejas.
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminControlTower;

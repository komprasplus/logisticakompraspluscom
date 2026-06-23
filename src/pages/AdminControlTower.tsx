import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AnunciosManager from "@/components/admin/AnunciosManager";
import InteractiveCoverageMap from "@/components/admin/InteractiveCoverageMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Truck, CheckCircle2, Inbox, BarChart3, PieChart as PieChartIcon, Search, Download, Plus, Banknote, MessageCircle, Volume2, VolumeX } from "lucide-react";
import MotorizadosLiveGrid, { type MotorizadoLive } from "@/components/admin/MotorizadosLiveGrid";
import ActivityFeed, { type ActivityItem } from "@/components/admin/ActivityFeed";
import { getStatusConfig } from "@/lib/orderStatuses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { playGlobalNotificationPing } from "@/hooks/useNotificationSound";
import { useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

/* ─── Types ─── */
interface ActiveOrder {
  id: number;
  numero_guia: string | null;
  estado: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  valor_recaudar: number | null;
  municipio: string | null;
  latitud: number | null;
  longitud: number | null;
  motorizado_phone?: string | null;
}

const formatCOP = (v: number | null) =>
  v != null ? `$${v.toLocaleString("es-CO")}` : "—";

const ACTIVE_STATES = ["En Ruta", "Asignado", "Novedad", "Recibido en Bodega"];

const buildWhatsAppUrl = (phone: string | null | undefined, order: ActiveOrder): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  const num = clean.startsWith("57") ? clean : `57${clean}`;
  const msg = encodeURIComponent(
    `Hola ${order.motorizado_asignado ?? "motorizado"}, te escribo desde la central de Plus Envíos. Estoy monitoreando la guía #${order.numero_guia ?? order.id} del cliente ${order.cliente_nombre ?? "N/A"} y quería consultarte sobre el estado de la entrega. ¿Todo bien por allá?`
  );
  return `https://wa.me/${num}?text=${msg}`;
};

/* ─── Chart types ─── */
interface DayVolume { name: string; pedidos: number }
interface EffSlice { name: string; value: number; color: string }

const PIE_COLORS = ["#22c55e", "#ef4444"]; // green=delivered, red=returned

/* ─── KPI icon config ─── */
const kpiConfig = [
  { key: "total", label: "Total de guías", icon: Package, iconBg: "bg-primary/15 text-primary" },
  { key: "enRuta", label: "Operaciones activas", icon: Truck, iconBg: "bg-amber-500/15 text-amber-600" },
  { key: "entregados", label: "Entregas completadas", icon: CheckCircle2, iconBg: "bg-emerald-500/15 text-emerald-600" },
  { key: "recaudoCalle", label: "Recaudo en calle", icon: Banknote, iconBg: "bg-violet-500/15 text-violet-600", isCurrency: true },
] as const;

const AdminControlTower = () => {
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;
  const navigate = useNavigate();

  /* ── KPI state ── */
  const [kpis, setKpis] = useState<{ total: number; enRuta: number; entregados: number; recaudoCalle: number } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  /* ── Active orders for sidebar ── */
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  /* ── Search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  /* ── Chart data ── */
  const [volumeData, setVolumeData] = useState<DayVolume[]>([]);
  const [effData, setEffData] = useState<EffSlice[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  /* ── Sound mute ── */
  const [isMuted, setIsMuted] = useState(false);

  /* ── Snapshot: motorizados en vivo + activity feed ── */
  const [motorizados, setMotorizados] = useState<MotorizadoLive[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [snapshotKpis, setSnapshotKpis] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const fetchSnapshot = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("admin_control_tower_snapshot");
        if (cancelled) return;
        if (error) {
          console.warn("snapshot error:", error);
          return;
        }
        const payload = (data ?? {}) as Record<string, unknown>;
        setMotorizados((payload.motorizados as MotorizadoLive[]) ?? []);
        setActivity((payload.actividad_reciente as ActivityItem[]) ?? []);
        setSnapshotKpis((payload.kpis as Record<string, number>) ?? null);
      } catch (e) {
        console.warn("snapshot fetch failed:", e);
      }
    };
    void fetchSnapshot();
    const iv = setInterval(fetchSnapshot, 15000); // refrescar cada 15s para feel live
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const fetchKpis = async () => {
      setKpiLoading(true);
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("estado, valor_recaudar")
          .eq("organizacion_id", orgId);

        if (error) throw error;

        const total = data?.length ?? 0;
        const enRutaRows = data?.filter((p) => p.estado === "En Ruta") ?? [];
        const enRuta = enRutaRows.length;
        const entregados = data?.filter((p) => p.estado === "Entregado").length ?? 0;
        const recaudoCalle = enRutaRows.reduce((sum, p) => sum + (p.valor_recaudar ?? 0), 0);
        setKpis({ total, enRuta, entregados, recaudoCalle });
      } catch {
        setKpis({ total: 0, enRuta: 0, entregados: 0, recaudoCalle: 0 });
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpis();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const fetchActiveOrders = async () => {
      setOrdersLoading(true);
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("id, numero_guia, estado, cliente_nombre, direccion_entrega, motorizado_asignado, motorizado_id, valor_recaudar, municipio, latitud, longitud")
          .eq("organizacion_id", orgId)
          .in("estado", ACTIVE_STATES)
          .order("id", { ascending: false })
          .limit(20);
        if (error) throw error;

        // Enrich with motorizado phone numbers
        const orders = (data ?? []) as ActiveOrder[];
        const motoIds = [...new Set(orders.map((o) => o.motorizado_id).filter(Boolean))] as string[];
        if (motoIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, phone")
            .in("user_id", motoIds);
          const phoneMap = new Map((profiles ?? []).map((p) => [p.user_id, p.phone]));
          orders.forEach((o) => {
            if (o.motorizado_id) o.motorizado_phone = phoneMap.get(o.motorizado_id) ?? null;
          });
        }
        setActiveOrders(orders);
      } catch {
        setActiveOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchActiveOrders();
  }, [orgId]);

  /* ── Deferred map mount ── */
  useEffect(() => {
    const timer = setTimeout(() => setIsMapReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  /* ── Filtered orders by search ── */
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return activeOrders;
    const q = searchQuery.toLowerCase();
    return activeOrders.filter(
      (o) =>
        o.numero_guia?.toLowerCase().includes(q) ||
        o.cliente_nombre?.toLowerCase().includes(q) ||
        String(o.id).includes(q)
    );
  }, [activeOrders, searchQuery]);

  /* ── CSV export ── */
  const handleExport = useCallback(() => {
    const rows = filteredOrders.length > 0 ? filteredOrders : activeOrders;
    if (rows.length === 0) return;
    const header = "ID,Guía,Cliente,Dirección,Estado,Motorizado,Valor Recaudar\n";
    const csv = rows.map((o) =>
      [o.id, o.numero_guia ?? "", o.cliente_nombre ?? "", `"${(o.direccion_entrega ?? "").replace(/"/g, '""')}"`, o.estado ?? "", o.motorizado_asignado ?? "", o.valor_recaudar ?? 0].join(",")
    ).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_plus_envios.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredOrders, activeOrders]);

  /* ── Fetch chart data ── */
  useEffect(() => {
    if (!orgId) return;
    const fetchCharts = async () => {
      setChartsLoading(true);
      try {
        const since = subDays(new Date(), 6);
        const { data, error } = await supabase
          .from("pedidos")
          .select("estado, fecha_creacion")
          .eq("organizacion_id", orgId)
          .gte("fecha_creacion", since.toISOString());
        if (error) throw error;

        // Volume by day
        const buckets: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          buckets[format(subDays(new Date(), i), "EEE", { locale: es })] = 0;
        }
        let entregados = 0;
        let devueltos = 0;
        (data ?? []).forEach((p) => {
          if (p.fecha_creacion) {
            const d = format(new Date(p.fecha_creacion), "EEE", { locale: es });
            if (buckets[d] !== undefined) buckets[d]++;
          }
          if (p.estado === "Entregado") entregados++;
          if (p.estado === "Devolución") devueltos++;
        });
        setVolumeData(Object.entries(buckets).map(([name, pedidos]) => ({ name, pedidos })));
        setEffData([
          { name: "Entregas", value: entregados, color: PIE_COLORS[0] },
          { name: "Devoluciones", value: devueltos, color: PIE_COLORS[1] },
        ]);
      } catch {
        setVolumeData([]);
        setEffData([]);
      } finally {
        setChartsLoading(false);
      }
    };
    fetchCharts();
  }, [orgId]);
  /* ── Supabase Realtime: Novedad alerts ── */
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("control-tower-alerts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `organizacion_id=eq.${orgId}` },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          const isNovedad = newRow.estado === "Novedad" && oldRow.estado !== "Novedad";
          const isDevolucion = newRow.estado === "Devolución" && oldRow.estado !== "Devolución";

          if (isNovedad || isDevolucion) {
            const label = isNovedad ? "Novedad" : "Devolución";
            toast.warning(`⚠️ Nueva ${label}: Guía #${newRow.numero_guia ?? newRow.id} requiere atención.`, { duration: 8000 });
            if (!isMutedRef.current) {
              playGlobalNotificationPing();
            }
          }

          // Update sidebar if affected order is in active list
          setActiveOrders((prev) =>
            prev.map((o) => (o.id === newRow.id ? { ...o, estado: newRow.estado } : o))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 p-4 lg:gap-6 lg:p-6">

        {/* ── Command Bar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por # de guía o cliente..."
              className="pl-10 rounded-xl border-border bg-card shadow-sm h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl shadow-sm"
              onClick={() => setIsMuted((m) => !m)}
              title={isMuted ? "Activar alertas sonoras" : "Silenciar alertas"}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-primary" />}
            </Button>
            <Button variant="outline" className="rounded-xl gap-2 shadow-sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Exportar Reporte
            </Button>
            <Button className="rounded-xl gap-2 shadow-sm" onClick={() => navigate("/admin")}>
              <Plus className="h-4 w-4" />
              Crear Guía
            </Button>
          </div>
        </div>

        {/* ── KPI Top Bar (REAL DATA) ── */}
        <div className="grid gap-4 md:grid-cols-4">
          {kpiConfig.map((cfg) => {
            const Icon = cfg.icon;
            const value = kpis?.[cfg.key];
            const isCurrency = "isCurrency" in cfg && cfg.isCurrency;
            return (
              <div key={cfg.key} className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cfg.iconBg}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">{cfg.label}</div>
                  {kpiLoading ? (
                    <Skeleton className="mt-1 h-8 w-20" />
                  ) : (
                    <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                      {isCurrency ? formatCOP(value ?? 0) : (value ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── KPIs extendidos del snapshot ── */}
        {snapshotKpis && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <KPIMini label="En ruta" value={snapshotKpis.en_ruta ?? 0} accent="bg-blue-500/15 text-blue-700" />
            <KPIMini label="Asignados" value={snapshotKpis.asignados ?? 0} accent="bg-amber-500/15 text-amber-700" />
            <KPIMini label="En bodega" value={snapshotKpis.recibidos_bodega ?? 0} accent="bg-violet-500/15 text-violet-700" />
            <KPIMini label="Entregados hoy" value={snapshotKpis.entregados_hoy ?? 0} delta={snapshotKpis.entregados_hoy - snapshotKpis.entregados_ayer} accent="bg-emerald-500/15 text-emerald-700" />
            <KPIMini label="Novedades" value={snapshotKpis.novedades_abiertas ?? 0} accent="bg-pink-500/15 text-pink-700" />
            <KPIMini label="Cobrado hoy (COD)" value={snapshotKpis.recaudo_hoy ?? 0} isCurrency delta={snapshotKpis.recaudo_hoy - snapshotKpis.recaudo_ayer} accent="bg-success/15 text-success-foreground" />
          </div>
        )}

        {/* ── Motorizados en vivo ── */}
        <MotorizadosLiveGrid motorizados={motorizados} />

        {/* ── 3-Column Grid ── */}
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">

          {/* LEFT: Active orders sidebar (REAL DATA) */}
          <div className="order-2 xl:order-1">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm flex flex-col" style={{ maxHeight: "calc(100vh - 220px)" }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">Órdenes activas</div>
                  <div className="text-sm text-muted-foreground">Últimas 20 en operación</div>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {ordersLoading ? "…" : filteredOrders.length}
                </div>
              </div>

              <ScrollArea className="flex-1 -mr-2 pr-2">
                {ordersLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {searchQuery ? "No se encontraron resultados." : "No hay órdenes activas en este momento."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOrders.map((order) => {
                      const statusCfg = getStatusConfig(order.estado);
                      const isNovedad = order.estado === "Novedad";
                      const isDevolucion = order.estado === "Devolución";
                      const isAlert = isNovedad || isDevolucion;
                      return (
                        <div
                          key={order.id}
                          className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
                            isAlert
                              ? "border-destructive/60 bg-destructive/5 ring-2 ring-destructive/20 animate-pulse"
                              : selectedOrderId === order.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border bg-background"
                          }`}
                          onClick={() => {
                            if (!order.latitud || !order.longitud) {
                              toast.warning("Ubicación GPS no disponible en este momento");
                            }
                            setSelectedOrderId(order.id);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">
                                #{order.numero_guia ?? order.id}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {order.cliente_nombre ?? "Sin nombre"}
                              </div>
                            </div>
                            <Badge
                              className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold border-0"
                              style={{ background: statusCfg.color, color: "#fff" }}
                            >
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <div className="truncate">📍 {order.direccion_entrega ?? order.municipio ?? "Sin dirección"}</div>
                            {order.motorizado_asignado && (
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">🏍️ {order.motorizado_asignado}</span>
                                {(() => {
                                  const waUrl = buildWhatsAppUrl(order.motorizado_phone, order);
                                  return waUrl ? (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors hover:bg-[#25D366]/20"
                                      title="Enviar WhatsApp al motorizado"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                                    </a>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toast.warning("Teléfono del motorizado no registrado"); }}
                                      className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full opacity-40 cursor-not-allowed"
                                      title="Teléfono no disponible"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                            <div className="font-semibold text-foreground">
                              💰 {formatCOP(order.valor_recaudar)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* CENTER: Tabs (Anuncios + Mapa de Cobertura) */}
          <div className="order-1 xl:order-2">
            <Tabs defaultValue="cobertura" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 p-1 mb-4">
                <TabsTrigger value="cobertura" className="rounded-xl text-sm font-medium">
                  🗺️ Mapa de Cobertura
                </TabsTrigger>
                <TabsTrigger value="anuncios" className="rounded-xl text-sm font-medium">
                  📣 Tablero de Anuncios
                </TabsTrigger>
              </TabsList>
              <TabsContent value="cobertura" className="mt-0 focus-visible:outline-none">
                <InteractiveCoverageMap />
              </TabsContent>
              <TabsContent value="anuncios" className="mt-0 focus-visible:outline-none">
                <AnunciosManager />
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: Analytics panels (REAL DATA) */}
          <div className="order-3 flex flex-col gap-4">

            {/* Activity Feed live */}
            <ActivityFeed items={activity} />

            {/* Panel 1: Volume bar chart */}
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Volumen de pedidos</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Últimos 7 días</p>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              ) : volumeData.length === 0 || volumeData.every((d) => d.pedidos === 0) ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Sin datos suficientes
                </div>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.1)", fontSize: 12 }}
                      />
                      <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Pedidos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Panel 2: Effectiveness donut */}
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <PieChartIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Efectividad de entrega</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Entregas vs Devoluciones (7 días)</p>
              {chartsLoading ? (
                <Skeleton className="h-[220px] w-full rounded-2xl" />
              ) : effData.every((d) => d.value === 0) ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Sin datos suficientes
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={effData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        strokeWidth={0}
                      >
                        {effData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.1)", fontSize: 12 }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ── Mini KPI card para el strip extendido ──────────────────────
interface KPIMiniProps {
  label: string;
  value: number;
  delta?: number;
  isCurrency?: boolean;
  accent: string;
}

const KPIMini = ({ label, value, delta, isCurrency, accent }: KPIMiniProps) => {
  const formatted = isCurrency ? formatCOP(value) : value.toLocaleString("es-CO");
  const trend = delta !== undefined ? (delta > 0 ? "up" : delta < 0 ? "down" : "neutral") : null;
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${accent.split(" ")[0]}`} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-black tracking-tight text-foreground tabular-nums mt-1">{formatted}</p>
      {trend && delta !== undefined && delta !== 0 && (
        <p className={`text-[10px] font-semibold mt-0.5 ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
          {trend === "up" ? "▲" : "▼"} {isCurrency ? formatCOP(Math.abs(delta)) : Math.abs(delta).toLocaleString("es-CO")} vs ayer
        </p>
      )}
    </div>
  );
};

export default AdminControlTower;

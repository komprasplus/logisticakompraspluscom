import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck, CheckCircle2 } from "lucide-react";

/* ─── Mock sidebar orders (static) ─── */
const mockOrders = [
  { id: 1, trackingNumber: "KP-1001", customer: "Laura Gómez", address: "Cra 15 #93-18, Bogotá", status: "En ruta", driver: "Daniel Rojas", eta: "12 min", amount: "$18.500" },
  { id: 2, trackingNumber: "KP-1002", customer: "Carlos Méndez", address: "Cl 127 #19-44, Bogotá", status: "Preparando", driver: "Valentina Ruiz", eta: "28 min", amount: "$24.000" },
  { id: 3, trackingNumber: "KP-1003", customer: "Andrea Castro", address: "Av Suba #116-09, Bogotá", status: "Entregado", driver: "Miguel Torres", eta: "Completado", amount: "$0" },
];

/* ─── KPI icon config ─── */
const kpiConfig = [
  { key: "total", label: "Total de guías", icon: Package, iconBg: "bg-primary/15 text-primary" },
  { key: "enRuta", label: "Operaciones activas", icon: Truck, iconBg: "bg-amber-500/15 text-amber-600" },
  { key: "entregados", label: "Entregas completadas", icon: CheckCircle2, iconBg: "bg-emerald-500/15 text-emerald-600" },
] as const;

const AdminControlTower = () => {
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;

  /* ── KPI state ── */
  const [kpis, setKpis] = useState<{ total: number; enRuta: number; entregados: number } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const fetchKpis = async () => {
      setKpiLoading(true);
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("estado")
          .eq("organizacion_id", orgId);

        if (error) throw error;

        const total = data?.length ?? 0;
        const enRuta = data?.filter((p) => p.estado === "En Ruta").length ?? 0;
        const entregados = data?.filter((p) => p.estado === "Entregado").length ?? 0;
        setKpis({ total, enRuta, entregados });
      } catch {
        setKpis({ total: 0, enRuta: 0, entregados: 0 });
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpis();
  }, [orgId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 p-4 lg:gap-6 lg:p-6">

        {/* ── KPI Top Bar (REAL DATA) ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {kpiConfig.map((cfg) => {
            const Icon = cfg.icon;
            const value = kpis?.[cfg.key];
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
                      {(value ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 3-Column Grid ── */}
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">

          {/* LEFT: Static order sidebar */}
          <div className="order-2 xl:order-1">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">Órdenes activas</div>
                  <div className="text-sm text-muted-foreground">Lista estática de prueba.</div>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {mockOrders.length}
                </div>
              </div>
              <div className="space-y-3">
                {mockOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-border bg-background p-4 transition-transform duration-200 hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{order.trackingNumber}</div>
                        <div className="text-sm text-muted-foreground">{order.customer}</div>
                      </div>
                      <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{order.status}</div>
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

          {/* CENTER: Map placeholder (leaflet removed) */}
          <div className="order-1 xl:order-2">
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted px-6 py-10 text-center shadow-sm xl:min-h-[calc(100vh-220px)]">
              <div className="max-w-2xl">
                <div className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl xl:text-5xl">
                  📍 MAPA INMERSIVO (Cargando...)
                </div>
                <div className="mt-4 text-sm text-muted-foreground sm:text-base">
                  Contenedor seguro temporal. El mapa se reintegrará en una fase posterior.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Static chart placeholders */}
          <div className="order-3 flex flex-col gap-4">
            {[1, 2].map((index) => (
              <div key={index} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="text-lg font-semibold text-foreground">Panel visual {index}</div>
                <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/60 px-6 text-center">
                  <div>
                    <div className="text-2xl font-semibold text-foreground">📊 ÁREA DE GRÁFICAS</div>
                    <div className="mt-2 text-sm text-muted-foreground">Placeholder estático temporal.</div>
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

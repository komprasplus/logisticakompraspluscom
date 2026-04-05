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
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted px-6 py-10 text-center shadow-sm xl:min-h-[calc(100vh-220px)]">
              <div className="max-w-2xl">
                <div className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl xl:text-5xl">
                  📍 MAPA INMERSIVO (Cargando...)
                </div>
                <div className="mt-4 text-sm text-muted-foreground sm:text-base">
                  Contenedor seguro temporal para estabilizar el dashboard antes de reintegrar mapa y tiempo real.
                </div>
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

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
} from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-kompras-plus.png";

interface OrderStatus {
  orderNumber: string;
  status: "confirmed" | "preparing" | "in_transit" | "delivered";
  customerName: string;
  address: string;
  items: string[];
  estimatedDelivery: string;
  driverName?: string;
  driverPhone?: string;
  lastUpdate: string;
}

const mockOrderStatuses: Record<string, OrderStatus> = {
  "KP-2024-001": {
    orderNumber: "KP-2024-001",
    status: "in_transit",
    customerName: "María García",
    address: "Calle 85 # 15-32, Chapinero",
    items: ["Arroz x2", "Aceite x1", "Azúcar x3"],
    estimatedDelivery: "10:30 AM - 11:00 AM",
    driverName: "Juan Pérez",
    driverPhone: "+57 300 555 1234",
    lastUpdate: "Hace 5 minutos",
  },
  "KP-2024-002": {
    orderNumber: "KP-2024-002",
    status: "preparing",
    customerName: "Carlos Rodríguez",
    address: "Carrera 7 # 72-64, Bogotá",
    items: ["Leche x4", "Pan x2", "Huevos x1", "Queso x2", "Jamón x1"],
    estimatedDelivery: "11:00 AM - 11:30 AM",
    lastUpdate: "Hace 15 minutos",
  },
  "KP-2024-004": {
    orderNumber: "KP-2024-004",
    status: "delivered",
    customerName: "Pedro López",
    address: "Calle 100 # 19-51, Usaquén",
    items: ["Frutas surtidas", "Verduras", "Carnes", "Lácteos"],
    estimatedDelivery: "Entregado",
    lastUpdate: "Hace 2 horas",
  },
};

const CustomerTracking = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [orderResult, setOrderResult] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSearching(true);

    setTimeout(() => {
      const order = mockOrderStatuses[searchQuery.toUpperCase()];
      if (order) {
        setOrderResult(order);
      } else {
        setError("No encontramos un pedido con ese número. Verifica e intenta de nuevo.");
        setOrderResult(null);
      }
      setIsSearching(false);
    }, 1000);
  };

  const statusSteps = [
    { key: "confirmed", label: "Confirmado", icon: CheckCircle2 },
    { key: "preparing", label: "Preparando", icon: Package },
    { key: "in_transit", label: "En camino", icon: Truck },
    { key: "delivered", label: "Entregado", icon: MapPin },
  ];

  const getCurrentStepIndex = (status: string) => {
    return statusSteps.findIndex((step) => step.key === status);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Link
            to="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5">
            <Package className="h-4 w-4 text-accent-foreground" />
            <span className="text-sm font-medium text-accent-foreground">
              Rastreo
            </span>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Search Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Rastrea tu pedido
          </h1>
          <p className="mb-6 text-muted-foreground">
            Ingresa el número de tu pedido para ver el estado
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ej: KP-2024-001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-card py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery || isSearching}
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {isSearching ? "..." : "Buscar"}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.p
                className="mt-3 text-sm text-destructive"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Order Result */}
        <AnimatePresence>
          {orderResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Status Timeline */}
              <div className="rounded-2xl bg-card p-6 shadow-card">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {orderResult.orderNumber}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Actualizado: {orderResult.lastUpdate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {orderResult.estimatedDelivery}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-6 top-0 h-full w-0.5 bg-border" />
                  {statusSteps.map((step, index) => {
                    const currentIndex = getCurrentStepIndex(orderResult.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.key}
                        className="relative flex items-center gap-4 pb-6 last:pb-0"
                      >
                        <div
                          className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                            isCompleted
                              ? isCurrent
                                ? "bg-primary text-primary-foreground animate-pulse-glow"
                                : "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={`font-semibold ${
                              isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-sm text-primary">Estado actual</p>
                          )}
                        </div>
                        {isCompleted && !isCurrent && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Driver Info */}
              {orderResult.status === "in_transit" && orderResult.driverName && (
                <motion.div
                  className="rounded-2xl bg-card p-6 shadow-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="mb-4 font-bold text-foreground">
                    Tu repartidor
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary">
                        <Truck className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {orderResult.driverName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          En camino a tu ubicación
                        </p>
                      </div>
                    </div>
                    <a
                      href={`tel:${orderResult.driverPhone}`}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Order Details */}
              <motion.div
                className="rounded-2xl bg-card p-6 shadow-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="mb-4 font-bold text-foreground">
                  Detalles del pedido
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Dirección de entrega
                      </p>
                      <p className="font-medium text-foreground">
                        {orderResult.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Package className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Productos</p>
                      <ul className="mt-1 space-y-1">
                        {orderResult.items.map((item, i) => (
                          <li key={i} className="text-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo hint */}
        {!orderResult && (
          <motion.div
            className="mt-8 rounded-xl bg-muted p-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground">
              💡 Prueba con: <strong>KP-2024-001</strong>, <strong>KP-2024-002</strong> o <strong>KP-2024-004</strong>
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default CustomerTracking;

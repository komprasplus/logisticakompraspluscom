import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  Navigation,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-kompras-plus.png";

interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  phone: string;
  items: number;
  status: "pending" | "in_transit" | "delivered";
  estimatedTime: string;
  priority: "normal" | "urgent";
}

const mockDeliveries: Delivery[] = [
  {
    id: "1",
    orderNumber: "KP-2024-001",
    customerName: "María García",
    address: "Calle 85 # 15-32, Chapinero",
    phone: "+57 300 123 4567",
    items: 3,
    status: "pending",
    estimatedTime: "10:30 AM",
    priority: "urgent",
  },
  {
    id: "2",
    orderNumber: "KP-2024-002",
    customerName: "Carlos Rodríguez",
    address: "Carrera 7 # 72-64, Bogotá",
    phone: "+57 311 987 6543",
    items: 5,
    status: "in_transit",
    estimatedTime: "11:00 AM",
    priority: "normal",
  },
  {
    id: "3",
    orderNumber: "KP-2024-003",
    customerName: "Ana Martínez",
    address: "Av. El Dorado # 68B-85",
    phone: "+57 320 456 7890",
    items: 2,
    status: "pending",
    estimatedTime: "11:45 AM",
    priority: "normal",
  },
  {
    id: "4",
    orderNumber: "KP-2024-004",
    customerName: "Pedro López",
    address: "Calle 100 # 19-51, Usaquén",
    phone: "+57 315 234 5678",
    items: 4,
    status: "delivered",
    estimatedTime: "09:15 AM",
    priority: "normal",
  },
];

const DriverDashboard = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>(mockDeliveries);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null
  );

  const pendingCount = deliveries.filter((d) => d.status === "pending").length;
  const inTransitCount = deliveries.filter(
    (d) => d.status === "in_transit"
  ).length;
  const deliveredCount = deliveries.filter(
    (d) => d.status === "delivered"
  ).length;

  const updateStatus = (
    id: string,
    newStatus: "pending" | "in_transit" | "delivered"
  ) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    );
    setSelectedDelivery(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-secondary text-secondary-foreground";
      case "in_transit":
        return "bg-primary text-primary-foreground";
      case "delivered":
        return "bg-green-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_transit":
        return "En camino";
      case "delivered":
        return "Entregado";
      default:
        return status;
    }
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
          <div className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5">
            <User className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              Repartidor
            </span>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
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

        {/* Deliveries List */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold text-foreground">Mis Entregas</h2>

          {deliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              className="rounded-2xl bg-card p-4 shadow-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedDelivery(delivery)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {delivery.orderNumber}
                    </span>
                    {delivery.priority === "urgent" && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        Urgente
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {delivery.customerName}
                  </p>
                  <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{delivery.address}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{delivery.items} items</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{delivery.estimatedTime}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                    delivery.status
                  )}`}
                >
                  {getStatusLabel(delivery.status)}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Delivery Detail Modal */}
      <AnimatePresence>
        {selectedDelivery && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDelivery(null)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl bg-card p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />

              <h3 className="text-xl font-bold text-foreground">
                {selectedDelivery.orderNumber}
              </h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedDelivery.customerName}
                    </p>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedDelivery.address}
                    </p>
                    <p className="text-sm text-muted-foreground">Dirección</p>
                  </div>
                </div>

                <a
                  href={`tel:${selectedDelivery.phone}`}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Phone className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedDelivery.phone}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Toca para llamar
                    </p>
                  </div>
                </a>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {selectedDelivery.status === "pending" && (
                  <button
                    onClick={() =>
                      updateStatus(selectedDelivery.id, "in_transit")
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-95"
                  >
                    <Navigation className="h-5 w-5" />
                    Iniciar Ruta
                  </button>
                )}
                {selectedDelivery.status === "in_transit" && (
                  <button
                    onClick={() =>
                      updateStatus(selectedDelivery.id, "delivered")
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-semibold text-white transition-transform active:scale-95"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Confirmar Entrega
                  </button>
                )}
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="rounded-xl bg-muted py-3 font-semibold text-muted-foreground transition-transform active:scale-95"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverDashboard;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Loader2,
  Phone,
  Warehouse,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-kompras-plus.png";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
}

const SUPPORT_PHONE = "324 222 3825";

const CustomerTracking = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [orderResult, setOrderResult] = useState<Pedido | null>(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setError("");
    setIsSearching(true);
    setOrderResult(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("pedidos")
        .select("*")
        .ilike("numero_guia", `%${searchQuery.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setOrderResult(data);
      } else {
        setError(
          "No encontramos tu guía, por favor verifica el número o comunícate con Kompras Plus al 324 222 3825"
        );
      }
    } catch (err) {
      console.error("Error searching:", err);
      setError("Error al buscar el pedido. Por favor intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusInfo = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "recibido":
      case "pedido recibido":
        return {
          label: "Pedido Recibido",
          description: "Tu pedido ha sido recibido correctamente",
          color: "bg-primary text-primary-foreground",
          step: 1,
        };
      case "en bodega":
      case "pendiente":
        return {
          label: "En Bodega",
          description: "Tu paquete está siendo procesado en nuestra sede central de Bogotá",
          color: "bg-secondary text-secondary-foreground",
          step: 2,
        };
      case "en ruta":
      case "en camino":
        return {
          label: "En Ruta",
          description: "Tu pedido está en camino hacia tu dirección",
          color: "bg-primary text-primary-foreground",
          step: 3,
        };
      case "entregado":
        return {
          label: "Entregado",
          description: "Tu pedido ha sido entregado exitosamente",
          color: "bg-green-500 text-white",
          step: 4,
        };
      default:
        return {
          label: status || "Recibido",
          description: "Tu pedido está siendo procesado",
          color: "bg-muted text-muted-foreground",
          step: 1,
        };
    }
  };

  const statusSteps = [
    { key: 1, label: "Pedido Recibido", icon: Package, description: "Pedido confirmado" },
    { key: 2, label: "En Bodega", icon: Warehouse, description: "Preparando envío" },
    { key: 3, label: "En Ruta", icon: Truck, description: "En camino" },
    { key: 4, label: "Entregado", icon: CheckCircle2, description: "¡Completado!" },
  ];

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
            <Package className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              Rastreo
            </span>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Warehouse Address */}
        <motion.div
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <MapPin className="h-4 w-4" />
          <span>Bodega: Carrera 20 # 14-30 local 212, Bogotá</span>
        </motion.div>

        {/* Support Phone - Always visible */}
        <motion.div
          className="mb-6 flex items-center gap-2 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Phone className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Soporte:</span>
          <a 
            href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} 
            className="text-primary font-semibold hover:underline"
          >
            {SUPPORT_PHONE}
          </a>
        </motion.div>

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
            Ingresa el número de guía para ver el estado de tu pedido
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ej: GU-001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-card py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim() || isSearching}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Buscar"
              )}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-sm text-destructive font-medium">
                  {error}
                </p>
                <a 
                  href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  📞 Llamar ahora
                </a>
              </motion.div>
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
              {/* Status Card */}
              <div className="rounded-2xl bg-card p-6 shadow-card">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {orderResult.numero_guia || `Pedido #${orderResult.id}`}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {orderResult.cliente_nombre || "Cliente"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      getStatusInfo(orderResult.estado).color
                    }`}
                  >
                    {getStatusInfo(orderResult.estado).label}
                  </span>
                </div>

                {/* Status Timeline - Horizontal */}
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full">
                    <motion.div 
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${((getStatusInfo(orderResult.estado).step - 1) / (statusSteps.length - 1)) * 100}%` 
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  
                  {/* Steps */}
                  <div className="relative flex justify-between">
                    {statusSteps.map((step, index) => {
                      const currentStep = getStatusInfo(orderResult.estado).step;
                      const isCompleted = step.key <= currentStep;
                      const isCurrent = step.key === currentStep;
                      const Icon = step.icon;

                      return (
                        <motion.div
                          key={step.key}
                          className="flex flex-col items-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div
                            className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 transition-all ${
                              isCompleted
                                ? isCurrent
                                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                                  : "bg-green-500 text-white border-green-500"
                                : "bg-muted text-muted-foreground border-muted"
                            }`}
                          >
                            {isCompleted && !isCurrent ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                            {isCurrent && (
                              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-3 text-xs font-semibold text-center max-w-[70px] ${
                              isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <motion.p 
                              className="mt-1 text-[10px] text-primary text-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              {step.description}
                            </motion.p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Message for En Bodega */}
                {(orderResult.estado?.toLowerCase() === "en bodega" || 
                  orderResult.estado?.toLowerCase() === "pendiente") && (
                  <motion.div
                    className="mt-6 rounded-xl bg-secondary/20 p-4 border border-secondary/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex items-start gap-3">
                      <Warehouse className="h-5 w-5 text-secondary-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-secondary-foreground">
                          Tu paquete está siendo procesado
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Tu paquete está siendo procesado en nuestra sede central de Bogotá. 
                          Pronto estará en camino hacia tu dirección.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Order Details */}
              <motion.div
                className="rounded-2xl bg-card p-6 shadow-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
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
                        {orderResult.direccion_entrega || "Sin dirección registrada"}
                      </p>
                    </div>
                  </div>
                  {orderResult.corte_horario && (
                    <div className="flex items-start gap-3">
                      <Package className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Corte de despacho
                        </p>
                        <p className="font-medium text-foreground">
                          {orderResult.corte_horario}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Need help banner */}
              <motion.div
                className="rounded-xl bg-primary/10 p-4 border border-primary/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-sm text-foreground font-medium text-center">
                  ¿Necesitas ayuda? Llámanos al{" "}
                  <a 
                    href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                    className="text-primary font-bold hover:underline"
                  >
                    {SUPPORT_PHONE}
                  </a>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help hint */}
        {!orderResult && !error && (
          <motion.div
            className="mt-8 rounded-xl bg-muted p-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground">
              💡 Ingresa tu número de guía para rastrear tu pedido en tiempo real
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default CustomerTracking;
import { useState, useEffect } from "react";
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
// Logo replaced with text for stability
import MotorcycleIcon from "@/components/MotorcycleIcon";
import MotorizadoInfo from "@/components/MotorizadoInfo";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  motorizado_asignado: string | null;
}

interface MotorizadoProfile {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  vehicle_plate: string | null;
}

const SUPPORT_PHONE = "324 222 3825";
const WAREHOUSE_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá";

const CustomerTracking = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [orderResult, setOrderResult] = useState<Pedido | null>(null);
  const [motorizadoProfile, setMotorizadoProfile] = useState<MotorizadoProfile | null>(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch motorizado profile when order changes
  useEffect(() => {
    const fetchMotorizadoProfile = async () => {
      if (!orderResult?.motorizado_asignado) {
        setMotorizadoProfile(null);
        return;
      }

      // Only fetch if order is En Ruta or later
      const status = orderResult.estado?.toLowerCase();
      if (status !== "en ruta" && status !== "en camino" && status !== "entregado") {
        setMotorizadoProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url, vehicle_plate")
          .eq("full_name", orderResult.motorizado_asignado)
          .maybeSingle();

        if (error) throw error;
        setMotorizadoProfile(data);
      } catch (err) {
        console.error("Error fetching motorizado profile:", err);
        setMotorizadoProfile(null);
      }
    };

    fetchMotorizadoProfile();
  }, [orderResult?.motorizado_asignado, orderResult?.estado]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setError("");
    setIsSearching(true);
    setOrderResult(null);
    setMotorizadoProfile(null);

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
          "No encontramos tu guía, por favor verifica el número o comunícate con Plus Envíos al 324 222 3825"
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
          label: "Recibido",
          description: "Tu pedido ha sido recibido correctamente",
          color: "bg-primary text-primary-foreground",
          step: 1,
        };
      case "en bodega":
      case "pendiente":
        return {
          label: "En Bodega",
          description: `Tu pedido está siendo procesado en nuestra bodega central en ${WAREHOUSE_ADDRESS}`,
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
    { key: 1, label: "Recibido", icon: Package },
    { key: 2, label: "En Bodega", icon: Warehouse },
    { key: 3, label: "En Ruta", icon: Truck },
    { key: 4, label: "Entregado", icon: CheckCircle2 },
  ];

  // Calculate motorcycle position based on current step (0%, 33%, 66%, 100%)
  const getMotorcyclePosition = (step: number) => {
    switch (step) {
      case 1:
        return 0;
      case 2:
        return 33;
      case 3:
        return 66;
      case 4:
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header with Logo */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 sm:h-20 items-center justify-between px-3 sm:px-4">
          <Link
            to="/"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </Link>
          
          {/* Center Text Logo */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-xl sm:text-2xl font-bold text-primary">Plus Envíos</span>
          </motion.div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary px-3 py-1.5 sm:px-4 sm:py-2">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
            <span className="text-xs sm:text-sm font-semibold text-primary-foreground">
              Rastreo
            </span>
          </div>
        </div>
      </header>

      <main className="container px-3 sm:px-4 py-6 sm:py-8">
        {/* Support Info Bar */}
        <motion.div
          className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-xl sm:rounded-2xl bg-white p-3 sm:p-4 shadow-sm border border-border"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Bodega Central</p>
              <p className="text-xs sm:text-sm font-medium text-foreground truncate">{WAREHOUSE_ADDRESS}</p>
            </div>
          </div>
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
            className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity w-full sm:w-auto justify-center"
          >
            <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {SUPPORT_PHONE}
          </a>
        </motion.div>

        {/* Search Section */}
        <motion.div
          className="mb-8 sm:mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="mb-2 text-2xl sm:text-3xl font-bold text-foreground text-center">
            Rastrea tu pedido
          </h1>
          <p className="mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground text-center px-2">
            Ingresa el número de guía para ver el estado de tu pedido
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ej: GU-001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border-2 border-primary/20 bg-white py-3 sm:py-4 pl-10 sm:pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 text-base sm:text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim() || isSearching}
              className="rounded-xl sm:rounded-2xl bg-primary px-6 sm:px-8 py-3 sm:py-4 font-bold text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:shadow-none text-sm sm:text-base"
            >
              {isSearching ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mx-auto" />
              ) : (
                "Buscar"
              )}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                className="mt-6 max-w-xl mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 p-5"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-sm text-destructive font-medium text-center">
                  {error}
                </p>
                <div className="mt-3 flex justify-center">
                  <a 
                    href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Phone className="h-4 w-4" />
                    Llamar ahora
                  </a>
                </div>
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
              className="space-y-6 max-w-4xl mx-auto"
            >
              {/* Main Tracking Card */}
              <div className="rounded-3xl bg-white p-4 sm:p-6 md:p-8 shadow-sm border border-border overflow-hidden">
                {/* Order Header */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {orderResult.numero_guia || `Pedido #${orderResult.id}`}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {orderResult.cliente_nombre || "Cliente"}
                    </p>
                  </div>
                  <motion.span
                    className={`rounded-full px-4 py-2 text-xs sm:text-sm font-bold ${
                      getStatusInfo(orderResult.estado).color
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    {getStatusInfo(orderResult.estado).label}
                  </motion.span>
                </div>

                {/* Visual Timeline with Motorcycle */}
                <div className="relative py-8 sm:py-12 px-2 sm:px-4">
                  {/* Track Background */}
                  <div className="absolute top-1/2 left-6 right-6 sm:left-8 sm:right-8 h-1.5 sm:h-2 -translate-y-1/2 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${getMotorcyclePosition(getStatusInfo(orderResult.estado).step)}%` 
                      }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                  
                  {/* Animated Motorcycle - Floating above timeline */}
                  <motion.div
                    className="absolute z-20"
                    style={{ top: "calc(50% - 28px)" }}
                    initial={{ left: "6px" }}
                    animate={{ 
                      left: `calc(${getMotorcyclePosition(getStatusInfo(orderResult.estado).step)}% * 0.85 + 6px)`
                    }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                  >
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
                      className="drop-shadow-lg"
                    >
                      <MotorcycleIcon className="w-12 h-8 sm:w-16 sm:h-10" />
                    </motion.div>
                  </motion.div>
                  
                  {/* Step Nodes */}
                  <div className="relative flex justify-between px-0 sm:px-2">
                    {statusSteps.map((step, index) => {
                      const currentStep = getStatusInfo(orderResult.estado).step;
                      const isCompleted = step.key < currentStep;
                      const isCurrent = step.key === currentStep;
                      const Icon = step.icon;

                      return (
                        <motion.div
                          key={step.key}
                          className="flex flex-col items-center w-16 sm:w-20"
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.15 }}
                        >
                          <motion.div
                            className={`relative z-10 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 sm:border-4 shadow-sm transition-all ${
                              isCompleted
                                ? "bg-green-500 text-white border-green-400"
                                : isCurrent
                                ? "bg-primary text-primary-foreground border-primary ring-2 sm:ring-4 ring-primary/20"
                                : "bg-white text-muted-foreground border-muted"
                            }`}
                            whileHover={{ scale: 1.1 }}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 sm:h-7 sm:w-7" />
                            ) : (
                              <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
                            )}
                            {isCurrent && (
                              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-3 w-3 sm:h-4 sm:w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 sm:h-4 sm:w-4 bg-primary border-2 border-white"></span>
                              </span>
                            )}
                          </motion.div>
                          <p
                            className={`mt-2 sm:mt-4 text-[10px] sm:text-xs font-bold text-center leading-tight ${
                              isCompleted || isCurrent
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Status Message */}
                <motion.div
                  className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 p-4 sm:p-6 border border-primary/20"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                      {getStatusInfo(orderResult.estado).step === 2 ? (
                        <Warehouse className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      ) : getStatusInfo(orderResult.estado).step === 3 ? (
                        <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      ) : getStatusInfo(orderResult.estado).step === 4 ? (
                        <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      ) : (
                        <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-base sm:text-lg">
                        {getStatusInfo(orderResult.estado).label}
                      </p>
                      <p className="text-sm sm:text-base text-muted-foreground mt-1">
                        {getStatusInfo(orderResult.estado).description}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Motorizado Info - Only show when En Ruta or Entregado */}
                {motorizadoProfile && (
                  getStatusInfo(orderResult.estado).step >= 3
                ) && (
                  <motion.div
                    className="mt-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                  >
                    <MotorizadoInfo
                      name={motorizadoProfile.full_name}
                      phone={motorizadoProfile.phone}
                      avatarUrl={motorizadoProfile.avatar_url}
                      vehiclePlate={motorizadoProfile.vehicle_plate}
                    />
                  </motion.div>
                )}

                {/* Warehouse Info - Always visible */}
                <motion.div
                  className="mt-4 p-4 rounded-xl bg-white border border-primary/10 shadow-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Tu pedido está en proceso en nuestra bodega central:{" "}
                      <span className="font-semibold text-foreground">{WAREHOUSE_ADDRESS}</span>
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Order Details Card */}
              <motion.div
                className="rounded-2xl bg-white p-6 shadow-lg border border-border"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="mb-5 text-lg font-bold text-foreground">
                  Detalles del pedido
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Dirección de entrega
                      </p>
                      <p className="font-semibold text-foreground">
                        {orderResult.direccion_entrega || "Sin dirección registrada"}
                      </p>
                    </div>
                  </div>
                  {orderResult.corte_horario && (
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                      <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Corte de despacho
                        </p>
                        <p className="font-semibold text-foreground">
                          {orderResult.corte_horario}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Help Banner */}
              <motion.div
                className="rounded-2xl bg-primary p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-primary-foreground font-medium text-center mb-3">
                  ¿Necesitas ayuda con tu pedido?
                </p>
                <div className="flex justify-center">
                  <a 
                    href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-primary font-bold hover:bg-white/90 transition-colors"
                  >
                    <Phone className="h-5 w-5" />
                    Llamar al {SUPPORT_PHONE}
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!orderResult && !error && (
          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-12 w-12 text-primary" />
            </div>
            <p className="text-muted-foreground text-lg">
              Ingresa tu número de guía para rastrear tu pedido en tiempo real
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default CustomerTracking;
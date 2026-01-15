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
          "No encontramos un pedido con ese número de guía. Verifica e intenta de nuevo."
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
      case "pendiente":
        return {
          label: "Pendiente",
          description: "Tu pedido está siendo procesado",
          color: "bg-secondary text-secondary-foreground",
          step: 1,
        };
      case "en camino":
        return {
          label: "En Camino",
          description: "Tu pedido está en ruta de entrega",
          color: "bg-primary text-primary-foreground",
          step: 2,
        };
      case "entregado":
        return {
          label: "Entregado",
          description: "Tu pedido ha sido entregado exitosamente",
          color: "bg-green-500 text-white",
          step: 3,
        };
      default:
        return {
          label: status || "Desconocido",
          description: "Estado del pedido",
          color: "bg-muted text-muted-foreground",
          step: 0,
        };
    }
  };

  const statusSteps = [
    { key: 1, label: "Pendiente", icon: Package },
    { key: 2, label: "En Camino", icon: Truck },
    { key: 3, label: "Entregado", icon: CheckCircle2 },
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
          <div className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5">
            <Package className="h-4 w-4 text-accent-foreground" />
            <span className="text-sm font-medium text-accent-foreground">
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
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
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

                {/* Status Timeline */}
                <div className="relative">
                  <div className="absolute left-6 top-0 h-full w-0.5 bg-border" />
                  {statusSteps.map((step) => {
                    const currentStep = getStatusInfo(orderResult.estado).step;
                    const isCompleted = step.key <= currentStep;
                    const isCurrent = step.key === currentStep;
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
                                ? "bg-primary text-primary-foreground animate-pulse"
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
                            <p className="text-sm text-primary">
                              {getStatusInfo(orderResult.estado).description}
                            </p>
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

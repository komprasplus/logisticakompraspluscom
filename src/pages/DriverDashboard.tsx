import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  User,
  Filter,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  foto_evidencia: string | null;
}

const DriverDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchPedidos();
  }, []);

  useEffect(() => {
    if (activeFilter) {
      setFilteredPedidos(pedidos.filter((p) => p.corte_horario === activeFilter));
    } else {
      setFilteredPedidos(pedidos);
    }
  }, [activeFilter, pedidos]);

  const fetchPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      setPedidos(data || []);
      setFilteredPedidos(data || []);
    } catch (error) {
      console.error("Error fetching pedidos:", error);
      toast.error("Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

  const updateEstado = async (id: number, newEstado: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: newEstado })
        .eq("id", id);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: newEstado } : p))
      );
      setSelectedPedido(null);
      toast.success(`Pedido marcado como ${newEstado}`);
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  const pendingCount = pedidos.filter(
    (p) => p.estado?.toLowerCase() === "pendiente"
  ).length;
  const inTransitCount = pedidos.filter(
    (p) => p.estado?.toLowerCase() === "en camino"
  ).length;
  const deliveredCount = pedidos.filter(
    (p) => p.estado?.toLowerCase() === "entregado"
  ).length;

  const getStatusColor = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "pendiente":
        return "bg-secondary text-secondary-foreground";
      case "en camino":
        return "bg-primary text-primary-foreground";
      case "entregado":
        return "bg-green-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const cortes = ["Corte 1", "Corte 2", "Corte 3"];

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
        {/* Warehouse Address */}
        <motion.div
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <MapPin className="h-4 w-4" />
          <span>Bodega: Carrera 20 # 14-30 local 212, Bogotá</span>
        </motion.div>

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

        {/* Filters */}
        <motion.div
          className="mb-4 flex flex-wrap items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos
          </button>
          {cortes.map((corte) => (
            <button
              key={corte}
              onClick={() => setActiveFilter(corte)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === corte
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {corte}
            </button>
          ))}
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Pedidos List */
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-foreground">
              Mis Entregas ({filteredPedidos.length})
            </h2>

            {filteredPedidos.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  No hay pedidos {activeFilter ? `para ${activeFilter}` : "disponibles"}
                </p>
              </div>
            ) : (
              filteredPedidos.map((pedido, index) => (
                <motion.div
                  key={pedido.id}
                  className="rounded-2xl bg-card p-4 shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedPedido(pedido)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {pedido.numero_guia || `#${pedido.id}`}
                        </span>
                        {pedido.corte_horario && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            {pedido.corte_horario}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {pedido.cliente_nombre || "Cliente sin nombre"}
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{pedido.direccion_entrega || "Sin dirección"}</span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                        pedido.estado
                      )}`}
                    >
                      {pedido.estado || "Sin estado"}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </main>

      {/* Pedido Detail Modal */}
      <AnimatePresence>
        {selectedPedido && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPedido(null)}
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
                {selectedPedido.numero_guia || `Pedido #${selectedPedido.id}`}
              </h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedPedido.cliente_nombre || "Cliente sin nombre"}
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
                      {selectedPedido.direccion_entrega || "Sin dirección"}
                    </p>
                    <p className="text-sm text-muted-foreground">Dirección</p>
                  </div>
                </div>

                {selectedPedido.corte_horario && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {selectedPedido.corte_horario}
                      </p>
                      <p className="text-sm text-muted-foreground">Corte de despacho</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedPedido.estado || "Sin estado"}
                    </p>
                    <p className="text-sm text-muted-foreground">Estado actual</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {selectedPedido.estado?.toLowerCase() !== "entregado" && (
                  <button
                    onClick={() => updateEstado(selectedPedido.id, "Entregado")}
                    disabled={updating}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {updating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Marcar como Entregado
                  </button>
                )}
                <button
                  onClick={() => setSelectedPedido(null)}
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

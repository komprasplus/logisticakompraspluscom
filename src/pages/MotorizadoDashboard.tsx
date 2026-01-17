import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  User,
  Filter,
  Loader2,
  Navigation,
  Camera,
  Phone,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  client_phone: string | null;
}

const BODEGA_ADDRESS = "Carrera 20 # 14-30 local 212, Bogotá, Colombia";
const SUPPORT_PHONE = "324 222 3825";

const MotorizadoDashboard = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPedidos();
  }, []);

  useEffect(() => {
    let filtered = [...pedidos];

    if (activeFilter) {
      filtered = filtered.filter((p) => p.corte_horario === activeFilter);
    }

    // Sort by corte_horario priority
    const corteOrder: { [key: string]: number } = {
      "Corte 1": 1,
      "Corte 2": 2,
      "Corte 3": 3,
    };

    filtered.sort((a, b) => {
      const orderA = corteOrder[a.corte_horario || ""] || 99;
      const orderB = corteOrder[b.corte_horario || ""] || 99;
      return orderA - orderB;
    });

    setFilteredPedidos(filtered);
  }, [activeFilter, pedidos]);

  const fetchPedidos = async () => {
    try {
      // Motorizados only see their assigned orders for today (RLS handles this)
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

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openPhotoCapture = () => {
    setShowPhotoModal(true);
    setCapturedPhoto(null);
  };

  const confirmDelivery = async () => {
    if (!selectedPedido || !capturedPhoto) {
      toast.error("Debes tomar una foto de evidencia");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          estado: "Entregado",
          foto_evidencia: capturedPhoto,
        })
        .eq("id", selectedPedido.id);

      if (error) throw error;

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === selectedPedido.id
            ? { ...p, estado: "Entregado", foto_evidencia: capturedPhoto }
            : p
        )
      );

      setSelectedPedido(null);
      setShowPhotoModal(false);
      setCapturedPhoto(null);
      toast.success("Pedido marcado como Entregado con evidencia");
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setUpdating(false);
    }
  };

  const openGoogleMaps = (address: string) => {
    const encodedOrigin = encodeURIComponent(BODEGA_ADDRESS);
    const encodedDestination = encodeURIComponent(address + ", Bogotá, Colombia");
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving`;
    window.open(mapsUrl, "_blank");
  };

  const openWhatsApp = (phone?: string | null) => {
    const phoneNumber = phone?.replace(/\D/g, "") || "573242223825";
    const message = encodeURIComponent(
      `Hola, soy el motorizado de Kompras Plus. Voy en camino con tu pedido.`
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const pendingCount = pedidos.filter(
    (p) =>
      p.estado?.toLowerCase() === "pendiente" ||
      p.estado?.toLowerCase() === "en bodega"
  ).length;
  const inTransitCount = pedidos.filter(
    (p) =>
      p.estado?.toLowerCase() === "en camino" ||
      p.estado?.toLowerCase() === "en ruta"
  ).length;
  const deliveredCount = pedidos.filter(
    (p) => p.estado?.toLowerCase() === "entregado"
  ).length;

  const getStatusColor = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "pendiente":
      case "en bodega":
        return "bg-secondary text-secondary-foreground";
      case "en camino":
      case "en ruta":
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
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kompras Plus" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5">
              <User className="h-4 w-4 text-primary-foreground" />
              <span className="text-sm font-medium text-primary-foreground">
                {profile?.full_name || "Motorizado"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
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
          <span>Bodega: {BODEGA_ADDRESS.split(",")[0]}, Bogotá</span>
        </motion.div>

        {/* Support Phone */}
        <motion.div
          className="mb-4 flex items-center gap-2 text-sm"
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
              Mis Entregas de Hoy ({filteredPedidos.length})
            </h2>

            {filteredPedidos.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  No hay pedidos asignados para hoy
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

                      {/* Action buttons in card */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (pedido.direccion_entrega) {
                              openGoogleMaps(pedido.direccion_entrega);
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform active:scale-95"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Ver ubicación
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsApp(pedido.client_phone);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition-transform active:scale-95"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </button>
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
        {selectedPedido && !showPhotoModal && (
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
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.cliente_nombre || "Cliente sin nombre"}
                    </p>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                  </div>
                  <button
                    onClick={() => openWhatsApp(selectedPedido.client_phone)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white transition-transform active:scale-95"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.direccion_entrega || "Sin dirección"}
                    </p>
                    <p className="text-sm text-muted-foreground">Dirección de entrega</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {selectedPedido.corte_horario || "Sin corte"}
                    </p>
                    <p className="text-sm text-muted-foreground">Corte horario</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (selectedPedido.direccion_entrega) {
                      openGoogleMaps(selectedPedido.direccion_entrega);
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition-transform active:scale-95"
                >
                  <Navigation className="h-5 w-5" />
                  Navegar
                </button>
                <button
                  onClick={openPhotoCapture}
                  disabled={selectedPedido.estado?.toLowerCase() === "entregado"}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Camera className="h-5 w-5" />
                  Entregar
                </button>
              </div>

              {selectedPedido.foto_evidencia && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Foto de evidencia:</p>
                  <img
                    src={selectedPedido.foto_evidencia}
                    alt="Evidencia"
                    className="w-full h-32 object-cover rounded-xl"
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Capture Modal */}
      <AnimatePresence>
        {showPhotoModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowPhotoModal(false);
              setCapturedPhoto(null);
            }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-foreground mb-4">
                Foto de Evidencia
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {capturedPhoto ? (
                <div className="space-y-4">
                  <img
                    src={capturedPhoto}
                    alt="Captura"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl bg-muted py-3 font-medium text-muted-foreground"
                    >
                      Volver a tomar
                    </button>
                    <button
                      onClick={confirmDelivery}
                      disabled={updating}
                      className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {updating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Confirmar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="h-12 w-12" />
                  <span className="font-medium">Tomar foto</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MotorizadoDashboard;

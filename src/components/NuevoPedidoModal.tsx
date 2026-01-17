import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  MapPin,
  Package,
  DollarSign,
  CreditCard,
  Calendar as CalendarIcon,
  Truck,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getZonaFromBarrio, ZONAS, type ZonaCodigo } from "@/lib/zonas";

// Barrios de Bogotá más populares organizados por localidad
const BARRIOS_BOGOTA = [
  // Usaquén
  "Usaquén Centro",
  "Santa Bárbara",
  "Cedritos",
  "Country Club",
  "La Carolina",
  "Toberín",
  "Barrancas",
  // Chapinero
  "Chapinero Alto",
  "Chapinero Central",
  "El Nogal",
  "El Chicó",
  "Rosales",
  "La Cabrera",
  // Suba
  "Niza",
  "Prado Veraniego",
  "Suba Centro",
  "Ciudad Jardín Norte",
  "El Rincón",
  "Tibabuyes",
  "Casa Blanca Suba",
  // Engativá
  "Engativá Centro",
  "Las Ferias",
  "Minuto de Dios",
  "Boyacá Real",
  "Álamos Norte",
  "Santa Helenita",
  // Fontibón
  "Fontibón Centro",
  "Modelia",
  "Hayuelos",
  "Capellanía",
  // Kennedy
  "Kennedy Central",
  "Patio Bonito",
  "Timiza",
  "Tintalá",
  "Castilla",
  "Marsella",
  // Bosa
  "Bosa Centro",
  "El Recreo",
  "San José de Bosa",
  // Teusaquillo
  "Teusaquillo Centro",
  "Galerías",
  "Palermo",
  "La Esmeralda",
  "La Soledad",
  // Barrios Unidos
  "Doce de Octubre",
  "Siete de Agosto",
  "Alcázares",
  "San Fernando",
  // Santa Fe
  "La Candelaria",
  "Las Nieves",
  "La Macarena",
  // Antonio Nariño
  "Restrepo",
  "Ciudad Jardín Sur",
  // Puente Aranda
  "Puente Aranda Centro",
  "Galán",
  "Muzú",
  // Los Mártires
  "Santa Isabel",
  "El Listón",
  "Ricaurte",
  // Rafael Uribe Uribe
  "Quiroga",
  "Marco Fidel Suárez",
  "Inglés",
  // Ciudad Bolívar
  "Ciudad Bolívar Centro",
  "Candelaria La Nueva",
  "El Tesoro",
  // Tunjuelito
  "Tunjuelito Centro",
  "Venecia",
  "San Carlos",
  // Usme
  "Usme Centro",
  "Santa Librada",
  "La Flora",
  // San Cristóbal
  "San Cristóbal Centro",
  "20 de Julio",
  "La Victoria",
].sort();

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface NuevoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin: boolean;
}

const NuevoPedidoModal = ({
  isOpen,
  onClose,
  onSuccess,
  isAdmin,
}: NuevoPedidoModalProps) => {
  // Form state
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [barrio, setBarrio] = useState("");
  const [barrioSearch, setBarrioSearch] = useState("");
  const [direccionDetalle, setDireccionDetalle] = useState("");
  const [productoNombre, setProductoNombre] = useState("");
  const [valorRecaudar, setValorRecaudar] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "anticipado">("efectivo");
  const [fechaEntrega, setFechaEntrega] = useState<Date | undefined>(undefined);
  const [motorizadoAsignado, setMotorizadoAsignado] = useState("");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [showBarrioDropdown, setShowBarrioDropdown] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [fetchingCoords, setFetchingCoords] = useState(false);

  // Fetch motorizados for admin selector
  useEffect(() => {
    if (isAdmin && isOpen) {
      fetchMotorizados();
    }
  }, [isAdmin, isOpen]);

  const fetchMotorizados = async () => {
    try {
      // Get user IDs with motorizado role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map((r) => r.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", userIds)
          .eq("status", "activo");

        if (profileError) throw profileError;
        setMotorizados(profiles || []);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  };

  // Validate Colombian phone number
  const validatePhone = (phone: string) => {
    // Remove spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, "");
    // Colombian format: 10 digits starting with 3
    const colombianMobile = /^3\d{9}$/;
    // With country code
    const withCountryCode = /^(\+57)?3\d{9}$/;
    
    if (!cleaned) {
      setPhoneError("El teléfono es requerido");
      return false;
    }
    
    if (!colombianMobile.test(cleaned) && !withCountryCode.test(cleaned)) {
      setPhoneError("Ingresa un número válido de WhatsApp (ej: 3124567890)");
      return false;
    }
    
    setPhoneError("");
    return true;
  };

  // Get coordinates from barrio using Nominatim
  const getCoordinatesFromBarrio = async (barrioName: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      setFetchingCoords(true);
      const query = encodeURIComponent(`${barrioName}, Bogotá, Colombia`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching coordinates:", error);
      return null;
    } finally {
      setFetchingCoords(false);
    }
  };

  // Generate guide number
  const generateGuideNumber = () => {
    const prefix = "KP";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  };

  // Filter barrios based on search
  const filteredBarrios = BARRIOS_BOGOTA.filter((b) =>
    b.toLowerCase().includes(barrioSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone
    if (!validatePhone(clienteTelefono)) return;
    
    // Validate required fields
    if (!clienteNombre.trim() || !barrio || !productoNombre.trim()) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    setLoading(true);

    try {
      // Get coordinates from barrio
      const coords = await getCoordinatesFromBarrio(barrio);
      
      // Build full address
      const direccionCompleta = direccionDetalle
        ? `${barrio}, ${direccionDetalle}, Bogotá`
        : `${barrio}, Bogotá`;

      // Generate guide number
      const numeroGuia = generateGuideNumber();

      // Get current user for client orders
      const { data: { user } } = await supabase.auth.getUser();

      // Get zone from barrio
      const zona = getZonaFromBarrio(barrio);

      const pedidoData = {
        numero_guia: numeroGuia,
        cliente_nombre: clienteNombre.trim(),
        client_phone: clienteTelefono.replace(/[\s-]/g, ""),
        direccion_entrega: direccionCompleta,
        barrio: barrio,
        zona: zona,
        producto_nombre: productoNombre.trim(),
        valor_recaudar: valorRecaudar ? parseFloat(valorRecaudar) : null,
        metodo_pago: metodoPago,
        fecha_entrega: fechaEntrega ? format(fechaEntrega, "yyyy-MM-dd") : null,
        estado: "pendiente",
        latitud: coords?.lat || null,
        longitud: coords?.lng || null,
        motorizado_asignado: isAdmin && motorizadoAsignado ? motorizadoAsignado : null,
        client_user_id: !isAdmin ? user?.id : null,
      };

      const { error } = await supabase.from("pedidos").insert(pedidoData);

      if (error) throw error;

      toast.success(`Pedido creado exitosamente. Guía: ${numeroGuia}`);
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Error al crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setClienteNombre("");
    setClienteTelefono("");
    setBarrio("");
    setBarrioSearch("");
    setDireccionDetalle("");
    setProductoNombre("");
    setValorRecaudar("");
    setMetodoPago("efectivo");
    setFechaEntrega(undefined);
    setMotorizadoAsignado("");
    setPhoneError("");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 rounded-2xl bg-card shadow-xl"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Nuevo Pedido</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Section: Client Data */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Datos del Cliente
              </h3>
              
              {/* Nombre */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nombre y Apellido *"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Teléfono */}
              <div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="WhatsApp (ej: 3124567890) *"
                    value={clienteTelefono}
                    onChange={(e) => {
                      setClienteTelefono(e.target.value);
                      if (phoneError) validatePhone(e.target.value);
                    }}
                    onBlur={() => validatePhone(clienteTelefono)}
                    required
                    maxLength={15}
                    className={cn(
                      "w-full rounded-lg border bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2",
                      phoneError
                        ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary focus:ring-primary/20"
                    )}
                  />
                </div>
                {phoneError && (
                  <p className="mt-1 text-xs text-destructive">{phoneError}</p>
                )}
              </div>
            </div>

            {/* Section: Address */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dirección de Entrega
              </h3>
              
              {/* Barrio Selector */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <input
                  type="text"
                  placeholder="Buscar barrio de Bogotá *"
                  value={barrio || barrioSearch}
                  onChange={(e) => {
                    setBarrioSearch(e.target.value);
                    setBarrio("");
                    setShowBarrioDropdown(true);
                  }}
                  onFocus={() => setShowBarrioDropdown(true)}
                  required
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {fetchingCoords && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
                
                {/* Dropdown */}
                {showBarrioDropdown && barrioSearch && (
                  <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                    {filteredBarrios.length > 0 ? (
                      filteredBarrios.slice(0, 10).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setBarrio(b);
                            setBarrioSearch("");
                            setShowBarrioDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                        >
                          {b}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-2 text-sm text-muted-foreground">
                        No se encontró el barrio
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Detalle de dirección */}
              <input
                type="text"
                placeholder="Detalle (Cra, Calle, Apto, Casa)"
                value={direccionDetalle}
                onChange={(e) => setDireccionDetalle(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Section: Package */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Detalles del Paquete
              </h3>
              
              {/* Producto */}
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nombre del Producto *"
                  value={productoNombre}
                  onChange={(e) => setProductoNombre(e.target.value)}
                  required
                  maxLength={150}
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Valor a recaudar */}
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="Valor a Recaudar (COP)"
                  value={valorRecaudar}
                  onChange={(e) => setValorRecaudar(e.target.value)}
                  min="0"
                  step="100"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Section: Payment Method */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Método de Pago
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMetodoPago("efectivo")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                    metodoPago === "efectivo"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <DollarSign className="h-4 w-4" />
                  Contra Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago("anticipado")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                    metodoPago === "anticipado"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  Pago Anticipado
                </button>
              </div>
            </div>

            {/* Section: Schedule */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Programación
              </h3>
              
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border border-border bg-background py-2.5 px-4 text-sm text-left transition-colors hover:border-primary/50",
                      !fechaEntrega && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {fechaEntrega
                      ? format(fechaEntrega, "PPP", { locale: es })
                      : "Seleccionar fecha de entrega"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaEntrega}
                    onSelect={setFechaEntrega}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Section: Assignment (Admin Only) */}
            {isAdmin && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Asignación de Motorizado
                </h3>
                
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={motorizadoAsignado}
                    onChange={(e) => setMotorizadoAsignado(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Sin asignar</option>
                    {motorizados.map((m) => (
                      <option key={m.id} value={m.full_name}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creando pedido...
                </>
              ) : (
                <>
                  <Package className="h-5 w-5" />
                  Crear Pedido
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NuevoPedidoModal;

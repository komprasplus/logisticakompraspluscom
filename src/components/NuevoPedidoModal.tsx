import { useState, useEffect, useMemo } from "react";
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
  Map,
  CheckCircle,
  Calculator,
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
import { getZonaFromBarrio } from "@/lib/zonas";
import { getTarifaEnvio, calcularUtilidad, formatCOP } from "@/lib/tarifas";
import LocationPreviewMap from "./LocationPreviewMap";
import AddressAutocomplete from "./AddressAutocomplete";

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
  const [direccionCompleta, setDireccionCompleta] = useState("");
  const [barrio, setBarrio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [productoNombre, setProductoNombre] = useState("");
  const [valorRecaudar, setValorRecaudar] = useState("");
  const [valorProducto, setValorProducto] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "anticipado">("efectivo");
  const [fechaEntrega, setFechaEntrega] = useState<Date | undefined>(undefined);
  const [motorizadoAsignado, setMotorizadoAsignado] = useState("");
  
  // Location state
  const [confirmedLat, setConfirmedLat] = useState<number | null>(null);
  const [confirmedLng, setConfirmedLng] = useState<number | null>(null);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [motorizados, setMotorizados] = useState<Profile[]>([]);
  const [phoneError, setPhoneError] = useState("");

  // Calculate flete and utility based on localidad
  const tarifaInfo = useMemo(() => getTarifaEnvio(localidad), [localidad]);
  
  const utilidadCalculada = useMemo(() => {
    const recaudo = valorRecaudar ? parseFloat(valorRecaudar) : 0;
    const producto = valorProducto ? parseFloat(valorProducto) : 0;
    return calcularUtilidad(recaudo, producto, tarifaInfo.valor);
  }, [valorRecaudar, valorProducto, tarifaInfo.valor]);

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

  // Generate guide number
  const generateGuideNumber = () => {
    const prefix = "KP";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  };

  // Handle address selection from autocomplete
  const handleAddressSelect = (result: {
    direccion: string;
    barrio: string;
    localidad: string;
    ciudad: string;
    lat: number;
    lng: number;
  }) => {
    setDireccionCompleta(result.direccion);
    setBarrio(result.barrio);
    setLocalidad(result.localidad);
    setCiudad(result.ciudad);
    setConfirmedLat(result.lat);
    setConfirmedLng(result.lng);
    setAddressSelected(true);
    toast.success("Dirección seleccionada. Puedes confirmar o ajustar en el mapa.");
  };

  // Open map preview for location confirmation
  const handleOpenMapPreview = () => {
    if (!addressSelected && !direccionCompleta) {
      toast.error("Primero busca y selecciona una dirección");
      return;
    }
    setShowMapPreview(true);
  };

  // Handle confirmed location from map
  const handleLocationConfirm = (lat: number, lng: number) => {
    setConfirmedLat(lat);
    setConfirmedLng(lng);
    setShowMapPreview(false);
    toast.success("Ubicación confirmada correctamente");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone
    if (!validatePhone(clienteTelefono)) return;
    
    // Validate required fields
    if (!clienteNombre.trim() || !barrio || !productoNombre.trim()) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    // Check if location is confirmed
    if (!confirmedLat || !confirmedLng) {
      toast.error("Por favor confirma la ubicación en el mapa antes de crear el pedido");
      setShowMapPreview(true);
      return;
    }

    setLoading(true);

    try {
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
        municipio: localidad || "Bogotá",
        producto_nombre: productoNombre.trim(),
        valor_recaudar: valorRecaudar ? parseFloat(valorRecaudar) : null,
        valor_producto: valorProducto ? parseFloat(valorProducto) : null,
        valor_flete: tarifaInfo.valor,
        utilidad: utilidadCalculada,
        metodo_pago: metodoPago,
        fecha_entrega: fechaEntrega ? format(fechaEntrega, "yyyy-MM-dd") : null,
        estado: "pendiente",
        latitud: confirmedLat,
        longitud: confirmedLng,
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
    setDireccionCompleta("");
    setBarrio("");
    setLocalidad("");
    setCiudad("");
    setProductoNombre("");
    setValorRecaudar("");
    setValorProducto("");
    setMetodoPago("efectivo");
    setFechaEntrega(undefined);
    setMotorizadoAsignado("");
    setPhoneError("");
    setConfirmedLat(null);
    setConfirmedLng(null);
    setAddressSelected(false);
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
              
              {/* Nominatim Address Autocomplete */}
              <AddressAutocomplete
                onSelect={handleAddressSelect}
                placeholder="Buscar dirección, barrio o localidad..."
                value={direccionCompleta}
              />

              {/* Selected Address Info */}
              {addressSelected && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{direccionCompleta}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {barrio && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          Barrio: {barrio}
                        </span>
                      )}
                      {localidad && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {localidad}
                        </span>
                      )}
                      {ciudad && (
                        <span className="text-xs text-muted-foreground">
                          {ciudad}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Map Preview Button - REQUIRED */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={handleOpenMapPreview}
                  disabled={!addressSelected}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                    confirmedLat && confirmedLng
                      ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                      : addressSelected
                      ? "border-dashed border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
                      : "border-dashed border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Map className="h-4 w-4" />
                  {confirmedLat && confirmedLng 
                    ? "✓ Ubicación confirmada - Toca para cambiar" 
                    : addressSelected 
                    ? "Verificar y confirmar en el mapa"
                    : "Primero busca una dirección"}
                </button>
                {addressSelected && !confirmedLat && (
                  <p className="text-xs text-muted-foreground text-center">
                    La ubicación ya está preseleccionada del buscador. Puedes ajustarla en el mapa.
                  </p>
                )}
              </div>
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

              {/* Costo del producto (opcional) */}
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="Costo Producto / Proveeduría (opcional)"
                  value={valorProducto}
                  onChange={(e) => setValorProducto(e.target.value)}
                  min="0"
                  step="100"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Tarifa y cálculo automático */}
              {addressSelected && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Cálculo Automático</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Flete:</span>
                      <span className="font-medium text-foreground">{formatCOP(tarifaInfo.valor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zona:</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{tarifaInfo.etiqueta}</span>
                    </div>
                  </div>
                  {(valorRecaudar || valorProducto) && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Utilidad estimada:</span>
                        <span className={cn(
                          "font-bold",
                          utilidadCalculada >= 0 ? "text-green-600" : "text-destructive"
                        )}>
                          {formatCOP(utilidadCalculada)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              disabled={loading || !addressSelected || !confirmedLat || !confirmedLng}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all",
                addressSelected && confirmedLat && confirmedLng
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
                "disabled:opacity-50"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creando pedido...
                </>
              ) : !addressSelected ? (
                <>
                  <MapPin className="h-5 w-5" />
                  Busca y selecciona una dirección
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

      {/* Location Preview Map Modal */}
      {showMapPreview && (
        <LocationPreviewMap
          direccion={direccionCompleta}
          barrio={barrio}
          localidad={localidad || "Bogotá"}
          onConfirm={handleLocationConfirm}
          onCancel={() => setShowMapPreview(false)}
        />
      )}
    </AnimatePresence>
  );
};

export default NuevoPedidoModal;

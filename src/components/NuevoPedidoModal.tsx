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
  Building2,
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
import { getZonaFromBarrio, getZonaFromMunicipio } from "@/lib/zonas";
import { getTarifaEnvio, calcularUtilidad, formatCOP } from "@/lib/tarifas";
import LocationPreviewMapGoogle from "./LocationPreviewMapGoogle";
import GooglePlacesAutocomplete from "./GooglePlacesAutocomplete";

// Supported municipalities/cities
const MUNICIPIOS = [
  { value: "Bogotá", label: "Bogotá D.C." },
  { value: "Soacha", label: "Soacha" },
  { value: "Chía", label: "Chía" },
  { value: "Cota", label: "Cota" },
  { value: "Funza", label: "Funza" },
  { value: "Mosquera", label: "Mosquera" },
  { value: "Madrid", label: "Madrid" },
  { value: "Sibaté", label: "Sibaté" },
];

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface StoreOption {
  user_id: string;
  store_name: string | null;
  full_name: string;
  fulfillment_rate: number | null;
}

interface InventoryPrefill {
  inventoryItemId: string;
  productName: string;
  price: number;
  quantity: number;
  sku: string;
  maxStock?: number;
}

// State for current user's fulfillment rate
interface FulfillmentRateInfo {
  rate: number;
  loaded: boolean;
}

interface NuevoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin: boolean;
  inventoryPrefill?: InventoryPrefill;
}

const NuevoPedidoModal = ({
  isOpen,
  onClose,
  onSuccess,
  isAdmin,
  inventoryPrefill,
}: NuevoPedidoModalProps) => {
  // Form state - Reordered: payment method first
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "anticipado">("efectivo");
  const [valorRecaudar, setValorRecaudar] = useState("");
  
  // Client data
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  
  // Address with municipality first
  const [municipioSeleccionado, setMunicipioSeleccionado] = useState("");
  const [direccionCompleta, setDireccionCompleta] = useState("");
  const [direccionManual, setDireccionManual] = useState(""); // User's exact typed address
  const [barrio, setBarrio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [ciudad, setCiudad] = useState("");
  
  // Product
  const [productoNombre, setProductoNombre] = useState("");
  const [valorProducto, setValorProducto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  
  // Schedule
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
  
  // Admin-only state for store selection
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  
  // Fulfillment rate state - loaded from profile
  const [fulfillmentInfo, setFulfillmentInfo] = useState<FulfillmentRateInfo>({ rate: 1900, loaded: false });

  // Calculate flete and utility based on localidad/municipio
  const tarifaInfo = useMemo(() => {
    // Use selected municipality or localidad from address
    return getTarifaEnvio(localidad || municipioSeleccionado);
  }, [localidad, municipioSeleccionado]);
  
  const utilidadCalculada = useMemo(() => {
    // For "anticipado", no valor_recaudar, utility is just negative flete (internal charge)
    if (metodoPago === "anticipado") {
      const producto = valorProducto ? parseFloat(valorProducto) : 0;
      return -tarifaInfo.valor; // Freight is deducted internally
    }
    const recaudo = valorRecaudar ? parseFloat(valorRecaudar) : 0;
    const producto = valorProducto ? parseFloat(valorProducto) : 0;
    return calcularUtilidad(recaudo, producto, tarifaInfo.valor);
  }, [valorRecaudar, valorProducto, tarifaInfo.valor, metodoPago]);

  // Fetch motorizados and stores for admin selector
  useEffect(() => {
    if (isAdmin && isOpen) {
      fetchMotorizados();
      fetchStores();
    }
  }, [isAdmin, isOpen]);

  // Pre-fill from inventory when provided
  useEffect(() => {
    if (inventoryPrefill && isOpen) {
      setInventoryItemId(inventoryPrefill.inventoryItemId);
      setProductoNombre(inventoryPrefill.productName);
      setValorProducto(inventoryPrefill.price.toString());
      setQuantity(inventoryPrefill.quantity);
      // Auto-fill observaciones with product details
      const detalles = `${inventoryPrefill.productName} (SKU: ${inventoryPrefill.sku}) x${inventoryPrefill.quantity}`;
      setObservaciones(detalles);
    }
  }, [inventoryPrefill, isOpen]);

  // Update observaciones when quantity changes (for inventory orders)
  useEffect(() => {
    if (inventoryPrefill && inventoryItemId) {
      const detalles = `${inventoryPrefill.productName} (SKU: ${inventoryPrefill.sku}) x${quantity}`;
      setObservaciones(detalles);
    }
  }, [quantity, inventoryPrefill, inventoryItemId]);

  const fetchMotorizados = async () => {
    try {
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

  const fetchStores = async () => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, store_name, full_name, fulfillment_rate")
          .in("user_id", userIds)
          .eq("status", "activo");

        setStores((profiles || []) as StoreOption[]);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  // Fetch fulfillment rate for the current user (non-admin clients)
  const fetchUserFulfillmentRate = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("fulfillment_rate")
        .eq("user_id", userId)
        .maybeSingle();
      
      const rate = data?.fulfillment_rate ?? 1900;
      setFulfillmentInfo({ rate, loaded: true });
    } catch (error) {
      console.error("Error fetching fulfillment rate:", error);
      setFulfillmentInfo({ rate: 1900, loaded: true });
    }
  };

  // For admins, update fulfillment rate when store selection changes
  useEffect(() => {
    if (isAdmin && selectedStoreId) {
      const selectedStore = stores.find(s => s.user_id === selectedStoreId);
      if (selectedStore) {
        setFulfillmentInfo({ rate: selectedStore.fulfillment_rate ?? 1900, loaded: true });
      }
    }
  }, [isAdmin, selectedStoreId, stores]);

  // For clients, fetch their own fulfillment rate on mount
  useEffect(() => {
    if (!isAdmin && isOpen) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.id) {
          fetchUserFulfillmentRate(data.user.id);
        }
      });
    }
  }, [isAdmin, isOpen]);

  // Validate Colombian phone number
  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/[\s-]/g, "");
    const colombianMobile = /^3\d{9}$/;
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
    // Keep user's manual input if they've typed additional details
    const finalDireccion = direccionManual || result.direccion;
    setDireccionCompleta(finalDireccion);
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
    
    // Validate phone first
    if (!validatePhone(clienteTelefono)) return;
    
    // Specific field validation with clear error messages
    const missingFields: string[] = [];
    
    if (!clienteNombre.trim()) missingFields.push("Nombre del cliente");
    if (!clienteTelefono.trim()) missingFields.push("Teléfono WhatsApp");
    if (!municipioSeleccionado) missingFields.push("Ciudad/Municipio");
    
    // CRITICAL: direccionManual is the PRIMARY address field - validate it first
    if (!direccionManual.trim()) {
      missingFields.push("Dirección Exacta y Detalles (paso C)");
    }
    
    if (!productoNombre.trim()) missingFields.push("Nombre del producto");
    
    // For "efectivo" payment method, valor a recaudar is required
    if (metodoPago === "efectivo" && !valorRecaudar) {
      missingFields.push("Valor a Recaudar");
    }
    
    if (missingFields.length > 0) {
      toast.error(`Falta: ${missingFields.join(", ")}`);
      return;
    }

    // Location validation - if user typed manual address but didn't use map, 
    // we still need coordinates for motorizado navigation
    if (!confirmedLat || !confirmedLng) {
      // If user has direccionManual but no coordinates, prompt them to use map once
      toast.error("Por favor busca un punto de referencia en el mapa (paso B) para obtener coordenadas de navegación");
      return;
    }

    setLoading(true);

    try {
      const numeroGuia = generateGuideNumber();
      const { data: { user } } = await supabase.auth.getUser();
      // Use barrio zone if available, otherwise fall back to municipality zone
      const zona = getZonaFromBarrio(barrio) || getZonaFromMunicipio(municipioSeleccionado);

      // CRITICAL: Always use manual address + municipality for guides and motorizado view
      // This ensures nomenclature like "Calle 45 # 12-34 Apto 501" is never lost
      const direccionFinal = direccionManual.trim() 
        ? `${direccionManual.trim()}, ${municipioSeleccionado}`
        : `${direccionCompleta}, ${municipioSeleccionado}`;

      // CRITICAL: Always set client_user_id from current authenticated user
      // For clients creating their own orders, this must be set
      const currentUserId = user?.id;
      if (!isAdmin && !currentUserId) {
        toast.error("Error de sesión. Por favor vuelve a iniciar sesión.");
        setLoading(false);
        return;
      }

      const pedidoData = {
        numero_guia: numeroGuia,
        cliente_nombre: clienteNombre.trim(),
        client_phone: clienteTelefono.replace(/[\s-]/g, ""),
        direccion_entrega: direccionFinal,
        barrio: barrio,
        zona: zona,
        municipio: municipioSeleccionado,
        producto_nombre: productoNombre.trim(),
        // If "anticipado", no valor_recaudar
        valor_recaudar: metodoPago === "efectivo" && valorRecaudar ? parseFloat(valorRecaudar) : null,
        valor_producto: valorProducto ? parseFloat(valorProducto) : null,
        valor_flete: tarifaInfo.valor,
        utilidad: utilidadCalculada,
        metodo_pago: metodoPago,
        fecha_entrega: fechaEntrega ? format(fechaEntrega, "yyyy-MM-dd") : null,
        observaciones: observaciones.trim() || null,
        estado: "pendiente",
        latitud: confirmedLat,
        longitud: confirmedLng,
        motorizado_asignado: isAdmin && motorizadoAsignado ? motorizadoAsignado : null,
        client_user_id: isAdmin ? (selectedStoreId || null) : currentUserId,
        // Inventory linking
        inventory_item_id: inventoryItemId || null,
        quantity: quantity,
        // Store fulfillment cost from profile at order creation time
        fulfillment_cost: fulfillmentInfo.rate,
      };

      const { error } = await supabase.from("pedidos").insert(pedidoData);

      if (error) throw error;

      // CRITICAL: Deduct stock immediately on order creation to prevent overselling
      if (inventoryItemId && quantity > 0) {
        const { error: stockError } = await (supabase as any)
          .from("inventory")
          .update({ 
            stock_available: (supabase as any).rpc ? 
              // Ideally use RPC for atomic decrement, but fallback works
              inventoryPrefill?.maxStock ? 
                Math.max(0, (inventoryPrefill.maxStock - quantity)) : 0
              : 0
          })
          .eq("id", inventoryItemId);

        // Get current stock and update
        const { data: currentItem } = await (supabase as any)
          .from("inventory")
          .select("stock_available")
          .eq("id", inventoryItemId)
          .single();

        if (currentItem) {
          const newStock = Math.max(0, currentItem.stock_available - quantity);
          await (supabase as any)
            .from("inventory")
            .update({ stock_available: newStock })
            .eq("id", inventoryItemId);
          
          console.log(`📦 Stock deducted: ${currentItem.stock_available} → ${newStock}`);
        }
      }

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
    setMetodoPago("efectivo");
    setValorRecaudar("");
    setClienteNombre("");
    setClienteTelefono("");
    setMunicipioSeleccionado("");
    setDireccionCompleta("");
    setDireccionManual("");
    setBarrio("");
    setLocalidad("");
    setCiudad("");
    setProductoNombre("");
    setValorProducto("");
    setFechaEntrega(undefined);
    setObservaciones("");
    setMotorizadoAsignado("");
    setPhoneError("");
    setConfirmedLat(null);
    setConfirmedLng(null);
    setAddressSelected(false);
    setSelectedStoreId("");
    setInventoryItemId(null);
    setQuantity(1);
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
            
            {/* ============ SECTION 1: Payment Method (FIRST) ============ */}
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
                  onClick={() => {
                    setMetodoPago("anticipado");
                    setValorRecaudar(""); // Clear recaudo when switching to anticipado
                  }}
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

              {/* Valor a Recaudar - Only show for Contra Entrega */}
              {metodoPago === "efectivo" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative"
                >
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    placeholder="Valor a Recaudar (COP) *"
                    value={valorRecaudar}
                    onChange={(e) => setValorRecaudar(e.target.value)}
                    required={metodoPago === "efectivo"}
                    min="0"
                    step="100"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </motion.div>
              )}

              {metodoPago === "anticipado" && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  💳 El flete se cobrará internamente. No hay recaudo en la entrega.
                </p>
              )}
            </div>

            {/* ============ SECTION 2: Client Data ============ */}
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

            {/* ============ SECTION 3: Address (3 Steps) ============ */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dirección de Entrega (3 Pasos)
              </h3>
              
              {/* STEP A: Municipality Selector - REQUIRED FIRST */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
                  <span className="text-sm font-medium text-foreground">Selecciona Ciudad/Municipio</span>
                </div>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={municipioSeleccionado}
                    onChange={(e) => {
                      setMunicipioSeleccionado(e.target.value);
                      // Reset address when municipality changes
                      setDireccionCompleta("");
                      setDireccionManual("");
                      setBarrio("");
                      setLocalidad("");
                      setAddressSelected(false);
                      setConfirmedLat(null);
                      setConfirmedLng(null);
                    }}
                    required
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Selecciona Ciudad/Municipio *</option>
                    {MUNICIPIOS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STEP B: Map Search - Only after municipality */}
              {municipioSeleccionado && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      addressSelected ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"
                    )}>
                      {addressSelected ? "✓" : "B"}
                    </span>
                    <span className="text-sm font-medium text-foreground">Buscar punto en el mapa</span>
                  </div>
                  
                  <GooglePlacesAutocomplete
                    onSelect={handleAddressSelect}
                    placeholder={`Buscar barrio o referencia en ${municipioSeleccionado}...`}
                    value={direccionCompleta}
                    municipio={municipioSeleccionado}
                  />
                  
                  {addressSelected && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-700">
                        {barrio ? `${barrio}, ` : ""}{municipioSeleccionado}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP C: Manual Nomenclature - ALWAYS VISIBLE after municipality */}
              {municipioSeleccionado && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      direccionManual.trim() ? "bg-green-500 text-white" : "bg-amber-500 text-white"
                    )}>
                      {direccionManual.trim() ? "✓" : "C"}
                    </span>
                    <span className="text-sm font-medium text-foreground">Dirección Exacta y Detalles</span>
                    <span className="text-xs text-destructive font-medium">* OBLIGATORIO</span>
                  </div>
                  
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-amber-600" />
                    <textarea
                      placeholder="Ej: Calle 45 # 12-34 Apto 501, Torre A, Edificio Los Pinos"
                      value={direccionManual}
                      onChange={(e) => setDireccionManual(e.target.value)}
                      rows={2}
                      maxLength={300}
                      required
                      className={cn(
                        "w-full rounded-lg border-2 bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 resize-none",
                        !direccionManual.trim()
                          ? "border-amber-400 focus:border-amber-500 focus:ring-amber-200 bg-amber-50/50"
                          : "border-green-400 focus:border-green-500 focus:ring-green-200 bg-green-50/50"
                      )}
                    />
                  </div>
                  <div className="rounded-lg bg-amber-100 border border-amber-300 p-2">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Escribe aquí la placa, torre, apto o local exacto. Este texto aparecerá en la guía impresa y en la app del motorizado.
                    </p>
                  </div>
                </div>
              )}

              {/* Map Preview Button - REQUIRED for coordinates */}
              {municipioSeleccionado && addressSelected && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleOpenMapPreview}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                      confirmedLat && confirmedLng
                        ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                        : "border-dashed border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
                    )}
                  >
                    <Map className="h-4 w-4" />
                    {confirmedLat && confirmedLng 
                      ? "✓ Ubicación confirmada - Toca para ajustar" 
                      : "Verificar ubicación en el mapa"}
                  </button>
                  {!confirmedLat && (
                    <p className="text-xs text-muted-foreground text-center">
                      Puedes ajustar el pin si el mapa no coincide exactamente con la dirección
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ============ SECTION 4: Package ============ */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Detalles del Paquete
              </h3>
              
              {/* Inventory Quantity Selector - Only shown when product is from inventory */}
              {inventoryItemId && inventoryPrefill && (
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Producto de Inventario
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{inventoryPrefill.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">SKU: {inventoryPrefill.sku}</p>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {formatCOP(inventoryPrefill.price)} c/u
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg font-bold transition-colors",
                        quantity <= 1
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                    >
                      −
                    </button>
                    
                    <div className="text-center">
                      <span className="text-xl font-bold text-foreground">{quantity}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        / {inventoryPrefill.maxStock || "∞"} disponibles
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const max = inventoryPrefill.maxStock || 999;
                        setQuantity(Math.min(max, quantity + 1));
                      }}
                      disabled={inventoryPrefill.maxStock ? quantity >= inventoryPrefill.maxStock : false}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg font-bold transition-colors",
                        inventoryPrefill.maxStock && quantity >= inventoryPrefill.maxStock
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Total producto:</span>
                    <span className="font-bold text-foreground">
                      {formatCOP(inventoryPrefill.price * quantity)}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Producto - Only show if NOT from inventory */}
              {!inventoryItemId && (
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
              )}

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
              {(addressSelected || municipioSeleccionado) && (
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
                  {(valorRecaudar || valorProducto || metodoPago === "anticipado") && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {metodoPago === "anticipado" ? "Cobro interno:" : "Utilidad estimada:"}
                        </span>
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

              {/* Fulfillment Rate Informative Display - Read Only */}
              {fulfillmentInfo.loaded && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Truck className="h-4 w-4 text-primary" />
                      <span>Tarifa de Fulfillment aplicada:</span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {formatCOP(fulfillmentInfo.rate)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configurada por el administrador. Se aplicará a este despacho.
                  </p>
                </div>
              )}
            </div>

            {/* ============ SECTION 5: Schedule ============ */}
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
                      : "Seleccionar fecha de entrega (opcional)"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaEntrega}
                    onSelect={setFechaEntrega}
                    // REMOVED date restriction - allow same-day orders
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Puedes crear pedidos para entregar el mismo día.
              </p>
            </div>

            {/* ============ SECTION 6: Observaciones ============ */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Observaciones (Opcional)
              </h3>
              <textarea
                placeholder="Instrucciones especiales para la entrega (ej: llamar antes, timbre dañado, etc.)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-border bg-background py-2.5 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            {/* ============ SECTION 7: Assignment (Admin Only) ============ */}
            {isAdmin && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  ¿Para qué tienda es este pedido? *
                </h3>
                
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    required
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Seleccionar tienda...</option>
                    <option value="bodega">🏬 Bodega Kompras Plus (envío propio)</option>
                    {stores.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.store_name || s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

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

            {/* Submit Button - Always enabled, validation handled on submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all",
                "bg-primary text-primary-foreground hover:opacity-90",
                loading && "opacity-50 cursor-not-allowed"
              )}
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

      {/* Location Preview Map Modal */}
      {showMapPreview && (
        <LocationPreviewMapGoogle
          direccion={direccionManual || direccionCompleta}
          barrio={barrio}
          localidad={municipioSeleccionado || "Bogotá"}
          onConfirm={handleLocationConfirm}
          onCancel={() => setShowMapPreview(false)}
          initialLat={confirmedLat || undefined}
          initialLng={confirmedLng || undefined}
        />
      )}
    </AnimatePresence>
  );
};

export default NuevoPedidoModal;

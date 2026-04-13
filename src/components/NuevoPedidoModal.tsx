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
  Layers,
  Plus,
  Trash2,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

// Internal warehouse option for guarantees
const BODEGA_KOMPRAS_PLUS = {
  user_id: "bodega_kp_internal",
  store_name: "Bodega Kompras Plus",
  full_name: "Bodega Kompras Plus (Garantías)",
  fulfillment_rate: 0,
};

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
  productType?: string;
  source?: "inventory" | "marketplace";
}

// State for current user's fulfillment rate
interface FulfillmentRateInfo {
  rate: number;
  loaded: boolean;
}

// Multi-product item interface
interface OrderItem {
  id: string; // local temp id
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId: string | null;
  variantId: string | null;
  maxStock?: number;
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
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;

  // Service type: ENVIO (default) or RECOGIDA (reverse logistics)
  const [tipoServicio, setTipoServicio] = useState<"ENVIO" | "RECOGIDA">("ENVIO");

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
  
  // Product (legacy single-product - used when inventoryPrefill is provided)
  const [productoNombre, setProductoNombre] = useState("");
  const [valorProducto, setValorProducto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  
  // Variant state (for single inventory prefill)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const isVariableProduct = inventoryPrefill?.productType === 'Variable' || inventoryPrefill?.productType === 'variable';

  // ====== MULTI-PRODUCT STATE ======
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const isMultiProductMode = !inventoryPrefill; // Multi-product when NOT coming from inventory
  
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

  // ====== MULTI-PRODUCT HELPERS ======
  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      id: crypto.randomUUID(),
      productName: "",
      sku: "",
      quantity: 1,
      unitPrice: 0,
      inventoryItemId: null,
      variantId: null,
    }]);
  };

  const removeOrderItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
  };

  const updateOrderItem = (itemId: string, updates: Partial<OrderItem>) => {
    setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
  };

  // Auto-totalization for multi-product
  const totalRecaudarCalculated = useMemo(() => {
    if (!isMultiProductMode) return 0;
    return orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [orderItems, isMultiProductMode]);

  // When multi-product mode, auto-set valor_recaudar from items total
  useEffect(() => {
    if (isMultiProductMode && metodoPago === "efectivo" && orderItems.length > 0) {
      setValorRecaudar(totalRecaudarCalculated.toString());
    }
  }, [totalRecaudarCalculated, isMultiProductMode, metodoPago, orderItems.length]);

  // RECOGIDA forces valor a recaudar to 0
  useEffect(() => {
    if (tipoServicio === "RECOGIDA") {
      setValorRecaudar("0");
      setMetodoPago("efectivo");
    }
  }, [tipoServicio]);

  // Initialize with one empty item in multi-product mode
  useEffect(() => {
    if (isMultiProductMode && isOpen && orderItems.length === 0) {
      addOrderItem();
    }
  }, [isMultiProductMode, isOpen]);

  // Calculate flete and utility based on localidad/municipio
  const tarifaInfo = useMemo(() => {
    return getTarifaEnvio(localidad || municipioSeleccionado);
  }, [localidad, municipioSeleccionado]);
  
  const utilidadCalculada = useMemo(() => {
    if (metodoPago === "anticipado") {
      return -tarifaInfo.valor;
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

  // Fetch variants when product is variable
  useEffect(() => {
    if (isVariableProduct && inventoryPrefill?.inventoryItemId && isOpen) {
      const fetchVariants = async () => {
        setLoadingVariants(true);
        try {
          const { data, error } = await (supabase as any)
            .from("product_variants")
            .select("id, variant_name, sku, price, stock_available, attributes")
            .eq("product_id", inventoryPrefill.inventoryItemId)
            .eq("is_active", true)
            .order("variant_name");
          if (error) throw error;
          setVariants(data || []);
        } catch (err) {
          console.error("Error fetching variants:", err);
          setVariants([]);
        } finally {
          setLoadingVariants(false);
        }
      };
      fetchVariants();
    } else {
      setVariants([]);
      setSelectedVariantId(null);
    }
  }, [isVariableProduct, inventoryPrefill?.inventoryItemId, isOpen]);

  const fetchMotorizados = async () => {
    try {
      let roleQuery = supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");
      
      if (orgId) roleQuery = roleQuery.eq("organizacion_id", orgId);

      const { data: roleData, error: roleError } = await roleQuery;

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map((r) => r.user_id);
        let profileQuery = supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", userIds)
          .eq("status", "activo");
        
        if (orgId) profileQuery = profileQuery.eq("organizacion_id", orgId);

        const { data: profiles, error: profileError } = await profileQuery;

        if (profileError) throw profileError;
        setMotorizados(profiles || []);
      }
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  };

  const fetchStores = async () => {
    try {
      let roleQuery = supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");
      
      if (orgId) roleQuery = roleQuery.eq("organizacion_id", orgId);

      const { data: roleData } = await roleQuery;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map((r) => r.user_id);
        let profileQuery = supabase
          .from("profiles")
          .select("user_id, store_name, full_name, fulfillment_rate")
          .in("user_id", userIds)
          .eq("status", "activo");
        
        if (orgId) profileQuery = profileQuery.eq("organizacion_id", orgId);

        const { data: profiles } = await profileQuery;

        const allStores = [BODEGA_KOMPRAS_PLUS, ...(profiles || [])] as StoreOption[];
        setStores(allStores);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      setStores([BODEGA_KOMPRAS_PLUS]);
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
      if (selectedStoreId === "bodega_kp_internal") {
        setFulfillmentInfo({ rate: 0, loaded: true });
        return;
      }
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
    
    if (!direccionManual.trim()) {
      missingFields.push("Dirección Exacta y Detalles (paso C)");
    }
    
    // Multi-product validation
    if (isMultiProductMode) {
      const validItems = orderItems.filter(i => i.productName.trim());
      if (validItems.length === 0) {
        missingFields.push("Al menos un producto");
      }
    } else {
      if (!productoNombre.trim()) missingFields.push("Nombre del producto");
    }
    
    // For "efectivo" payment method, valor a recaudar is required
    if (metodoPago === "efectivo" && !valorRecaudar) {
      missingFields.push("Valor a Recaudar");
    }

    // Variable product requires variant selection
    if (isVariableProduct && inventoryItemId && !selectedVariantId) {
      missingFields.push("Variante del producto");
    }
    
    if (missingFields.length > 0) {
      toast.error(`Falta: ${missingFields.join(", ")}`);
      return;
    }

    const hasCoords = confirmedLat !== null && confirmedLng !== null;

    setLoading(true);

    try {
      const numeroGuia = generateGuideNumber();
      const { data: { user } } = await supabase.auth.getUser();
      const zona = getZonaFromBarrio(barrio) || getZonaFromMunicipio(municipioSeleccionado);

      const direccionFinal = direccionManual.trim() 
        ? `${direccionManual.trim()}, ${municipioSeleccionado}`
        : `${direccionCompleta}, ${municipioSeleccionado}`;

      const currentUserId = user?.id;
      if (!isAdmin && !currentUserId) {
        toast.error("Error de sesión. Por favor vuelve a iniciar sesión.");
        setLoading(false);
        return;
      }

      // Build product name summary for multi-product
      const validItems = isMultiProductMode ? orderItems.filter(i => i.productName.trim()) : [];
      const productNameSummary = isMultiProductMode
        ? (validItems.length === 1 
            ? validItems[0].productName 
            : `${validItems.length} artículos`)
        : productoNombre.trim();

      const totalQuantity = isMultiProductMode
        ? validItems.reduce((sum, i) => sum + i.quantity, 0)
        : quantity;

      const pedidoData = {
        numero_guia: numeroGuia,
        cliente_nombre: clienteNombre.trim(),
        client_phone: clienteTelefono.replace(/[\s-]/g, ""),
        direccion_entrega: direccionFinal,
        barrio: barrio,
        zona: zona,
        municipio: municipioSeleccionado,
        producto_nombre: productNameSummary,
        valor_recaudar: metodoPago === "efectivo" && valorRecaudar ? parseFloat(valorRecaudar) : null,
        valor_producto: valorProducto ? parseFloat(valorProducto) : (isMultiProductMode ? totalRecaudarCalculated : null),
        valor_flete: tarifaInfo.valor,
        flete_tienda: tarifaInfo.valor,
        flete_aliado: tarifaInfo.flete_aliado,
        utilidad: utilidadCalculada,
        metodo_pago: metodoPago,
        fecha_entrega: fechaEntrega ? format(fechaEntrega, "yyyy-MM-dd") : null,
        observaciones: isMultiProductMode 
          ? (observaciones.trim() || validItems.map(i => `${i.productName} x${i.quantity}`).join(", "))
          : (observaciones.trim() || null),
        estado: "pendiente",
        latitud: confirmedLat ?? null,
        longitud: confirmedLng ?? null,
        motorizado_asignado: isAdmin && motorizadoAsignado ? motorizadoAsignado : null,
        client_user_id: isAdmin 
          ? (selectedStoreId === "bodega_kp_internal" ? null : selectedStoreId || null) 
          : currentUserId,
        inventory_item_id: (inventoryPrefill?.source === "inventory" && inventoryItemId) ? inventoryItemId : null,
        variant_id: selectedVariantId || null,
        quantity: totalQuantity,
        fulfillment_cost: fulfillmentInfo.rate,
      } as any;

      // Add organizacion_id
      if (orgId) pedidoData.organizacion_id = orgId;

      const { data: newPedido, error } = await supabase.from("pedidos").insert(pedidoData).select("id").single();

      if (error) {
        console.error("Error insertando pedido:", error);
        toast.error("Error al vincular el producto. Por favor, selecciona el producto nuevamente.");
        setLoading(false);
        return;
      }

      if (!hasCoords) {
        toast.warning("Pedido creado sin coordenadas. Puedes editarlo luego para agregar ubicación.");
      }

      // ====== SAVE ORDER ITEMS ======
      if (isMultiProductMode && validItems.length > 0 && newPedido?.id) {
        const itemsToInsert = validItems.map(item => ({
          pedido_id: newPedido.id,
          product_name: item.productName.trim(),
          sku: item.sku || null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          inventory_item_id: item.inventoryItemId || null,
          variant_id: item.variantId || null,
          organizacion_id: orgId || 'a0000000-0000-0000-0000-000000000001',
        }));

        const { error: itemsError } = await (supabase as any)
          .from("order_items")
          .insert(itemsToInsert);

        if (itemsError) {
          console.warn("Error saving order items (non-blocking):", itemsError);
          toast.warning("Pedido creado, pero hubo un error guardando los ítems individuales.");
        }
      }

      // Stock decrement: variant-aware, best-effort only
      if (!isMultiProductMode) {
        if (selectedVariantId && quantity > 0) {
          try {
            const { data: variantItem, error: variantErr } = await (supabase as any)
              .from("product_variants")
              .select("stock_available")
              .eq("id", selectedVariantId)
              .maybeSingle();

            if (variantErr) throw variantErr;

            if (variantItem && typeof variantItem.stock_available === "number") {
              const newStock = Math.max(0, variantItem.stock_available - quantity);
              const { error: updateErr } = await (supabase as any)
                .from("product_variants")
                .update({ stock_available: newStock })
                .eq("id", selectedVariantId);
              if (updateErr) throw updateErr;
            }
          } catch (invErr) {
            console.warn("Variant stock update failed (non-blocking):", invErr);
            toast.warning("Pedido creado, pero no se pudo actualizar el stock de la variante.");
          }
        } else if (inventoryItemId && quantity > 0) {
          try {
            const { data: currentItem, error: currentItemErr } = await (supabase as any)
              .from("inventory")
              .select("stock_available")
              .eq("id", inventoryItemId)
              .maybeSingle();

            if (currentItemErr) throw currentItemErr;

            if (currentItem && typeof currentItem.stock_available === "number") {
              const newStock = Math.max(0, currentItem.stock_available - quantity);
              const { error: updateErr } = await (supabase as any)
                .from("inventory")
                .update({ stock_available: newStock })
                .eq("id", inventoryItemId);
              if (updateErr) throw updateErr;
            }
          } catch (invErr) {
            console.warn("Inventory stock update failed (non-blocking):", invErr);
            toast.warning("Pedido creado, pero no se pudo actualizar el inventario automáticamente.");
          }
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
    setSelectedVariantId(null);
    setVariants([]);
    setOrderItems([]);
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
                    setValorRecaudar("");
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
                    readOnly={isMultiProductMode && orderItems.length > 0}
                    className={cn(
                      "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                      isMultiProductMode && orderItems.length > 0 && "bg-muted cursor-not-allowed"
                    )}
                  />
                  {isMultiProductMode && orderItems.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Calculado automáticamente desde los productos añadidos.
                    </p>
                  )}
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
              
              {/* STEP A: Municipality Selector */}
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

              {/* STEP B: Map Search */}
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

              {/* STEP C: Manual Nomenclature */}
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

              {/* Map Preview Button */}
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

            {/* ============ SECTION 4: Package / Products ============ */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                {isMultiProductMode ? "Productos del Pedido" : "Detalles del Paquete"}
              </h3>
              
              {/* ===== MULTI-PRODUCT MODE ===== */}
              {isMultiProductMode && (
                <div className="space-y-3">
                  {orderItems.map((item, index) => (
                    <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Producto #{index + 1}
                        </span>
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOrderItem(item.id)}
                            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Quitar
                          </button>
                        )}
                      </div>
                      
                      {/* Product Name */}
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Nombre del Producto *"
                          value={item.productName}
                          onChange={(e) => updateOrderItem(item.id, { productName: e.target.value })}
                          required
                          maxLength={150}
                          className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* SKU */}
                        <input
                          type="text"
                          placeholder="SKU (opc.)"
                          value={item.sku}
                          onChange={(e) => updateOrderItem(item.id, { sku: e.target.value })}
                          maxLength={50}
                          className="rounded-lg border border-border bg-background py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {/* Quantity */}
                        <input
                          type="number"
                          placeholder="Cant."
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          min={1}
                          className="rounded-lg border border-border bg-background py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {/* Unit Price */}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input
                            type="number"
                            placeholder="Precio unit."
                            value={item.unitPrice || ""}
                            onChange={(e) => updateOrderItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            min={0}
                            step={100}
                            className="w-full rounded-lg border border-border bg-background py-2 pl-6 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>

                      {/* Line total */}
                      {item.unitPrice > 0 && (
                        <div className="flex justify-end text-xs text-muted-foreground">
                          Subtotal: <span className="font-semibold text-foreground ml-1">{formatCOP(item.unitPrice * item.quantity)}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Product Button */}
                  <button
                    type="button"
                    onClick={addOrderItem}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 p-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Producto
                  </button>

                  {/* Total Summary */}
                  {orderItems.some(i => i.unitPrice > 0) && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          Total a Recaudar ({orderItems.filter(i => i.productName.trim()).length} producto{orderItems.filter(i => i.productName.trim()).length !== 1 ? "s" : ""}):
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {formatCOP(totalRecaudarCalculated)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== SINGLE PRODUCT MODE (from inventory) ===== */}
              {!isMultiProductMode && inventoryItemId && inventoryPrefill && (
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

                  {/* Variant Selector - for variable products */}
                  {isVariableProduct && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Seleccionar Variante *</span>
                      </div>
                      {loadingVariants ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-xs text-muted-foreground">Cargando variantes...</span>
                        </div>
                      ) : variants.length === 0 ? (
                        <p className="text-xs text-destructive">No hay variantes configuradas para este producto.</p>
                      ) : (
                        <select
                          value={selectedVariantId || ""}
                          onChange={(e) => {
                            const varId = e.target.value || null;
                            setSelectedVariantId(varId);
                            if (varId) {
                              setQuantity(1);
                            }
                          }}
                          required
                          className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Seleccionar variante (Color, Talla, etc.)</option>
                          {variants.map((v: any) => {
                            const attrText = v.attributes
                              ? Object.values(v.attributes).join(" - ")
                              : v.variant_name;
                            const isOOS = v.stock_available === 0;
                            return (
                              <option key={v.id} value={v.id} disabled={isOOS}>
                                {attrText} (Stock: {v.stock_available}){isOOS ? " — Agotado" : ""}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      {selectedVariantId && (() => {
                        const sv = variants.find((v: any) => v.id === selectedVariantId);
                        if (!sv) return null;
                        return (
                          <div className="text-xs text-muted-foreground flex justify-between px-1">
                            <span>SKU variante: <span className="font-mono">{sv.sku}</span></span>
                            {sv.price && <span>Precio: {formatCOP(sv.price)}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

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
                        / {(() => {
                          if (isVariableProduct && selectedVariantId) {
                            const sv = variants.find((v: any) => v.id === selectedVariantId);
                            return sv?.stock_available ?? "∞";
                          }
                          return inventoryPrefill.maxStock || "∞";
                        })()} disponibles
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        let max = inventoryPrefill.maxStock || 999;
                        if (isVariableProduct && selectedVariantId) {
                          const sv = variants.find((v: any) => v.id === selectedVariantId);
                          max = sv?.stock_available ?? 999;
                        }
                        setQuantity(Math.min(max, quantity + 1));
                      }}
                      disabled={(() => {
                        if (isVariableProduct && selectedVariantId) {
                          const sv = variants.find((v: any) => v.id === selectedVariantId);
                          return sv ? quantity >= sv.stock_available : false;
                        }
                        return inventoryPrefill.maxStock ? quantity >= inventoryPrefill.maxStock : false;
                      })()}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg font-bold transition-colors",
                        "bg-primary/10 text-primary hover:bg-primary/20"
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
              
              {/* Producto - Only show if NOT from inventory AND NOT multi-product */}
              {!inventoryItemId && !isMultiProductMode && (
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

              {/* Costo del producto (opcional) - hide in multi-product mode */}
              {!isMultiProductMode && (
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
              )}

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

              {/* Fulfillment Rate Informative Display */}
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

            {/* Submit Button */}
            {isVariableProduct && !selectedVariantId && inventoryItemId && (
              <p className="text-xs text-destructive text-center font-medium">
                ⚠️ Debes seleccionar una variante antes de crear el pedido.
              </p>
            )}
            <button
              type="submit"
              disabled={loading || (isVariableProduct && !selectedVariantId && !!inventoryItemId)}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all",
                "bg-primary text-primary-foreground hover:opacity-90",
                (loading || (isVariableProduct && !selectedVariantId && !!inventoryItemId)) && "opacity-50 cursor-not-allowed"
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

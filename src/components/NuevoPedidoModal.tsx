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
  Banknote,
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
  RotateCcw,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  calcularUtilidad,
  formatCOP,
  getDepartamentos,
  getMunicipiosByDepartamento,
  getTarifaByDeptMunicipio,
} from "@/lib/tarifas";
import LocationPreviewMapGoogle from "./LocationPreviewMapGoogle";
import GooglePlacesAutocomplete from "./GooglePlacesAutocomplete";
import ProductSearchCombobox from "./ProductSearchCombobox";
import { getMinDeliveryDate, isNonWorkingDay } from "@/lib/colombiaHolidays";

const DEPARTAMENTOS = getDepartamentos();

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
  // Split-payments: only set when source === "marketplace"
  marketplaceProductId?: string;
  supplierUserId?: string | null;
  costPrice?: number;
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

export interface OrderToEdit {
  id: number;
  cliente_nombre?: string | null;
  client_phone?: string | null;
  direccion_entrega?: string | null;
  barrio?: string | null;
  zona?: string | null;
  municipio?: string | null;
  producto_nombre?: string | null;
  valor_recaudar?: number | null;
  valor_producto?: number | null;
  metodo_pago?: string | null;
  fecha_entrega?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  observaciones?: string | null;
  quantity?: number | null;
  motorizado_asignado?: string | null;
  inventory_item_id?: string | null;
  tipo_servicio?: string | null;
}

interface NuevoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin: boolean;
  inventoryPrefill?: InventoryPrefill;
  orderToEdit?: OrderToEdit | null;
}

const NuevoPedidoModal = ({
  isOpen,
  onClose,
  onSuccess,
  isAdmin,
  inventoryPrefill,
  orderToEdit,
}: NuevoPedidoModalProps) => {
  const isEditMode = !!orderToEdit;
  const { profile, user } = useAuth();
  const orgId = profile?.organizacion_id;

  // Service type: ENVIO (default) or RECOGIDA (reverse logistics)
  const [tipoServicio, setTipoServicio] = useState<"ENVIO" | "RECOGIDA">("ENVIO");

  // Form state - Reordered: payment method first
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "anticipado">("efectivo");
  const [valorRecaudar, setValorRecaudar] = useState("");
  
  // Client data
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  
  // Address with department -> municipality cascade
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState("");
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
  const [descripcionPaqueteRecogida, setDescripcionPaqueteRecogida] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  
  // Variant state (multi-variant: array of selected rows for the prefilled variable product)
  interface SelectedVariantRow {
    rowId: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    stockAvailable: number;
  }
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariantRow[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const isVariableProduct = inventoryPrefill?.productType === 'Variable' || inventoryPrefill?.productType === 'variable';

  // Variant row helpers
  const addVariantRow = () => {
    setSelectedVariants(prev => [...prev, {
      rowId: crypto.randomUUID(),
      variantId: null,
      quantity: 1,
      unitPrice: inventoryPrefill?.price ?? 0,
      stockAvailable: 0,
    }]);
  };

  const removeVariantRow = (rowId: string) => {
    setSelectedVariants(prev => prev.filter(r => r.rowId !== rowId));
  };

  const updateVariantRow = (rowId: string, updates: Partial<SelectedVariantRow>) => {
    setSelectedVariants(prev => prev.map(r => r.rowId === rowId ? { ...r, ...updates } : r));
  };

  // Total quantity across all selected variant rows
  const variantsTotalQuantity = useMemo(
    () => selectedVariants.filter(r => r.variantId).reduce((s, r) => s + r.quantity, 0),
    [selectedVariants]
  );

  // Subtotal (price * qty) across all selected variant rows
  const variantsSubtotal = useMemo(
    () => selectedVariants.filter(r => r.variantId).reduce((s, r) => s + r.unitPrice * r.quantity, 0),
    [selectedVariants]
  );

  // ====== MULTI-PRODUCT STATE ======
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  // User-triggered upgrade: when entering from a simple inventory prefill, allow
  // the dropshipper to convert the order into a multi-product cart.
  const [upgradedToMultiProduct, setUpgradedToMultiProduct] = useState(false);
  // Multi-product when NOT coming from inventory AND NOT editing,
  // OR when the user explicitly upgraded a simple inventory prefill.
  const isMultiProductMode = (!inventoryPrefill && !isEditMode) || upgradedToMultiProduct;
  
  // Schedule — Cut-off 14:00 + skip Sundays & Colombian holidays
  const computeDefaultDeliveryDate = () => getMinDeliveryDate();
  const [fechaEntrega, setFechaEntrega] = useState<Date | undefined>(() => computeDefaultDeliveryDate());
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

  // Determines which store's inventory the product search should query.
  // - Admins: the store selected in the assignment section (cliente.user_id)
  // - Clients: their own user_id (their own inventory)
  // - "bodega_kp_internal" (admin internal warehouse): no store inventory
  const inventoryClientUserId = isAdmin
    ? (selectedStoreId && selectedStoreId !== "bodega_kp_internal" ? selectedStoreId : null)
    : (user?.id ?? null);

  
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

  // Calculate flete and utility based on departamento + municipio
  const tarifaInfo = useMemo(() => {
    return getTarifaByDeptMunicipio(departamentoSeleccionado, municipioSeleccionado);
  }, [departamentoSeleccionado, municipioSeleccionado]);
  
  const utilidadCalculada = useMemo(() => {
    const flete = Number(tarifaInfo.valor) || 0;
    const fulfillment = Number(fulfillmentInfo.rate) || 0;
    if (metodoPago === "anticipado") {
      return -(flete + fulfillment);
    }
    const recaudo = Number(valorRecaudar) || 0;
    const costoUnitario = Number(valorProducto) || 0;
    // Use total quantity (multi-variant or single-product selector)
    const cantidadEfectiva = isVariableProduct
      ? Math.max(variantsTotalQuantity, 1)
      : (Number(quantity) || 1);
    const costoTotalProducto = costoUnitario * cantidadEfectiva;
    return recaudo - costoTotalProducto - flete - fulfillment;
  }, [valorRecaudar, valorProducto, tarifaInfo.valor, metodoPago, quantity, isVariableProduct, variantsTotalQuantity, fulfillmentInfo.rate]);

  // Fetch motorizados and stores for admin selector
  useEffect(() => {
    if (isAdmin && isOpen) {
      fetchMotorizados();
      fetchStores();
    }
  }, [isAdmin, isOpen]);

  // Pre-fill from inventory when provided.
  // CRITICAL FINANCIAL BINDING:
  //  - "Costo Producto / Proveeduría" (valorProducto) MUST come from cost_price.
  //  - "Valor a Recaudar" (valorRecaudar) is pre-filled with the suggested PVP
  //    (inventoryPrefill.price) so the dropshipper sees a starting sale price,
  //    but stays fully editable.
  useEffect(() => {
    if (inventoryPrefill && isOpen) {
      setInventoryItemId(inventoryPrefill.inventoryItemId);
      setProductoNombre(inventoryPrefill.productName);
      // Cost = supplier cost when available (marketplace), otherwise the inventory price
      // (private inventory has no separate cost field, so its `price` acts as the base).
      const costBase =
        typeof inventoryPrefill.costPrice === "number"
          ? inventoryPrefill.costPrice
          : inventoryPrefill.price;
      setValorProducto(costBase.toString());
      // Suggested PVP pre-fills the recaudo (only for cash-on-delivery)
      if (metodoPago === "efectivo") {
        setValorRecaudar(inventoryPrefill.price.toString());
      }
      setQuantity(inventoryPrefill.quantity);
      const detalles = `${inventoryPrefill.productName} (SKU: ${inventoryPrefill.sku}) x${inventoryPrefill.quantity}`;
      setObservaciones(detalles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryPrefill, isOpen]);

  // ============ EDIT MODE PRE-FILL ============
  useEffect(() => {
    if (!orderToEdit || !isOpen) return;

    setTipoServicio((orderToEdit.tipo_servicio as "ENVIO" | "RECOGIDA") || "ENVIO");
    setClienteNombre(orderToEdit.cliente_nombre || "");
    setClienteTelefono(orderToEdit.client_phone || "");

    // Resolve departamento from municipio
    const muni = orderToEdit.municipio || "";
    if (muni) {
      const allDepts = getDepartamentos();
      const foundDept = allDepts.find((d) =>
        getMunicipiosByDepartamento(d).includes(muni)
      );
      if (foundDept) setDepartamentoSeleccionado(foundDept);
      setMunicipioSeleccionado(muni);
    }

    // Strip "..., municipio, departamento" tail if present so the user sees the
    // exact street they typed originally.
    const fullAddress = orderToEdit.direccion_entrega || "";
    const cleanedAddress = muni
      ? fullAddress.replace(new RegExp(`,\\s*${muni}.*$`, "i"), "").trim()
      : fullAddress;
    setDireccionManual(cleanedAddress);
    setDireccionCompleta(fullAddress);
    setBarrio(orderToEdit.barrio || "");
    setAddressSelected(!!fullAddress);

    setProductoNombre(orderToEdit.producto_nombre || "");
    setValorProducto(
      orderToEdit.valor_producto != null ? String(orderToEdit.valor_producto) : ""
    );
    setValorRecaudar(
      orderToEdit.valor_recaudar != null ? String(orderToEdit.valor_recaudar) : ""
    );
    setMetodoPago(((orderToEdit.metodo_pago as "efectivo" | "anticipado") || "efectivo"));
    setQuantity(orderToEdit.quantity || 1);
    setInventoryItemId(orderToEdit.inventory_item_id || null);
    setObservaciones(orderToEdit.observaciones || "");
    setMotorizadoAsignado(orderToEdit.motorizado_asignado || "");

    if (orderToEdit.fecha_entrega) {
      // Parse YYYY-MM-DD locally to avoid timezone shift
      const [y, m, d] = orderToEdit.fecha_entrega.split("-").map(Number);
      if (y && m && d) setFechaEntrega(new Date(y, m - 1, d));
    }

    setConfirmedLat(orderToEdit.latitud ?? null);
    setConfirmedLng(orderToEdit.longitud ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderToEdit, isOpen]);

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
          // Auto-add first empty row when variants load (only if none yet)
          setSelectedVariants(prev => prev.length === 0 ? [{
            rowId: crypto.randomUUID(),
            variantId: null,
            quantity: 1,
            unitPrice: inventoryPrefill?.price ?? 0,
            stockAvailable: 0,
          }] : prev);
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
      setSelectedVariants([]);
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
    if (!departamentoSeleccionado) missingFields.push("Departamento");
    if (!municipioSeleccionado) missingFields.push("Ciudad/Municipio");
    
    if (!direccionManual.trim()) {
      missingFields.push("Dirección Exacta y Detalles (paso C)");
    }

    // Mandatory delivery date
    if (!fechaEntrega) {
      missingFields.push("Fecha de entrega");
    }
    
    // Multi-product validation (only for ENVIO)
    if (tipoServicio === "ENVIO") {
      if (isMultiProductMode) {
        const validItems = orderItems.filter(i => i.productName.trim());
        if (validItems.length === 0) {
          missingFields.push("Al menos un producto");
        }
      } else {
        if (!productoNombre.trim()) missingFields.push("Nombre del producto");
      }
    } else {
      // RECOGIDA requires package description
      if (!descripcionPaqueteRecogida.trim()) {
        missingFields.push("Descripción del paquete a recoger");
      }
    }
    
    // For "efectivo" payment method, valor a recaudar is required (only ENVIO)
    if (tipoServicio === "ENVIO" && metodoPago === "efectivo" && !valorRecaudar) {
      missingFields.push("Valor a Recaudar");
    }

    // Variable product requires at least one selected variant + quantities within stock
    if (isVariableProduct && inventoryItemId) {
      const validVariantRows = selectedVariants.filter(r => r.variantId);
      if (validVariantRows.length === 0) {
        missingFields.push("Al menos una variante del producto");
      } else {
        // Detect duplicate variantId selections
        const ids = validVariantRows.map(r => r.variantId);
        if (new Set(ids).size !== ids.length) {
          toast.error("No puedes seleccionar la misma variante dos veces. Aumenta la cantidad en su lugar.");
          return;
        }
        // Stock check
        for (const row of validVariantRows) {
          const v = variants.find((vv: any) => vv.id === row.variantId);
          if (v && row.quantity > v.stock_available) {
            toast.error(`Stock insuficiente para "${v.variant_name}". Disponible: ${v.stock_available}.`);
            return;
          }
        }
      }
    }
    
    // Financial floor: PVP >= (Costo Producto Total + Flete) for cash-on-delivery
    if (
      tipoServicio === "ENVIO" &&
      metodoPago === "efectivo" &&
      valorRecaudar &&
      !isMultiProductMode
    ) {
      const recaudo = Number(valorRecaudar) || 0;
      const costoUnit = Number(valorProducto) || 0;
      const cantidadEf = isVariableProduct
        ? Math.max(variantsTotalQuantity, 1)
        : (Number(quantity) || 1);
      const minimo = costoUnit * cantidadEf + (Number(tarifaInfo.valor) || 0);
      if (recaudo < minimo) {
        toast.error(
          `El Valor a Recaudar debe ser ≥ ${minimo.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })} (Costo + Flete).`
        );
        return;
      }
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
        ? `${direccionManual.trim()}, ${municipioSeleccionado}, ${departamentoSeleccionado}`
        : `${direccionCompleta}, ${municipioSeleccionado}, ${departamentoSeleccionado}`;

      const currentUserId = user?.id;
      if (!isAdmin && !currentUserId) {
        toast.error("Error de sesión. Por favor vuelve a iniciar sesión.");
        setLoading(false);
        return;
      }

      // Build product name summary for multi-product
      const validItems = isMultiProductMode ? orderItems.filter(i => i.productName.trim()) : [];
      // For variable products, concatenate selected variant labels so the order
      // detail card renders e.g. "CAMISETA 1.1 - Talla M x2, Talla L x1"
      const variantSummary = isVariableProduct
        ? selectedVariants
            .filter(r => r.variantId)
            .map(r => {
              const v = variants.find((vv: any) => vv.id === r.variantId);
              const label = v?.attributes
                ? Object.values(v.attributes).join(" - ")
                : (v?.variant_name ?? "");
              return r.quantity > 1 ? `${label} x${r.quantity}` : label;
            })
            .filter(Boolean)
            .join(", ")
        : "";
      const productNameSummary = tipoServicio === "RECOGIDA"
        ? `RECOGIDA: ${descripcionPaqueteRecogida.trim()}`
        : isMultiProductMode
          ? (validItems.length === 1 
              ? validItems[0].productName 
              : `${validItems.length} artículos`)
          : (isVariableProduct && variantSummary
              ? `${productoNombre.trim()} - ${variantSummary}`
              : productoNombre.trim());

      const totalQuantity = isMultiProductMode
        ? validItems.reduce((sum, i) => sum + i.quantity, 0)
        : quantity;

      const normalizedInventoryItemId =
        tipoServicio === "RECOGIDA"
          ? null
          : inventoryPrefill?.source === "inventory" && typeof inventoryItemId === "string" && inventoryItemId.trim()
            ? inventoryItemId
            : null;

      const pedidoData = {
        numero_guia: numeroGuia,
        cliente_nombre: clienteNombre.trim(),
        client_phone: clienteTelefono.replace(/[\s-]/g, ""),
        direccion_entrega: direccionFinal,
        barrio: barrio,
        zona: zona,
        municipio: municipioSeleccionado,
        producto_nombre: productNameSummary,
        valor_recaudar: tipoServicio === "RECOGIDA" ? 0 : (metodoPago === "efectivo" && valorRecaudar ? parseFloat(valorRecaudar) : null),
        valor_producto: valorProducto ? parseFloat(valorProducto) : (isMultiProductMode ? totalRecaudarCalculated : null),
        valor_flete: tarifaInfo.valor,
        flete_tienda: tarifaInfo.valor,
        flete_aliado: tarifaInfo.flete_aliado,
        utilidad: tipoServicio === "RECOGIDA" ? -(tarifaInfo.valor) : utilidadCalculada,
        metodo_pago: metodoPago,
        fecha_entrega: fechaEntrega ? format(fechaEntrega, "yyyy-MM-dd") : null,
        observaciones: tipoServicio === "RECOGIDA"
          ? (descripcionPaqueteRecogida.trim() + (observaciones.trim() ? ` | ${observaciones.trim()}` : ""))
          : isMultiProductMode 
            ? (observaciones.trim() || validItems.map(i => `${i.productName} x${i.quantity}`).join(", "))
            : (observaciones.trim() || null),
        estado: "pendiente",
        latitud: confirmedLat ?? null,
        longitud: confirmedLng ?? null,
        motorizado_asignado: isAdmin && motorizadoAsignado ? motorizadoAsignado : null,
        client_user_id: isAdmin 
          ? (selectedStoreId === "bodega_kp_internal" ? null : selectedStoreId || null) 
          : currentUserId,
        inventory_item_id: normalizedInventoryItemId,
        variant_id: (isVariableProduct && selectedVariants.find(r => r.variantId)?.variantId) || null,
        quantity: isVariableProduct ? Math.max(variantsTotalQuantity, 1) : totalQuantity,
        fulfillment_cost: fulfillmentInfo.rate,
        tipo_servicio: tipoServicio,
      } as any;

      if (tipoServicio === "RECOGIDA") {
        pedidoData.inventory_item_id = null;
      }

      // Add organizacion_id
      if (orgId) pedidoData.organizacion_id = orgId;

      // ===== EDIT MODE: UPDATE existing pedido =====
      if (isEditMode && orderToEdit) {
        // Strip insert-only fields
        const { numero_guia, client_user_id, organizacion_id, estado, ...updatePayload } = pedidoData;
        (updatePayload as any).fecha_actualizacion = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("pedidos")
          .update(updatePayload)
          .eq("id", orderToEdit.id);

        if (updateError) {
          console.error("Error actualizando pedido:", updateError);
          toast.error("Error al actualizar el pedido");
          setLoading(false);
          return;
        }

        toast.success(`Pedido #${orderToEdit.id} actualizado correctamente`);
        resetForm();
        onSuccess();
        onClose();
        setLoading(false);
        return;
      }

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
      if (tipoServicio === "ENVIO" && isMultiProductMode && validItems.length > 0 && newPedido?.id) {
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

      // Stock decrement: variant-aware (multi-variant), best-effort only
      if (!isMultiProductMode) {
        if (isVariableProduct && selectedVariants.some(r => r.variantId)) {
          // Multi-variant: decrement each + insert order_items row per variant
          const validRows = selectedVariants.filter(r => r.variantId);

          // Insert one order_items row per selected variant for full traceability
          if (newPedido?.id && validRows.length > 0) {
            try {
              const isFromMarketplace = inventoryPrefill?.source === "marketplace";
              const variantItemsToInsert = validRows.map(r => {
                const v = variants.find((vv: any) => vv.id === r.variantId);
                return {
                  pedido_id: newPedido.id,
                  product_name: `${inventoryPrefill?.productName ?? "Producto"} - ${v?.variant_name ?? ""}`.trim(),
                  sku: v?.sku || inventoryPrefill?.sku || null,
                  quantity: r.quantity,
                  unit_price: r.unitPrice,
                  inventory_item_id: inventoryPrefill?.inventoryItemId || null,
                  variant_id: r.variantId,
                  organizacion_id: orgId || 'a0000000-0000-0000-0000-000000000001',
                  // Split-payments snapshot (only when sourced from marketplace)
                  marketplace_product_id: isFromMarketplace ? inventoryPrefill?.marketplaceProductId ?? null : null,
                  supplier_user_id: isFromMarketplace ? inventoryPrefill?.supplierUserId ?? null : null,
                  supplier_cost_snapshot: isFromMarketplace ? inventoryPrefill?.costPrice ?? null : null,
                };
              });
              const { error: viErr } = await (supabase as any)
                .from("order_items")
                .insert(variantItemsToInsert);
              if (viErr) {
                console.warn("Error saving variant order_items (non-blocking):", viErr);
                toast.warning("Pedido creado, pero hubo un error guardando el detalle de variantes.");
              }
            } catch (e) {
              console.warn("Variant order_items insert failed:", e);
            }
          }

          // Decrement stock per variant
          for (const r of validRows) {
            try {
              const { data: variantItem, error: variantErr } = await (supabase as any)
                .from("product_variants")
                .select("stock_available")
                .eq("id", r.variantId)
                .maybeSingle();
              if (variantErr) throw variantErr;
              if (variantItem && typeof variantItem.stock_available === "number") {
                const newStock = Math.max(0, variantItem.stock_available - r.quantity);
                const { error: updateErr } = await (supabase as any)
                  .from("product_variants")
                  .update({ stock_available: newStock })
                  .eq("id", r.variantId);
                if (updateErr) throw updateErr;
              }
            } catch (invErr) {
              console.warn("Variant stock update failed (non-blocking):", invErr);
            }
          }
        } else if (inventoryItemId && quantity > 0) {
          // Single-product from marketplace: persist a row in order_items so the
          // split-payments trigger can credit the supplier on delivery.
          if (newPedido?.id && inventoryPrefill?.source === "marketplace") {
            try {
              const { error: spErr } = await (supabase as any)
                .from("order_items")
                .insert({
                  pedido_id: newPedido.id,
                  product_name: inventoryPrefill.productName,
                  sku: inventoryPrefill.sku || null,
                  quantity: quantity,
                  unit_price: inventoryPrefill.price,
                  inventory_item_id: null,
                  variant_id: null,
                  organizacion_id: orgId || 'a0000000-0000-0000-0000-000000000001',
                  marketplace_product_id: inventoryPrefill.marketplaceProductId ?? inventoryPrefill.inventoryItemId,
                  supplier_user_id: inventoryPrefill.supplierUserId ?? null,
                  supplier_cost_snapshot: inventoryPrefill.costPrice ?? null,
                });
              if (spErr) console.warn("Marketplace order_items insert failed (non-blocking):", spErr);
            } catch (e) {
              console.warn("Marketplace single order_items insert error:", e);
            }
          }
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
    setTipoServicio("ENVIO");
    setMetodoPago("efectivo");
    setValorRecaudar("");
    setClienteNombre("");
    setClienteTelefono("");
    setDepartamentoSeleccionado("");
    setMunicipioSeleccionado("");
    setDireccionCompleta("");
    setDireccionManual("");
    setBarrio("");
    setLocalidad("");
    setCiudad("");
    setProductoNombre("");
    setDescripcionPaqueteRecogida("");
    setValorProducto("");
    setFechaEntrega(computeDefaultDeliveryDate());
    setObservaciones("");
    setMotorizadoAsignado("");
    setPhoneError("");
    setConfirmedLat(null);
    setConfirmedLng(null);
    setAddressSelected(false);
    setSelectedStoreId("");
    setInventoryItemId(null);
    setQuantity(1);
    setSelectedVariants([]);
    setVariants([]);
    setOrderItems([]);
    setUpgradedToMultiProduct(false);
  };

  // Convert a single inventory-prefill order into a multi-product cart.
  // Seeds the prefilled product as item #1, then adds an empty slot for the next.
  const upgradeToMultiProduct = () => {
    if (!inventoryPrefill || isVariableProduct || inventoryPrefill.source === "marketplace") return;
    const seeded: OrderItem = {
      id: crypto.randomUUID(),
      productName: inventoryPrefill.productName,
      sku: inventoryPrefill.sku,
      quantity: quantity || 1,
      unitPrice: inventoryPrefill.price ?? 0,
      inventoryItemId: inventoryPrefill.inventoryItemId,
      variantId: null,
      maxStock: inventoryPrefill.maxStock,
    };
    const empty: OrderItem = {
      id: crypto.randomUUID(),
      productName: "",
      sku: "",
      quantity: 1,
      unitPrice: 0,
      inventoryItemId: null,
      variantId: null,
    };
    setOrderItems([seeded, empty]);
    setInventoryItemId(null); // release single-product binding
    setUpgradedToMultiProduct(true);
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
          className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col mx-4 rounded-2xl bg-card shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {isEditMode ? `✏️ Editar Pedido #${orderToEdit?.id}` : "📦 Nuevo Pedido"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isEditMode
                    ? "Modifica los datos del pedido. Los cambios se guardarán inmediatamente."
                    : "Completa los datos del cliente y del producto"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form — scrollable body + sticky footer */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Top header row: Service type + Payment method (full width) */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-3 pb-3 border-b border-border">

              {/* Tipo de Servicio segmented */}
              <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1 mx-auto md:mx-0">
                <button
                  type="button"
                  onClick={() => setTipoServicio("ENVIO")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                    tipoServicio === "ENVIO"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Truck className="w-3.5 h-3.5" /> 🚚 Envío
                </button>
                <button
                  type="button"
                  onClick={() => setTipoServicio("RECOGIDA")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                    tipoServicio === "RECOGIDA"
                      ? "bg-orange-500 text-white shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 🔄 Logística Inversa
                </button>
              </div>

              {/* Método de Pago segmented (hidden in RECOGIDA) */}
              {tipoServicio === "ENVIO" && (
                <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1 mx-auto md:mx-0">
                  <button
                    type="button"
                    onClick={() => setMetodoPago("efectivo")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                      metodoPago === "efectivo"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Banknote className="w-3.5 h-3.5" /> 💵 Contra Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMetodoPago("anticipado"); setValorRecaudar(""); }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                      metodoPago === "anticipado"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> 💳 Pago Anticipado
                  </button>
                </div>
              )}
            </div>
            {/* /Top header row */}

            {tipoServicio === "RECOGIDA" && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-600 dark:text-orange-400">
                💰 <strong>Recaudo: $0</strong> — En logística inversa no se recauda dinero. El flete se cobra internamente.
              </div>
            )}

            {/* Valor a Recaudar (full width band) */}
            {tipoServicio === "ENVIO" && metodoPago === "efectivo" && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">💵 Valor a Recaudar</h3>
                <div className="relative">
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
                </div>
                {isMultiProductMode && orderItems.length > 0 ? (
                  <p className="text-xs text-muted-foreground">💡 Calculado automáticamente desde los productos añadidos.</p>
                ) : inventoryPrefill ? (
                  <p className="text-xs text-muted-foreground">
                    ✏️ Editable. Define tu PVP final al cliente. Mínimo permitido:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCOP(
                        (Number(valorProducto) || 0) *
                          (isVariableProduct ? Math.max(variantsTotalQuantity, 1) : (Number(quantity) || 1)) +
                          (Number(tarifaInfo.valor) || 0)
                      )}
                    </span>{" "}
                    (Costo + Flete)
                  </p>
                ) : null}
              </div>
            )}

            {tipoServicio === "ENVIO" && metodoPago === "anticipado" && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💳 El flete se cobrará internamente. No hay recaudo en la entrega.
              </p>
            )}

            {/* ============ TWO COLUMN BODY ============ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ===================== LEFT COLUMN ===================== */}
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">

            {/* ============ SECTION 2: Client Data ============ */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                👤 Datos del Cliente

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
                {tipoServicio === "RECOGIDA" ? "Dirección de Recogida (Cliente) — 3 Pasos" : "Dirección de Entrega (3 Pasos)"}
              </h3>
              
              {/* STEP A: Department + Municipality cascade */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
                  <span className="text-sm font-medium text-foreground">Selecciona Departamento y Municipio</span>
                </div>

                {/* Departamento */}
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={departamentoSeleccionado}
                    onChange={(e) => {
                      setDepartamentoSeleccionado(e.target.value);
                      // Reset dependent fields
                      setMunicipioSeleccionado("");
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
                    <option value="">Selecciona Departamento *</option>
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Municipio (depends on departamento) */}
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    disabled={!departamentoSeleccionado}
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {departamentoSeleccionado
                        ? "Selecciona Municipio *"
                        : "Primero elige un departamento"}
                    </option>
                    {departamentoSeleccionado &&
                      getMunicipiosByDepartamento(departamentoSeleccionado).map((m) => (
                        <option key={m} value={m}>
                          {m}
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
            {/* /LEFT COLUMN */}
            </div>

            {/* ===================== RIGHT COLUMN ===================== */}
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">

            {/* ============ SECTION 4: Package / Products ============ */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                {tipoServicio === "RECOGIDA"
                  ? <>📦 Descripción del Paquete a Recoger</>
                  : isMultiProductMode ? <>📦 Productos del Pedido</> : <>📦 Detalles del Paquete</>}
              </h3>

              {/* ===== RECOGIDA MODE: Simple textarea ===== */}
              {tipoServicio === "RECOGIDA" && (
                <div className="space-y-2">
                  <textarea
                    placeholder="Describe el paquete a recoger (ej: Bolsa plástica sellada, Caja de zapatos, Sobre manila con documentos...)"
                    value={descripcionPaqueteRecogida}
                    onChange={(e) => setDescripcionPaqueteRecogida(e.target.value)}
                    required
                    rows={3}
                    maxLength={300}
                    className="w-full rounded-lg border-2 border-orange-400 bg-background py-2.5 px-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    📦 Describe el contenido del paquete para que el motorizado lo identifique fácilmente.
                  </p>
                </div>
              )}
              
              {/* ===== MULTI-PRODUCT MODE (ENVIO only) ===== */}
              {tipoServicio === "ENVIO" && isMultiProductMode && (
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
                      
                      {/* Product Name - Autocomplete Search */}
                      <ProductSearchCombobox
                        value={item.productName}
                        orgId={orgId}
                        clientUserId={inventoryClientUserId}
                        disabledMessage={isAdmin ? "Primero selecciona una tienda en 'Asignación'" : "Cargando tu inventario..."}
                        placeholder="Buscar producto del inventario... *"
                        onChange={(val) => updateOrderItem(item.id, { productName: val })}
                        onSelect={(product) => updateOrderItem(item.id, {
                          productName: product.productName,
                          sku: product.sku,
                          unitPrice: product.unitPrice,
                          inventoryItemId: product.inventoryItemId,
                        })}
                      />

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

              {/* ===== SINGLE PRODUCT MODE (from inventory, ENVIO only) ===== */}
              {tipoServicio === "ENVIO" && !isMultiProductMode && inventoryItemId && inventoryPrefill && (
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
                    <div className="text-right">
                      <span className="text-sm font-medium text-primary">
                        {formatCOP(
                          typeof inventoryPrefill.costPrice === "number"
                            ? inventoryPrefill.costPrice
                            : inventoryPrefill.price
                        )}{" "}
                        c/u
                      </span>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Costo base
                      </p>
                    </div>
                  </div>

                  {/* Variant Selector - MULTI-VARIANT for variable products */}
                  {isVariableProduct ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          Variantes seleccionadas *
                        </span>
                      </div>

                      {loadingVariants ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-xs text-muted-foreground">Cargando variantes...</span>
                        </div>
                      ) : variants.length === 0 ? (
                        <p className="text-xs text-destructive">No hay variantes configuradas para este producto.</p>
                      ) : (
                        <>
                          {selectedVariants.map((row, idx) => {
                            const v = variants.find((vv: any) => vv.id === row.variantId);
                            const stock = v?.stock_available ?? 0;
                            // IDs already used in OTHER rows (to disable in this row's <select>)
                            const usedElsewhere = new Set(
                              selectedVariants
                                .filter(r => r.rowId !== row.rowId && r.variantId)
                                .map(r => r.variantId as string)
                            );
                            return (
                              <div
                                key={row.rowId}
                                className="rounded-lg border border-border bg-background p-2 space-y-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-muted-foreground w-5">
                                    #{idx + 1}
                                  </span>
                                  <select
                                    value={row.variantId || ""}
                                    onChange={(e) => {
                                      const newId = e.target.value || null;
                                      const matched = variants.find((vv: any) => vv.id === newId);
                                      updateVariantRow(row.rowId, {
                                        variantId: newId,
                                        stockAvailable: matched?.stock_available ?? 0,
                                        unitPrice: matched?.price ?? inventoryPrefill?.price ?? 0,
                                        quantity: 1,
                                      });
                                    }}
                                    className="flex-1 appearance-none rounded-md border border-border bg-background py-2 px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  >
                                    <option value="">Selecciona variante...</option>
                                    {variants.map((vv: any) => {
                                      const attrText = vv.attributes
                                        ? Object.values(vv.attributes).join(" - ")
                                        : vv.variant_name;
                                      const isOOS = vv.stock_available === 0;
                                      const isUsed = usedElsewhere.has(vv.id);
                                      return (
                                        <option
                                          key={vv.id}
                                          value={vv.id}
                                          disabled={isOOS || isUsed}
                                        >
                                          {attrText} (Stock: {vv.stock_available})
                                          {isOOS ? " — Agotado" : isUsed ? " — Ya agregada" : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {selectedVariants.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeVariantRow(row.rowId)}
                                      className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                                      aria-label="Eliminar variante"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>

                                {row.variantId && (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-muted-foreground">
                                      <span className="font-mono">{v?.sku}</span>
                                      {v?.price ? (
                                        <span className="ml-2">{formatCOP(v.price)} c/u</span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateVariantRow(row.rowId, {
                                            quantity: Math.max(1, row.quantity - 1),
                                          })
                                        }
                                        disabled={row.quantity <= 1}
                                        className={cn(
                                          "flex h-7 w-7 items-center justify-center rounded-md font-bold text-sm transition-colors",
                                          row.quantity <= 1
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-primary/10 text-primary hover:bg-primary/20"
                                        )}
                                      >
                                        −
                                      </button>
                                      <span className="min-w-[2rem] text-center text-sm font-bold text-foreground">
                                        {row.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateVariantRow(row.rowId, {
                                            quantity: Math.min(stock || 999, row.quantity + 1),
                                          })
                                        }
                                        disabled={row.quantity >= stock}
                                        className={cn(
                                          "flex h-7 w-7 items-center justify-center rounded-md font-bold text-sm transition-colors",
                                          row.quantity >= stock
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-primary/10 text-primary hover:bg-primary/20"
                                        )}
                                      >
                                        +
                                      </button>
                                      <span className="text-[11px] text-muted-foreground ml-1">
                                        / {stock}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {row.variantId && (
                                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-semibold text-foreground">
                                      {formatCOP(row.unitPrice * row.quantity)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add another variant */}
                          <button
                            type="button"
                            onClick={addVariantRow}
                            disabled={selectedVariants.length >= variants.length}
                            className={cn(
                              "w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 py-2 text-xs font-medium transition-colors",
                              selectedVariants.length >= variants.length
                                ? "opacity-40 cursor-not-allowed text-muted-foreground"
                                : "text-primary hover:bg-primary/5"
                            )}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar otra variante
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    /* SIMPLE PRODUCT (no variants) — keep classic qty stepper */
                    <>
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
                          onClick={() =>
                            setQuantity(Math.min(inventoryPrefill.maxStock || 999, quantity + 1))
                          }
                          disabled={
                            inventoryPrefill.maxStock ? quantity >= inventoryPrefill.maxStock : false
                          }
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg font-bold transition-colors",
                            "bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                        >
                          +
                        </button>
                      </div>
                    </>
                  )}

                  {/* Costo base total: cost_price * qty (NOT the PVP).
                      The dropshipper sees their cost base before adding freight & margin. */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">
                      💼 Costo base
                      {isVariableProduct && variantsTotalQuantity > 0
                        ? ` (${variantsTotalQuantity} u.)`
                        : ""}:
                    </span>
                    <span className="font-bold text-foreground">
                      {formatCOP(
                        isVariableProduct
                          ? variantsSubtotal
                          : (typeof inventoryPrefill.costPrice === "number"
                              ? inventoryPrefill.costPrice
                              : inventoryPrefill.price) * quantity
                      )}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Producto - Only show if NOT from inventory AND NOT multi-product AND ENVIO */}
              {tipoServicio === "ENVIO" && !inventoryItemId && !isMultiProductMode && (
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

              {/* Costo del producto - hide in multi-product mode and RECOGIDA.
                  Locked (read-only) when product comes from the Marketplace:
                  the dropshipper cannot edit the supplier's base cost. */}
              {tipoServicio === "ENVIO" && !isMultiProductMode && (() => {
                const isFromMarketplace = inventoryPrefill?.source === "marketplace";
                return (
                  <div className="space-y-1">
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        placeholder={isFromMarketplace ? "Costo Proveeduría (fijado por proveedor)" : "Costo Producto / Proveeduría (opcional)"}
                        value={valorProducto}
                        onChange={(e) => setValorProducto(e.target.value)}
                        readOnly={isFromMarketplace}
                        disabled={isFromMarketplace}
                        min="0"
                        step="100"
                        className={cn(
                          "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                          isFromMarketplace && "cursor-not-allowed bg-muted/40 text-muted-foreground"
                        )}
                      />
                    </div>
                    {isFromMarketplace && (
                      <p className="text-[11px] text-muted-foreground pl-1">
                        🔒 Costo base definido por el proveedor. No editable.
                      </p>
                    )}
                  </div>
                );
              })()}

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
                      : "Seleccionar fecha de entrega *"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaEntrega}
                    onSelect={setFechaEntrega}
                    disabled={(date) => {
                      const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                      const minDate = getMinDeliveryDate();
                      // Disable anything before the first available working day
                      if (candidate < minDate) return true;
                      // Disable Sundays and Colombian holidays
                      if (isNonWorkingDay(candidate)) return true;
                      return false;
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Alert className="border-orange-500/40 bg-orange-500/10">
                <Clock className="h-4 w-4 text-orange-500" />
                <AlertDescription className="text-xs text-orange-700 dark:text-orange-300 ml-2">
                  Horario de corte: 2:00 PM. No laboramos domingos ni festivos. Los pedidos creados después del corte o en días no laborales se programarán para el siguiente día hábil.
                </AlertDescription>
              </Alert>
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
            {isAdmin && !isEditMode && (
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
            {isVariableProduct && inventoryItemId && !selectedVariants.some(r => r.variantId) && (
              <p className="text-xs text-destructive text-center font-medium">
                ⚠️ Debes seleccionar al menos una variante antes de crear el pedido.
              </p>
            )}
            </div>
            {/* /RIGHT COLUMN */}
            </div>
            {/* /TWO COLUMN BODY */}
            </div>
            {/* /scrollable body */}

            {/* ============ STICKY FOOTER ============ */}
            <div className="shrink-0 border-t border-border bg-card px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (isVariableProduct && !!inventoryItemId && !selectedVariants.some(r => r.variantId))
                }
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-lg",
                  "bg-primary text-primary-foreground hover:opacity-90",
                  (loading || (isVariableProduct && !!inventoryItemId && !selectedVariants.some(r => r.variantId))) && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isEditMode ? "Guardando cambios..." : "Creando pedido..."}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    {isEditMode ? "Guardar Cambios" : "Confirmar y Crear Pedido"}
                  </>
                )}
              </button>
            </div>
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

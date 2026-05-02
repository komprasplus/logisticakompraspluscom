// Order status configuration for the logistics system
export type OrderStatus = 
  | "Recibido en Bodega"
  | "Asignado"
  | "En Ruta"
  | "Entregado"
  | "Novedad"
  | "Rechazado"
  | "Devolución"
  | "Liquidado"
  | "Anulado";

 export type NovedadType =
   | "Cliente Ausente"
   | "Dirección Errada"
   | "Teléfono no Contesta"
   | "Reprogramado"
   | "Datos Incompletos"
   | "Zona de Difícil Acceso"
   | "Producto Dañado"
   | "Cliente No Quiere Recibir"
   | "Pedido Duplicado"
   | "Fuera de Cobertura";
 
 // Classification for Dropi indicators
 export type NovedadClasificacion = "Automática" | "Manual";

// Novedades that require photo evidence
export const NOVEDADES_REQUIRE_PHOTO: NovedadType[] = [
  "Cliente Ausente",
  "Dirección Errada",
];

export const ORDER_STATUS_CONFIG: Record<string, {
  color: string;
  bgColor: string;
  textColor: string;
  mapColor: string;
  icon: string;
  label: string;
}> = {
  "pendiente_confirmacion": {
    color: "#f59e0b",
    bgColor: "bg-amber-500",
    textColor: "text-white",
    mapColor: "#f59e0b",
    icon: "⏳",
    label: "Pendiente Confirmación",
  },
  "recibido en bodega": {
    color: "#6366f1",
    bgColor: "bg-indigo-500",
    textColor: "text-white",
    mapColor: "#6366f1",
    icon: "📦",
    label: "Recibido en Bodega",
  },
  "asignado": {
    color: "#3b82f6",
    bgColor: "bg-blue-500",
    textColor: "text-white",
    mapColor: "#3b82f6",
    icon: "✓",
    label: "Asignado",
  },
  "en ruta": {
    color: "#0ea5e9",
    bgColor: "bg-sky-500",
    textColor: "text-white",
    mapColor: "#0ea5e9",
    icon: "🚚",
    label: "En Ruta",
  },
  "en camino": {
    color: "#0ea5e9",
    bgColor: "bg-sky-500",
    textColor: "text-white",
    mapColor: "#0ea5e9",
    icon: "🚚",
    label: "En Camino",
  },
  "entregado": {
    color: "#22c55e",
    bgColor: "bg-green-500",
    textColor: "text-white",
    mapColor: "#22c55e",
    icon: "✅",
    label: "Entregado",
  },
  "novedad": {
    color: "#f97316",
    bgColor: "bg-orange-500",
    textColor: "text-white",
    mapColor: "#f97316",
    icon: "⚠️",
    label: "Novedad",
  },
  "rechazado": {
    color: "#ef4444",
    bgColor: "bg-red-500",
    textColor: "text-white",
    mapColor: "#ef4444",
    icon: "❌",
    label: "Rechazado",
  },
  "devolución": {
    color: "#a855f7",
    bgColor: "bg-purple-500",
    textColor: "text-white",
    mapColor: "#a855f7",
    icon: "↩️",
    label: "Devolución",
  },
  "liquidado": {
    color: "#14b8a6",
    bgColor: "bg-teal-500",
    textColor: "text-white",
    mapColor: "#14b8a6",
    icon: "💰",
    label: "Liquidado",
  },
  "anulado": {
    color: "#6b7280",
    bgColor: "bg-gray-500",
    textColor: "text-white",
    mapColor: "#6b7280",
    icon: "🚫",
    label: "Anulado",
  },
};

export const NOVEDAD_OPTIONS: { value: NovedadType; label: string; requiresPhoto: boolean }[] = [
   { value: "Cliente Ausente", label: "Cliente Ausente", requiresPhoto: true },
   { value: "Dirección Errada", label: "Dirección Errada", requiresPhoto: true },
   { value: "Teléfono no Contesta", label: "Teléfono no Contesta", requiresPhoto: false },
   { value: "Reprogramado", label: "Reprogramado", requiresPhoto: false },
   { value: "Datos Incompletos", label: "Datos Incompletos", requiresPhoto: false },
   { value: "Zona de Difícil Acceso", label: "Zona de Difícil Acceso", requiresPhoto: true },
   { value: "Producto Dañado", label: "Producto Dañado", requiresPhoto: true },
   { value: "Cliente No Quiere Recibir", label: "Cliente No Quiere Recibir", requiresPhoto: false },
   { value: "Pedido Duplicado", label: "Pedido Duplicado", requiresPhoto: false },
   { value: "Fuera de Cobertura", label: "Fuera de Cobertura", requiresPhoto: false },
];
 
 // Classify novedades as per Dropi indicators (21-32)
 export const NOVEDADES_AUTOMATICAS: NovedadType[] = [
   "Dirección Errada",
   "Datos Incompletos",
   "Zona de Difícil Acceso",
   "Fuera de Cobertura",
 ];
 
 export const NOVEDADES_MANUALES: NovedadType[] = [
   "Cliente Ausente",
   "Teléfono no Contesta",
   "Reprogramado",
   "Producto Dañado",
   "Cliente No Quiere Recibir",
   "Pedido Duplicado",
 ];
 
 export function getNovedadClasificacion(tipo: NovedadType | string | null): NovedadClasificacion | null {
   if (!tipo) return null;
   if (NOVEDADES_AUTOMATICAS.includes(tipo as NovedadType)) return "Automática";
   if (NOVEDADES_MANUALES.includes(tipo as NovedadType)) return "Manual";
   return "Manual"; // Default to manual for unknown types
 }

export const getStatusConfig = (status: string | null) => {
  if (!status) {
    return {
      color: "#9ca3af",
      bgColor: "bg-gray-400",
      textColor: "text-white",
      mapColor: "#9ca3af",
      icon: "—",
      label: "Sin estado",
    };
  }

  const normalizedStatus = status.toLowerCase();
  
  // Check for novedad with specific type
  if (normalizedStatus.includes("novedad")) {
    return ORDER_STATUS_CONFIG["novedad"];
  }

  return ORDER_STATUS_CONFIG[normalizedStatus] || {
    color: "#9ca3af",
    bgColor: "bg-gray-400",
    textColor: "text-white",
    mapColor: "#9ca3af",
    icon: "—",
    label: status,
  };
};

export const getMapMarkerColor = (status: string | null, isAssigned: boolean): string => {
  if (!isAssigned) return "#9ca3af"; // Gray for unassigned
  
  const config = getStatusConfig(status);
  return config.mapColor;
};

export const ALL_STATUSES: OrderStatus[] = [
  "Recibido en Bodega",
  "Asignado",
  "En Ruta",
  "Entregado",
  "Novedad",
  "Rechazado",
  "Devolución",
  "Liquidado",
  "Anulado",
];

// Statuses that should be excluded from operational views (map, motorizado list, metrics)
export const EXCLUDED_FROM_OPERATIONS: OrderStatus[] = ["Anulado"];

// Check if a status is operational (not cancelled/excluded)
export const isOperationalStatus = (status: string | null): boolean => {
  if (!status) return true;
  const normalizedStatus = status.toLowerCase();
  return !EXCLUDED_FROM_OPERATIONS.some(s => s.toLowerCase() === normalizedStatus);
};

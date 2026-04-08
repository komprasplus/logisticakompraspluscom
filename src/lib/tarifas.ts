// Sistema de Tarifas de Envío por Municipio
// Kompras Plus - Tarifas automáticas basadas en zona geográfica

export interface TarifaConfig {
  municipio: string;
  valor: number;
  etiqueta: string;
  flete_aliado: number;
}

// Tarifas de envío por municipio (ACTUALIZADAS con flete aliado)
// Bogotá: flete_tienda=12,000, flete_aliado=7,000
// Soacha y Sibaté: flete_tienda=15,000, flete_aliado=7,000
// Sabana: flete_tienda=18,000, flete_aliado=12,000
export const TARIFAS_ENVIO: TarifaConfig[] = [
  // Bogotá y sus localidades - $12,000 / aliado $7,000
  { municipio: "Bogotá", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Bogotá D.C.", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Usaquén", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Chapinero", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Santa Fe", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "San Cristóbal", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Usme", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Tunjuelito", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Bosa", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Kennedy", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Fontibón", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Engativá", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Suba", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Barrios Unidos", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Teusaquillo", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Los Mártires", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Antonio Nariño", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Puente Aranda", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "La Candelaria", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Rafael Uribe Uribe", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Ciudad Bolívar", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  { municipio: "Sumapaz", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
  
  // Soacha y Sibaté - $15,000 / aliado $7,000
  { municipio: "Soacha", valor: 15000, etiqueta: "Flete Zona Sur (Soacha)", flete_aliado: 7000 },
  { municipio: "Sibaté", valor: 15000, etiqueta: "Flete Zona Sur (Sibaté)", flete_aliado: 7000 },
  
  // Sabana - $18,000 / aliado $12,000
  { municipio: "Chía", valor: 18000, etiqueta: "Flete Sabana (Chía)", flete_aliado: 12000 },
  { municipio: "Cota", valor: 18000, etiqueta: "Flete Sabana (Cota)", flete_aliado: 12000 },
  { municipio: "Funza", valor: 18000, etiqueta: "Flete Sabana (Funza)", flete_aliado: 12000 },
  { municipio: "Mosquera", valor: 18000, etiqueta: "Flete Sabana (Mosquera)", flete_aliado: 12000 },
  { municipio: "Madrid", valor: 18000, etiqueta: "Flete Sabana (Madrid)", flete_aliado: 12000 },
];

// Mapa rápido para búsqueda por municipio/localidad
const TARIFA_MAP: Record<string, TarifaConfig> = {};
TARIFAS_ENVIO.forEach((tarifa) => {
  const normalizado = tarifa.municipio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  TARIFA_MAP[normalizado] = tarifa;
});

/**
 * Obtiene la tarifa de envío basada en la localidad/municipio
 */
export function getTarifaEnvio(localidad: string | null | undefined): TarifaConfig {
  const tarifaDefault: TarifaConfig = { 
    municipio: "Bogotá", 
    valor: 12000, 
    etiqueta: "Flete Bogotá",
    flete_aliado: 7000,
  };
  
  if (!localidad) return tarifaDefault;
  
  const normalizado = localidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (TARIFA_MAP[normalizado]) {
    return TARIFA_MAP[normalizado];
  }
  
  const municipiosZonaSur = ["soacha", "sibate"];
  for (const municipio of municipiosZonaSur) {
    if (normalizado.includes(municipio)) {
      return TARIFA_MAP[municipio];
    }
  }
  
  const municipiosSabana = ["chia", "cota", "funza", "mosquera", "madrid"];
  for (const municipio of municipiosSabana) {
    if (normalizado.includes(municipio)) {
      return TARIFA_MAP[municipio];
    }
  }
  
  return tarifaDefault;
}

/**
 * Calcula la utilidad de un pedido
 */
export function calcularUtilidad(
  valorRecaudar: number | null | undefined,
  valorProducto: number | null | undefined,
  valorFlete: number | null | undefined
): number {
  const recaudo = valorRecaudar || 0;
  const producto = valorProducto || 0;
  const flete = valorFlete || 0;
  
  return recaudo - producto - flete;
}

/**
 * Formatea un valor en pesos colombianos
 */
export function formatCOP(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "$0";
  return `$${valor.toLocaleString("es-CO")}`;
}

/**
 * Obtiene todas las tarifas disponibles (resumen único)
 */
export function getAllTarifas(): TarifaConfig[] {
  return [
    { municipio: "Bogotá", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
    { municipio: "Soacha/Sibaté", valor: 15000, etiqueta: "Flete Zona Sur", flete_aliado: 7000 },
    { municipio: "Chía/Cota/Funza/Mosquera/Madrid", valor: 18000, etiqueta: "Flete Sabana", flete_aliado: 12000 },
  ];
}

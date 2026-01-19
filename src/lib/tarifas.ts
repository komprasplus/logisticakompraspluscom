// Sistema de Tarifas de Envío por Municipio
// Kompras Plus - Tarifas automáticas basadas en zona geográfica

export interface TarifaConfig {
  municipio: string;
  valor: number;
  etiqueta: string;
}

// Tarifas de envío por municipio
export const TARIFAS_ENVIO: TarifaConfig[] = [
  // Bogotá y sus localidades
  { municipio: "Bogotá", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Bogotá D.C.", valor: 12000, etiqueta: "Flete Bogotá" },
  
  // Localidades de Bogotá (todas aplican tarifa Bogotá)
  { municipio: "Usaquén", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Chapinero", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Santa Fe", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "San Cristóbal", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Usme", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Tunjuelito", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Bosa", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Kennedy", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Fontibón", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Engativá", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Suba", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Barrios Unidos", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Teusaquillo", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Los Mártires", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Antonio Nariño", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Puente Aranda", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "La Candelaria", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Rafael Uribe Uribe", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Ciudad Bolívar", valor: 12000, etiqueta: "Flete Bogotá" },
  { municipio: "Sumapaz", valor: 12000, etiqueta: "Flete Bogotá" },
  
  // Soacha
  { municipio: "Soacha", valor: 15000, etiqueta: "Flete Zona Especial (Soacha)" },
  
  // Sabana Occidente
  { municipio: "Madrid", valor: 18000, etiqueta: "Flete Zona Especial (Madrid)" },
  { municipio: "Funza", valor: 18000, etiqueta: "Flete Zona Especial (Funza)" },
  { municipio: "Mosquera", valor: 18000, etiqueta: "Flete Zona Especial (Mosquera)" },
];

// Mapa rápido para búsqueda por municipio/localidad
const TARIFA_MAP: Record<string, TarifaConfig> = {};
TARIFAS_ENVIO.forEach((tarifa) => {
  // Normalizar el nombre para búsqueda
  const normalizado = tarifa.municipio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  TARIFA_MAP[normalizado] = tarifa;
});

/**
 * Obtiene la tarifa de envío basada en la localidad/municipio
 * @param localidad - Nombre de la localidad o municipio
 * @returns TarifaConfig con el valor del flete
 */
export function getTarifaEnvio(localidad: string | null | undefined): TarifaConfig {
  // Tarifa por defecto: Bogotá
  const tarifaDefault: TarifaConfig = { 
    municipio: "Bogotá", 
    valor: 12000, 
    etiqueta: "Flete Bogotá" 
  };
  
  if (!localidad) return tarifaDefault;
  
  // Normalizar el nombre para búsqueda
  const normalizado = localidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Buscar coincidencia exacta
  if (TARIFA_MAP[normalizado]) {
    return TARIFA_MAP[normalizado];
  }
  
  // Buscar coincidencia parcial para municipios especiales
  const municipiosEspeciales = ["soacha", "madrid", "funza", "mosquera"];
  for (const municipio of municipiosEspeciales) {
    if (normalizado.includes(municipio)) {
      return TARIFA_MAP[municipio];
    }
  }
  
  // Por defecto, asumir Bogotá
  return tarifaDefault;
}

/**
 * Calcula la utilidad de un pedido
 * @param valorRecaudar - Valor total a recaudar del cliente
 * @param valorProducto - Costo del producto (proveeduría)
 * @param valorFlete - Costo del flete
 * @returns Utilidad calculada
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
 * Obtiene todas las tarifas disponibles
 */
export function getAllTarifas(): TarifaConfig[] {
  // Retornar solo las tarifas únicas por valor
  const uniqueTarifas: TarifaConfig[] = [
    { municipio: "Bogotá", valor: 12000, etiqueta: "Flete Bogotá" },
    { municipio: "Soacha", valor: 15000, etiqueta: "Flete Zona Especial (Soacha)" },
    { municipio: "Madrid/Funza/Mosquera", valor: 18000, etiqueta: "Flete Zona Especial" },
  ];
  return uniqueTarifas;
}

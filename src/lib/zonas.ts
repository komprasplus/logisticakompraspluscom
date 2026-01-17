// Logistics Zoning System for Bogotá
// Zones: NOR (Norte), OCC (Occidente), CEN (Centro), SUR (Sur)

export type ZonaCodigo = "NOR" | "OCC" | "CEN" | "SUR";

export interface ZonaConfig {
  codigo: ZonaCodigo;
  nombre: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const ZONAS: Record<ZonaCodigo, ZonaConfig> = {
  NOR: {
    codigo: "NOR",
    nombre: "Norte",
    color: "#3b82f6", // blue-500
    bgColor: "bg-blue-500",
    textColor: "text-white",
  },
  OCC: {
    codigo: "OCC",
    nombre: "Occidente",
    color: "#8b5cf6", // violet-500
    bgColor: "bg-violet-500",
    textColor: "text-white",
  },
  CEN: {
    codigo: "CEN",
    nombre: "Centro",
    color: "#10b981", // emerald-500
    bgColor: "bg-emerald-500",
    textColor: "text-white",
  },
  SUR: {
    codigo: "SUR",
    nombre: "Sur",
    color: "#f59e0b", // amber-500
    bgColor: "bg-amber-500",
    textColor: "text-white",
  },
};

// Mapping of barrios to zones based on Bogotá geography
// Norte: Usaquén, Suba, parts of Chapinero
// Occidente: Engativá, Fontibón
// Centro: Chapinero, Teusaquillo, Barrios Unidos, Santa Fe, Los Mártires, Antonio Nariño, Puente Aranda
// Sur: Kennedy, Bosa, Rafael Uribe Uribe, Ciudad Bolívar, Tunjuelito, Usme, San Cristóbal

export const BARRIO_ZONA_MAP: Record<string, ZonaCodigo> = {
  // ZONA NORTE (NOR) - Usaquén, Suba
  "Usaquén Centro": "NOR",
  "Santa Bárbara": "NOR",
  "Cedritos": "NOR",
  "Country Club": "NOR",
  "La Carolina": "NOR",
  "Toberín": "NOR",
  "Barrancas": "NOR",
  "Niza": "NOR",
  "Prado Veraniego": "NOR",
  "Suba Centro": "NOR",
  "Ciudad Jardín Norte": "NOR",
  "El Rincón": "NOR",
  "Tibabuyes": "NOR",
  "Casa Blanca Suba": "NOR",
  
  // ZONA OCCIDENTE (OCC) - Engativá, Fontibón
  "Engativá Centro": "OCC",
  "Las Ferias": "OCC",
  "Minuto de Dios": "OCC",
  "Boyacá Real": "OCC",
  "Álamos Norte": "OCC",
  "Santa Helenita": "OCC",
  "Fontibón Centro": "OCC",
  "Modelia": "OCC",
  "Hayuelos": "OCC",
  "Capellanía": "OCC",
  
  // ZONA CENTRO (CEN) - Chapinero, Teusaquillo, Barrios Unidos, Santa Fe, Los Mártires, Antonio Nariño, Puente Aranda
  "Chapinero Alto": "CEN",
  "Chapinero Central": "CEN",
  "El Nogal": "CEN",
  "El Chicó": "CEN",
  "Rosales": "CEN",
  "La Cabrera": "CEN",
  "Teusaquillo Centro": "CEN",
  "Galerías": "CEN",
  "Palermo": "CEN",
  "La Esmeralda": "CEN",
  "La Soledad": "CEN",
  "Doce de Octubre": "CEN",
  "Siete de Agosto": "CEN",
  "Alcázares": "CEN",
  "San Fernando": "CEN",
  "La Candelaria": "CEN",
  "Las Nieves": "CEN",
  "La Macarena": "CEN",
  "Restrepo": "CEN",
  "Ciudad Jardín Sur": "CEN",
  "Puente Aranda Centro": "CEN",
  "Galán": "CEN",
  "Muzú": "CEN",
  "Santa Isabel": "CEN",
  "El Listón": "CEN",
  "Ricaurte": "CEN",
  
  // ZONA SUR (SUR) - Kennedy, Bosa, Rafael Uribe Uribe, Ciudad Bolívar, Tunjuelito, Usme, San Cristóbal
  "Kennedy Central": "SUR",
  "Patio Bonito": "SUR",
  "Timiza": "SUR",
  "Tintalá": "SUR",
  "Castilla": "SUR",
  "Marsella": "SUR",
  "Bosa Centro": "SUR",
  "El Recreo": "SUR",
  "San José de Bosa": "SUR",
  "Quiroga": "SUR",
  "Marco Fidel Suárez": "SUR",
  "Inglés": "SUR",
  "Ciudad Bolívar Centro": "SUR",
  "Candelaria La Nueva": "SUR",
  "El Tesoro": "SUR",
  "Tunjuelito Centro": "SUR",
  "Venecia": "SUR",
  "San Carlos": "SUR",
  "Usme Centro": "SUR",
  "Santa Librada": "SUR",
  "La Flora": "SUR",
  "San Cristóbal Centro": "SUR",
  "20 de Julio": "SUR",
  "La Victoria": "SUR",
};

/**
 * Get the zone code for a given barrio
 * Returns null if barrio is not found in the mapping
 */
export function getZonaFromBarrio(barrio: string | null | undefined): ZonaCodigo | null {
  if (!barrio) return null;
  return BARRIO_ZONA_MAP[barrio] || null;
}

/**
 * Get the zone configuration for a given zone code
 */
export function getZonaConfig(zona: ZonaCodigo | null | undefined): ZonaConfig | null {
  if (!zona) return null;
  return ZONAS[zona] || null;
}

/**
 * Get all zone codes as an array
 */
export function getAllZonas(): ZonaCodigo[] {
  return Object.keys(ZONAS) as ZonaCodigo[];
}

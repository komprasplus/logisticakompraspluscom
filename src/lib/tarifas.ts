// Sistema de Tarifas de Envío por Departamento → Municipio
// Kompras Plus - Matriz jerárquica de tarifas

export interface TarifaConfig {
  municipio: string;
  valor: number;
  etiqueta: string;
  flete_aliado: number;
  departamento?: string;
}

// ============================================================
// MATRIZ JERÁRQUICA: Departamento → Municipio → Precio (flete)
// ============================================================
export const TARIFAS_MATRIX: Record<string, Record<string, number>> = {
  "Antioquia": {
    "Medellín": 22000,
    "Bello": 22000,
    "Itagüí": 22000,
    "Envigado": 22000,
    "Sabaneta": 22000,
    "Copacabana": 22000,
  },
  "Bogotá D.C.": {
    "Bogotá, D.C.": 12000,
  },
  "Cundinamarca": {
    "Soacha": 15000,
    "Sibaté": 15000,
    "Madrid": 18000,
    "Chía": 18000,
    "Zipaquirá": 18000,
    "Funza": 18000,
    "Cota": 18000,
    "Mosquera": 18000,
    "Tocancipá": 18000,
    "Facatativá": 18000,
    "Sopó": 18000,
    "Cajicá": 18000,
  },
  "Valle del Cauca": {
    "Cali": 22000,
    "Palmira": 22000,
    "Candelaria": 22000,
    "Yumbo": 22000,
    "Jamundí": 22000,
  },
  "Magdalena": {
    "Santa Marta": 22000,
    "Ciénaga": 22000,
    "Pueblo Viejo": 22000,
    "Zona Bananera": 22000,
  },
  "Atlántico": {
    "Barranquilla": 22000,
    "Soledad": 22000,
  },
};

// Flete aliado por departamento/municipio (margen operativo 4PL)
const FLETE_ALIADO_MAP: Record<string, number> = {
  "Bogotá D.C.": 7000,
  "Antioquia": 14000,
  "Valle del Cauca": 14000,
  "Magdalena": 14000,
  "Atlántico": 14000,
};

// Flete aliado especial para Cundinamarca por municipio
const FLETE_ALIADO_CUNDINAMARCA: Record<string, number> = {
  "Soacha": 7000,
  "Sibaté": 7000,
  // resto: 12000
};

export function getDepartamentos(): string[] {
  return Object.keys(TARIFAS_MATRIX);
}

export function getMunicipiosByDepartamento(departamento: string): string[] {
  return Object.keys(TARIFAS_MATRIX[departamento] || {});
}

export function getFleteAliado(departamento: string, municipio: string): number {
  if (departamento === "Cundinamarca") {
    return FLETE_ALIADO_CUNDINAMARCA[municipio] ?? 12000;
  }
  return FLETE_ALIADO_MAP[departamento] ?? 14000;
}

/**
 * Obtiene la tarifa exacta dado un departamento + municipio
 */
export function getTarifaByDeptMunicipio(
  departamento: string | null | undefined,
  municipio: string | null | undefined
): TarifaConfig {
  const tarifaDefault: TarifaConfig = {
    municipio: "Bogotá, D.C.",
    departamento: "Bogotá D.C.",
    valor: 12000,
    etiqueta: "Flete Bogotá D.C.",
    flete_aliado: 7000,
  };

  if (!departamento || !municipio) return tarifaDefault;

  const valor = TARIFAS_MATRIX[departamento]?.[municipio];
  if (valor === undefined) return tarifaDefault;

  return {
    municipio,
    departamento,
    valor,
    etiqueta: `Flete ${departamento}`,
    flete_aliado: getFleteAliado(departamento, municipio),
  };
}

// ============================================================
// LEGACY API (compatibilidad con código existente)
// ============================================================

// Mapa rápido para búsqueda directa por nombre de municipio
const TARIFA_MAP: Record<string, TarifaConfig> = {};
Object.entries(TARIFAS_MATRIX).forEach(([dept, municipios]) => {
  Object.entries(municipios).forEach(([mun, valor]) => {
    const normalizado = mun.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    TARIFA_MAP[normalizado] = {
      municipio: mun,
      departamento: dept,
      valor,
      etiqueta: `Flete ${dept}`,
      flete_aliado: getFleteAliado(dept, mun),
    };
  });
});

/**
 * Obtiene la tarifa de envío basada en la localidad/municipio (legacy)
 */
export function getTarifaEnvio(localidad: string | null | undefined): TarifaConfig {
  const tarifaDefault: TarifaConfig = {
    municipio: "Bogotá, D.C.",
    departamento: "Bogotá D.C.",
    valor: 12000,
    etiqueta: "Flete Bogotá D.C.",
    flete_aliado: 7000,
  };

  if (!localidad) return tarifaDefault;

  const normalizado = localidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (TARIFA_MAP[normalizado]) {
    return TARIFA_MAP[normalizado];
  }

  // Match parcial
  for (const key of Object.keys(TARIFA_MAP)) {
    if (normalizado.includes(key) || key.includes(normalizado)) {
      return TARIFA_MAP[key];
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
    { municipio: "Bogotá D.C.", valor: 12000, etiqueta: "Flete Bogotá", flete_aliado: 7000 },
    { municipio: "Cundinamarca (Soacha/Sibaté)", valor: 15000, etiqueta: "Zona Sur", flete_aliado: 7000 },
    { municipio: "Cundinamarca (Sabana)", valor: 18000, etiqueta: "Sabana", flete_aliado: 12000 },
    { municipio: "Antioquia / Valle / Magdalena / Atlántico", valor: 22000, etiqueta: "Nacional", flete_aliado: 14000 },
  ];
}

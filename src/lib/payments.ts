/**
 * Métodos de pago contra-entrega (cash) en variantes comunes
 * que pueden venir desde distintos integradores (Dropi, Shopify, manual…).
 */
const CASH_PAYMENT_METHODS = new Set([
  "efectivo",
  "cod",
  "contra entrega",
  "contraentrega",
  "contra_entrega",
  "contra-entrega",
  "cash on delivery",
]);

export const isCashPayment = (
  metodoPago: string | null | undefined,
): boolean => {
  if (!metodoPago) return false;
  return CASH_PAYMENT_METHODS.has(metodoPago.toLowerCase().trim());
};

/**
 * Formato corto en pesos colombianos sin decimales.
 * "$1.234.567" estilo es-CO.
 */
export const formatCOPShort = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
};

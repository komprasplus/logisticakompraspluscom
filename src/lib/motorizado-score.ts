/**
 * Sistema de Score, Niveles y Cupos COD del Motorizado
 *
 * Niveles:
 *   Bronce   → 0-199    score · Cupo COD $200K/día
 *   Plata    → 200-499  score · Cupo COD $500K/día
 *   Oro      → 500-799  score · Cupo COD $1.5M/día
 *   Platino  → 800-999  score · Cupo COD $3M/día
 *   Diamante → 1000+    score · Cupo COD $5M/día
 *
 * Score base mientras el sistema completo entra a producción:
 *   +5 por pedido entregado
 *   -3 por pedido en novedad o anulado
 *   +1 cada semana de antigüedad
 *   +bonus 20 si está online en este momento
 *
 * Cuando esté lista la Fase 2 del roadmap, este archivo se conecta a
 * la tabla `motorizado_score_events` para calcular en backend.
 */

export type MotorizadoLevel = "bronce" | "plata" | "oro" | "platino" | "diamante";

export interface MotorizadoLevelInfo {
  level: MotorizadoLevel;
  label: string;
  copColors: {
    bg: string;
    text: string;
    border: string;
    glow: string;
  };
  minScore: number;
  maxScore: number;
  cupoCOD: number; // COP diario
  fondoGarantiaPct: number; // % retenido como fondo
  beneficios: string[];
}

export const LEVELS: Record<MotorizadoLevel, MotorizadoLevelInfo> = {
  bronce: {
    level: "bronce",
    label: "Bronce",
    copColors: {
      bg: "bg-amber-700/10",
      text: "text-amber-700",
      border: "border-amber-700/30",
      glow: "shadow-amber-700/20",
    },
    minScore: 0,
    maxScore: 199,
    cupoCOD: 200_000,
    fondoGarantiaPct: 5,
    beneficios: [
      "Acceso a pedidos básicos",
      "Cupo COD $200,000/día",
      "Soporte estándar",
    ],
  },
  plata: {
    level: "plata",
    label: "Plata",
    copColors: {
      bg: "bg-slate-400/10",
      text: "text-slate-500",
      border: "border-slate-400/40",
      glow: "shadow-slate-400/30",
    },
    minScore: 200,
    maxScore: 499,
    cupoCOD: 500_000,
    fondoGarantiaPct: 5,
    beneficios: [
      "Prioridad en asignación zonal",
      "Cupo COD $500,000/día",
      "Bonificación 5% en horas pico",
    ],
  },
  oro: {
    level: "oro",
    label: "Oro",
    copColors: {
      bg: "bg-gold/10",
      text: "text-gold-dark",
      border: "border-gold/50",
      glow: "shadow-gold/40",
    },
    minScore: 500,
    maxScore: 799,
    cupoCOD: 1_500_000,
    fondoGarantiaPct: 4,
    beneficios: [
      "Prioridad alta + pedidos premium",
      "Cupo COD $1,500,000/día",
      "Bonificación 10% horas pico",
      "Acceso a zonas exclusivas",
    ],
  },
  platino: {
    level: "platino",
    label: "Platino",
    copColors: {
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/50",
      glow: "shadow-primary/40",
    },
    minScore: 800,
    maxScore: 999,
    cupoCOD: 3_000_000,
    fondoGarantiaPct: 3,
    beneficios: [
      "Asignación prioritaria absoluta",
      "Cupo COD $3,000,000/día",
      "Bonificación 15% + bonos semanales",
      "Programa de referidos premium",
    ],
  },
  diamante: {
    level: "diamante",
    label: "Diamante",
    copColors: {
      bg: "bg-pink/10",
      text: "text-pink-dark",
      border: "border-pink/50",
      glow: "shadow-pink/40",
    },
    minScore: 1000,
    maxScore: Number.POSITIVE_INFINITY,
    cupoCOD: 5_000_000,
    fondoGarantiaPct: 2,
    beneficios: [
      "Embajador de la plataforma",
      "Cupo COD $5,000,000/día",
      "Bonificación 20% + bonos mensuales",
      "Soporte VIP 24/7",
      "Acceso a comisión por referidos",
    ],
  },
};

export const LEVEL_ORDER: MotorizadoLevel[] = ["bronce", "plata", "oro", "platino", "diamante"];

export const getLevelByScore = (score: number): MotorizadoLevelInfo => {
  if (score >= 1000) return LEVELS.diamante;
  if (score >= 800) return LEVELS.platino;
  if (score >= 500) return LEVELS.oro;
  if (score >= 200) return LEVELS.plata;
  return LEVELS.bronce;
};

export const getNextLevel = (current: MotorizadoLevel): MotorizadoLevelInfo | null => {
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx === -1 || idx === LEVEL_ORDER.length - 1) return null;
  return LEVELS[LEVEL_ORDER[idx + 1]];
};

/**
 * Calcula el score base del motorizado con los datos disponibles.
 * Esto es una aproximación interina mientras se construye la Fase 2 del roadmap.
 */
export interface ScoreInputs {
  pedidosEntregados: number;
  pedidosConNovedad: number;
  pedidosAnulados: number;
  diasAntiguedad: number;
  isOnline: boolean;
}

export const calculateScore = ({
  pedidosEntregados,
  pedidosConNovedad,
  pedidosAnulados,
  diasAntiguedad,
  isOnline,
}: ScoreInputs): number => {
  const fromDeliveries = pedidosEntregados * 5;
  const penalty = (pedidosConNovedad + pedidosAnulados) * 3;
  const fromAge = Math.floor(diasAntiguedad / 7);
  const onlineBonus = isOnline ? 20 : 0;
  return Math.max(0, fromDeliveries - penalty + fromAge + onlineBonus);
};

/**
 * Formatea pesos colombianos sin decimales.
 */
export const formatCOP = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${amount.toLocaleString("es-CO")}`;
};

export const formatCOPFull = (amount: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calcula ganancias estimadas por día de la semana basado en pedidos entregados.
 * Devuelve los últimos 7 días con el más reciente al final.
 */
export interface WeeklyEarningsDay {
  date: Date;
  label: string;
  amount: number;
  isToday: boolean;
}

export const calculateWeeklyEarnings = (
  pedidos: Array<{
    estado?: string | null;
    metodo_pago?: string | null;
    valor_recaudar?: number | null;
    fecha_entrega?: string | null;
    updated_at?: string | null;
  }>,
  commissionRate = 0.08,
): WeeklyEarningsDay[] => {
  const days: WeeklyEarningsDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ["D", "L", "M", "X", "J", "V", "S"];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push({
      date,
      label: dayLabels[date.getDay()],
      amount: 0,
      isToday: i === 0,
    });
  }

  pedidos.forEach((p) => {
    if (p.estado?.toLowerCase() !== "entregado" && p.estado?.toLowerCase() !== "pagado") return;
    const dateStr = p.fecha_entrega || p.updated_at;
    if (!dateStr) return;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const day = days.find((d) => d.date.getTime() === date.getTime());
    if (day && p.metodo_pago?.toLowerCase() === "efectivo" && p.valor_recaudar) {
      day.amount += Number(p.valor_recaudar) * commissionRate;
    }
  });

  return days;
};

/**
 * Comparación porcentual entre hoy y ayer
 */
export const compareToYesterday = (week: WeeklyEarningsDay[]): { pct: number; trend: "up" | "down" | "same" } => {
  if (week.length < 2) return { pct: 0, trend: "same" };
  const today = week[week.length - 1].amount;
  const yesterday = week[week.length - 2].amount;
  if (yesterday === 0) return { pct: today > 0 ? 100 : 0, trend: today > 0 ? "up" : "same" };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { pct: Math.abs(pct), trend: pct > 0 ? "up" : pct < 0 ? "down" : "same" };
};

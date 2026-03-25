// ============================================
// Casa Clara — Constantes del sistema
// ============================================

export const APP_NAME = 'Casa Clara';
export const APP_TAGLINE = 'Ordena el dinero de tu hogar sin pelear ni depender de Excel.';
export const CURRENCY = 'CLP';
export const TIMEZONE = 'America/Santiago';
export const LOCALE = 'es-CL';
export const MAX_HOUSEHOLD_MEMBERS = 2;

// ============================================
// Planes y precios
// ============================================
export type PlanCode = 'base' | 'plus' | 'admin';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanInfo {
  code: PlanCode;
  name: string;
  description: string;
  features: string[];
  prices: {
    monthly: number;
    yearly: number;
  };
  savings: {
    yearly: number; // ahorro anual vs mensual x 12
  };
}

export const PLANS: Record<'base' | 'plus', PlanInfo> = {
  base: {
    code: 'base',
    name: 'Esencial',
    description: 'Ordena el presente de tu hogar y recupera el control del mes.',
    features: [
      'Panel general del hogar',
      'Ingresos y gastos manuales',
      'Categorías básicas',
      'Cuentas personales y compartidas',
      'Notas en movimientos',
      'Calendario de pagos',
      'Meta de ahorro simple',
      'Resumen mensual',
      'Acceso compartido para la pareja',
    ],
    prices: {
      monthly: 2990,
      yearly: 29900,
    },
    savings: {
      yearly: 5980, // (2990 * 12) - 29900
    },
  },
  plus: {
    code: 'plus',
    name: 'Estratégico',
    description: 'Usa tus datos para anticiparte, optimizar y decidir mejor en pareja.',
    features: [
      'Todo lo de Esencial',
      'Indicador de salud financiera',
      'Proyección de cierre mensual',
      'Múltiples metas de ahorro',
      'Alertas financieras útiles',
      'Recomendaciones accionables',
      'Importación CSV',
      'Registros recurrentes',
      'Comparación mensual',
      'Cierre mensual guiado',
    ],
    prices: {
      monthly: 4990,
      yearly: 49900,
    },
    savings: {
      yearly: 9980, // (4990 * 12) - 49900
    },
  },
};

// ============================================
// Features y Feature Gating
// ============================================
export type Feature =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'split'
  | 'calendar'
  | 'goals'
  | 'monthly_review'
  | 'financial_health'
  | 'monthly_projection'
  | 'multiple_goals'
  | 'smart_alerts'
  | 'recommendations'
  | 'csv_import'
  | 'recurring'
  | 'comparison'
  | 'guided_close'
  | 'admin';

export const BASE_FEATURES: Feature[] = [
  'dashboard',
  'transactions',
  'categories',
  'split',
  'calendar',
  'goals',
  'monthly_review',
];

export const PLUS_FEATURES: Feature[] = [
  ...BASE_FEATURES,
  'financial_health',
  'monthly_projection',
  'multiple_goals',
  'smart_alerts',
  'recommendations',
  'csv_import',
  'recurring',
  'comparison',
  'guided_close',
];

export const ADMIN_FEATURES: Feature[] = [
  ...PLUS_FEATURES,
  'admin',
];

export function getAccessibleFeatures(planCode: PlanCode | null): Feature[] {
  switch (planCode) {
    case 'admin': return ADMIN_FEATURES;
    case 'plus': return PLUS_FEATURES;
    case 'base': return BASE_FEATURES;
    default: return [];
  }
}

export function hasFeatureAccess(planCode: PlanCode | null, feature: Feature): boolean {
  return getAccessibleFeatures(planCode).includes(feature);
}

// ============================================
// Estados de suscripción
// ============================================
export type SubscriptionStatus = 'active' | 'pending' | 'cancelled' | 'expired' | 'failed' | 'inactive';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  failed: 'Pago fallido',
  inactive: 'Inactiva',
};

export interface SubscriptionCTA {
  message: string;
  action: string;
  route: string;
}

export function getSubscriptionCTA(status: SubscriptionStatus | null): SubscriptionCTA {
  switch (status) {
    case 'active':
      return { message: '', action: '', route: '' };
    case 'pending':
      return {
        message: 'Tu pago está pendiente de confirmación.',
        action: 'Completar pago',
        route: '/app/suscripcion',
      };
    case 'cancelled':
      return {
        message: 'Tu suscripción fue cancelada. Reactiva tu plan para seguir usando Casa Clara.',
        action: 'Reactivar plan',
        route: '/app/suscripcion',
      };
    case 'expired':
      return {
        message: 'Tu suscripción ha expirado. Renueva para seguir ordenando tu hogar.',
        action: 'Renovar plan',
        route: '/app/suscripcion',
      };
    case 'failed':
      return {
        message: 'El último cobro falló. Actualiza tu método de pago.',
        action: 'Actualizar pago',
        route: '/app/suscripcion',
      };
    case 'inactive':
      return {
        message: 'Tu suscripción está inactiva. Contrata un plan para usar Casa Clara.',
        action: 'Contratar plan',
        route: '/app/suscripcion',
      };
    default:
      return {
        message: 'Elige un plan para comenzar a ordenar tu hogar.',
        action: 'Elegir plan',
        route: '/app/suscripcion',
      };
  }
}

// ============================================
// Categorías por defecto (hogar chileno)
// ============================================
export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Supermercado', icon: '🛒', color: '#059669' },
  { name: 'Vivienda', icon: '🏠', color: '#2563EB' },
  { name: 'Servicios básicos', icon: '💡', color: '#D97706' },
  { name: 'Transporte', icon: '🚗', color: '#7C3AED' },
  { name: 'Salud', icon: '❤️', color: '#DC2626' },
  { name: 'Educación', icon: '📚', color: '#0891B2' },
  { name: 'Ocio', icon: '🎬', color: '#DB2777' },
  { name: 'Suscripciones', icon: '📱', color: '#6366F1' },
  { name: 'Mascotas', icon: '🐾', color: '#EA580C' },
  { name: 'Ahorro', icon: '💰', color: '#16A34A' },
  { name: 'Otros', icon: '📦', color: '#6B7280' },
];

// ============================================
// Reglas de reparto
// ============================================
export type SplitRuleType = 'fifty_fifty' | 'proportional' | 'fixed_amount' | 'custom_percent';

export const SPLIT_RULE_LABELS: Record<SplitRuleType, string> = {
  fifty_fifty: '50/50',
  proportional: 'Proporcional a ingresos',
  fixed_amount: 'Monto fijo',
  custom_percent: 'Porcentaje personalizado',
};

export const SPLIT_RULE_DESCRIPTIONS: Record<SplitRuleType, string> = {
  fifty_fifty: 'Cada miembro aporta la mitad de los gastos compartidos.',
  proportional: 'El aporte se calcula en proporción al ingreso de cada miembro.',
  fixed_amount: 'Cada miembro aporta un monto fijo mensual al gasto compartido.',
  custom_percent: 'Tú defines qué porcentaje aporta cada miembro.',
};

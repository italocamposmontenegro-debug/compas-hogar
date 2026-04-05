// ============================================
// Casa Clara — Constantes del sistema
// ============================================

import type { SubscriptionStatus } from './plans';

export const APP_NAME = 'Compás Hogar';
export const APP_TAGLINE = 'Gestión financiera para tu hogar.';
export const CURRENCY = 'CLP';
export const TIMEZONE = 'America/Santiago';
export const LOCALE = 'es-CL';
export const MAX_HOUSEHOLD_MEMBERS = 2;
export {
  COMMERCIAL_PLAN_INFO,
  COMMERCIAL_PLAN_ORDER,
  PUBLIC_PLAN_INFO,
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_TIER_ORDER,
  canCreateGoal,
  getFeatureRequiredPlan,
  getCommercialPlanInfo,
  getFeatureUpgradeCopy,
  getPlanCapabilities,
  getPlanDescription,
  getPlanMaxGoals,
  getPlanMaxMembers,
  getPlanName,
  getPlanPromise,
  getPlanRank,
  getUpgradePlanForFeature,
  hasFeature,
  isPlanAtLeast,
  mapTierToCommercialPlan,
  mapBillingPlanCodeToTier,
  resolvePlanTier,
  type BillingCycle,
  type BillingPlanCode,
  type CommercialPlanInfo,
  type CommercialPlanTier,
  type FeatureKey,
  type PlanTier,
  type PublicPlanInfo,
  type SubscriptionStatus,
} from './plans';

// ============================================
// Estados de suscripción
// ============================================
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
        message: `Tu suscripción fue cancelada. Reactiva tu plan para seguir usando ${APP_NAME}.`,
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
        message: `Tu suscripción está inactiva. Contrata un plan para usar ${APP_NAME}.`,
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
  { name: 'Agua', icon: '🚰', color: '#0F766E' },
  { name: 'Luz', icon: '💡', color: '#D97706' },
  { name: 'Gas', icon: '🔥', color: '#DC2626' },
  { name: 'Internet', icon: '📶', color: '#2563EB' },
  { name: 'Telefonía móvil', icon: '📱', color: '#4F46E5' },
  { name: 'TV / Streaming / suscripciones esenciales', icon: '📺', color: '#7C3AED' },
  { name: 'TAG / Autopistas', icon: '🛣️', color: '#0EA5E9' },
  { name: 'Arriendo / Dividendo', icon: '🏠', color: '#1D4ED8' },
  { name: 'Gastos comunes', icon: '🏢', color: '#7C3AED' },
  { name: 'Seguros', icon: '🛡️', color: '#1D4ED8' },
  { name: 'Créditos / Tarjetas / Cuotas', icon: '💳', color: '#B45309' },
  { name: 'Educación', icon: '📚', color: '#0284C7' },
  { name: 'Salud fija', icon: '🩺', color: '#DC2626' },
  { name: 'Otros pagos obligatorios', icon: '🧾', color: '#6B7280' },
  { name: 'Alimentación', icon: '🍽️', color: '#16A34A' },
  { name: 'Supermercado', icon: '🛒', color: '#059669' },
  { name: 'Transporte / Locomoción', icon: '🚌', color: '#0891B2' },
  { name: 'Bencina', icon: '⛽', color: '#0F766E' },
  { name: 'Farmacia / Remedios', icon: '💊', color: '#DB2777' },
  { name: 'Salud variable', icon: '💟', color: '#EC4899' },
  { name: 'Compras del hogar', icon: '🧺', color: '#64748B' },
  { name: 'Ocio', icon: '🎉', color: '#A21CAF' },
  { name: 'Salidas', icon: '🍷', color: '#9333EA' },
  { name: 'Mascotas', icon: '🐾', color: '#EA580C' },
  { name: 'Imprevistos', icon: '⚠️', color: '#EF4444' },
  { name: 'Ahorro libre', icon: '💰', color: '#16A34A' },
  { name: 'Fondo de emergencia', icon: '🛟', color: '#0EA5E9' },
  { name: 'Meta del hogar', icon: '🎯', color: '#0F766E' },
  { name: 'Inversión', icon: '📈', color: '#15803D' },
  { name: 'Otros gastos variables', icon: '📦', color: '#6B7280' },
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

// ============================================
// Tooltips de métricas
// ============================================
export const METRIC_TOOLTIPS: Record<string, string> = {
  monthly_income: 'Total de ingresos confirmados para este mes.',
  monthly_balance: 'Dinero disponible después de gastos y metas.',
  monthly_spending: 'Suma de gastos registrados hasta hoy.',
  monthly_savings: 'Monto destinado a tus metas este mes.',
  household_goals: 'Progreso promedio hacia tus objetivos.',
  pending_payments: 'Cuentas o compromisos por cerrar.',
};

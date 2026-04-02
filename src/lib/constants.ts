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

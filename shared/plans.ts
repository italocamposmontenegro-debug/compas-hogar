export type PlanTier = 'free' | 'essential' | 'strategic';
export type BillingPlanCode = 'base' | 'plus' | 'admin';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'pending' | 'cancelled' | 'expired' | 'failed' | 'inactive';
export type CommercialPlanTier = 'free' | 'premium';

export type FeatureKey =
  | 'dashboard_basic'
  | 'dashboard_full'
  | 'transactions_manual'
  | 'transactions_edit_delete'
  | 'categories_system'
  | 'categories_custom'
  | 'budget_general'
  | 'budget_by_category'
  | 'goals_single'
  | 'goals_multiple'
  | 'calendar_basic'
  | 'calendar_full'
  | 'split_manual'
  | 'monthly_summary_basic'
  | 'monthly_summary_full'
  | 'monthly_close_simple'
  | 'export_basic'
  | 'export_advanced'
  | 'recurring_transactions'
  | 'csv_import'
  | 'monthly_comparison'
  | 'monthly_projection'
  | 'smart_alerts'
  | 'recommendations'
  | 'guided_close_advanced'
  | 'insights_financial_health';

export type PlanFeatureMatrix = Record<PlanTier, Record<FeatureKey, boolean>>;

export const PLAN_FEATURES: PlanFeatureMatrix = {
  free: {
    dashboard_basic: true,
    dashboard_full: false,
    transactions_manual: true,
    transactions_edit_delete: true,
    categories_system: true,
    categories_custom: false,
    budget_general: true,
    budget_by_category: false,
    goals_single: true,
    goals_multiple: false,
    calendar_basic: true,
    calendar_full: false,
    split_manual: false,
    monthly_summary_basic: true,
    monthly_summary_full: false,
    monthly_close_simple: false,
    export_basic: false,
    export_advanced: false,
    recurring_transactions: false,
    csv_import: false,
    monthly_comparison: false,
    monthly_projection: false,
    smart_alerts: false,
    recommendations: false,
    guided_close_advanced: false,
    insights_financial_health: false,
  },
  essential: {
    dashboard_basic: true,
    dashboard_full: true,
    transactions_manual: true,
    transactions_edit_delete: true,
    categories_system: true,
    categories_custom: true,
    budget_general: true,
    budget_by_category: true,
    goals_single: true,
    goals_multiple: true,
    calendar_basic: true,
    calendar_full: true,
    split_manual: true,
    monthly_summary_basic: true,
    monthly_summary_full: true,
    monthly_close_simple: true,
    export_basic: true,
    export_advanced: false,
    recurring_transactions: false,
    csv_import: false,
    monthly_comparison: false,
    monthly_projection: false,
    smart_alerts: false,
    recommendations: false,
    guided_close_advanced: false,
    insights_financial_health: false,
  },
  strategic: {
    dashboard_basic: true,
    dashboard_full: true,
    transactions_manual: true,
    transactions_edit_delete: true,
    categories_system: true,
    categories_custom: true,
    budget_general: true,
    budget_by_category: true,
    goals_single: true,
    goals_multiple: true,
    calendar_basic: true,
    calendar_full: true,
    split_manual: true,
    monthly_summary_basic: true,
    monthly_summary_full: true,
    monthly_close_simple: true,
    export_basic: true,
    export_advanced: true,
    recurring_transactions: true,
    csv_import: true,
    monthly_comparison: true,
    monthly_projection: true,
    smart_alerts: true,
    recommendations: true,
    guided_close_advanced: true,
    insights_financial_health: true,
  },
};

export interface PlanLimits {
  maxGoals: number | null;
  maxMembers: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxGoals: 1,
    maxMembers: 2,
  },
  essential: {
    maxGoals: null,
    maxMembers: 2,
  },
  strategic: {
    maxGoals: null,
    maxMembers: 2,
  },
};

export interface PublicPlanInfo {
  tier: PlanTier;
  billingPlanCode: Exclude<BillingPlanCode, 'admin'> | null;
  name: string;
  promise: string;
  description: string;
  featureHighlights: string[];
  prices: {
    monthly: number | null;
    yearly: number | null;
  };
  savings: {
    yearly: number;
  };
}

export interface CommercialPlanInfo {
  tier: CommercialPlanTier;
  billingPlanCode: Exclude<BillingPlanCode, 'admin'> | null;
  name: string;
  promise: string;
  description: string;
  featureHighlights: string[];
  prices: {
    monthly: number | null;
    yearly: number | null;
  };
  savings: {
    yearly: number;
  };
}

interface FeatureUpgradeContent {
  title: string;
  description: string;
  highlights: string[];
}

export const PUBLIC_PLAN_INFO: Record<PlanTier, PublicPlanInfo> = {
  free: {
    tier: 'free',
    billingPlanCode: null,
    name: 'Free',
    promise: 'Lectura básica del mes',
    description: 'Empieza a ordenar tu hogar sin fricción.',
    featureHighlights: [
      'Movimientos manuales',
      '1 meta visible',
      'Referencia compartida',
    ],
    prices: { monthly: null, yearly: null },
    savings: { yearly: 0 },
  },
  essential: {
    tier: 'essential',
    billingPlanCode: 'base',
    name: 'Esencial',
    promise: 'Orden operativo real',
    description: 'Categorías propias, reparto y metas múltiples para el día a día.',
    featureHighlights: [
      'Categorías personalizadas',
      'Múltiples metas',
      'Reglas de reparto',
    ],
    prices: { monthly: 2990, yearly: 29900 },
    savings: { yearly: 5980 },
  },
  strategic: {
    tier: 'strategic',
    billingPlanCode: 'plus',
    name: 'Estratégico',
    promise: 'Visión y anticipación',
    description: 'Proyección, alertas y análisis para decidir con criterio.',
    featureHighlights: [
      'Recurrencias e importación',
      'Proyección y alertas',
      'Comparación mensual',
    ],
    prices: { monthly: 4990, yearly: 49900 },
    savings: { yearly: 9980 },
  },
};

export const COMMERCIAL_PLAN_INFO: Record<CommercialPlanTier, CommercialPlanInfo> = {
  free: {
    tier: 'free',
    billingPlanCode: null,
    name: 'Free',
    promise: 'Lectura básica del mes',
    description: 'Empieza a ordenar tu hogar sin fricción.',
    featureHighlights: [
      'Movimientos manuales',
      '1 meta visible',
      'Referencia compartida',
    ],
    prices: { monthly: null, yearly: null },
    savings: { yearly: 0 },
  },
  premium: {
    tier: 'premium',
    billingPlanCode: 'plus',
    name: 'Premium',
    promise: 'Más claridad para decidir y anticiparte a tiempo.',
    description: 'Una capa pagada única para ordenar mejor el mes y sumar visión cuando el hogar lo necesite.',
    featureHighlights: [
      'Categorías personalizadas y múltiples metas',
      'Calendario completo y seguimiento compartido',
      'Recurrencias, proyección, alertas e importación',
    ],
    prices: { monthly: 4990, yearly: 49900 },
    savings: { yearly: 9980 },
  },
};

const FEATURE_UPGRADE_CONTENT: Record<FeatureKey, FeatureUpgradeContent> = {
  dashboard_basic: {
    title: 'Panel básico',
    description: 'Visualiza los números esenciales del mes.',
    highlights: ['Saldo actual', 'Ingresos y gastos', 'Cuentas abiertas'],
  },
  dashboard_full: {
    title: 'Panel completo',
    description: 'Obtén una lectura útil para decidir el mes.',
    highlights: ['Vista por categorías', 'Aportes compartidos', 'Balance detallado'],
  },
  transactions_manual: {
    title: 'Registro manual',
    description: 'Ordena el hogar registrando cada movimiento.',
    highlights: ['Ingresos', 'Gastos', 'Historial'],
  },
  transactions_edit_delete: {
    title: 'Edición de movimientos',
    description: 'Corrige errores y mantén tus números al día.',
    highlights: ['Editar montos', 'Limpiar duplicados', 'Trazabilidad'],
  },
  categories_system: {
    title: 'Categorías base',
    description: 'Ordena lo esencial sin configurar nada.',
    highlights: ['Listas para usar', 'Orden inmediato', 'Criterio simple'],
  },
  categories_custom: {
    title: 'Categorías propias',
    description: 'Organiza el mes según las necesidades reales de tu hogar.',
    highlights: ['Crear categorías', 'Mejor clasificación', 'Cierre claro'],
  },
  budget_general: {
    title: 'Presupuesto general',
    description: 'Controla el flujo mensual sin complicaciones.',
    highlights: ['Visión mensual', 'Control rápido', 'Lectura simple'],
  },
  budget_by_category: {
    title: 'Presupuesto por categoría',
    description: 'Controla el gasto donde más se dispersa el dinero.',
    highlights: ['Topes de gasto', 'Seguimiento fino', 'Decisiones concretas'],
  },
  goals_single: {
    title: 'Meta principal',
    description: 'Empieza con un objetivo claro para crear hábito.',
    highlights: ['1 meta activa', 'Progreso visible', 'Seguimiento simple'],
  },
  goals_multiple: {
    title: 'Múltiples metas',
    description: 'Trabaja varios objetivos sin perder el foco del mes.',
    highlights: ['Múltiples ahorros', 'Prioridades claras', 'Visión realista'],
  },
  calendar_basic: {
    title: 'Calendario básico',
    description: 'Revisa vencimientos y evita olvidos del mes.',
    highlights: ['Fechas de pago', 'Estado básico', 'Control rápido'],
  },
  calendar_full: {
    title: 'Calendario completo',
    description: 'Gestiona pagos programados con seguimiento total.',
    highlights: ['Pagos automáticos', 'Editar fechas', 'Frecuencias'],
  },
  split_manual: {
    title: 'Reglas de reparto',
    description: 'Define cómo se dividen los gastos sin dudas.',
    highlights: ['Reparto justo', 'Quién pagó qué', 'Aportes claros'],
  },
  monthly_summary_basic: {
    title: 'Resumen simple',
    description: 'Cierra el mes con una lectura rápida.',
    highlights: ['Totales', 'Diferencias', 'Lectura ágil'],
  },
  monthly_summary_full: {
    title: 'Resumen completo',
    description: 'Entiende cómo cerró el mes y dónde estuvo la presión.',
    highlights: ['Detalle por categoría', 'Balance útil', 'Aprendizaje'],
  },
  monthly_close_simple: {
    title: 'Cierre de mes',
    description: 'Guarda el historial mensual con un solo paso.',
    highlights: ['Historial guardado', 'Referencia futura', 'Proceso guiado'],
  },
  export_basic: {
    title: 'Exportación básica',
    description: 'Lleva tus datos a una planilla cuando necesites.',
    highlights: ['Datos exportables', 'Revisiones externas', 'Control'],
  },
  export_advanced: {
    title: 'Exportación total',
    description: 'Trabaja tus datos con profundidad analítica.',
    highlights: ['Más detalle', 'Uso profesional', 'Libertad total'],
  },
  recurring_transactions: {
    title: 'Recurrencias',
    description: 'Automatiza los gastos que se repiten cada mes.',
    highlights: ['Menos registro manual', 'Visión futura', 'Anticipación'],
  },
  csv_import: {
    title: 'Importación masiva',
    description: 'Sube el historial de tu banco y evita el registro manual.',
    highlights: ['Carga rápida', 'Ahorro de tiempo', 'Menos errores'],
  },
  monthly_comparison: {
    title: 'Comparativa mensual',
    description: 'Detecta desvíos y mejoras respecto al mes anterior.',
    highlights: ['Mes vs Mes', 'Cambios por categoría', 'Contexto real'],
  },
  monthly_projection: {
    title: 'Proyectado al cierre',
    description: 'Anticípate antes de que se agote el mes.',
    highlights: ['Cierre estimado', 'Alertas de caja', 'Prevención'],
  },
  smart_alerts: {
    title: 'Alertas críticas',
    description: 'Señales tempranas cuando el mes se empieza a desordenar.',
    highlights: ['Sobre gasto', 'Vencimientos', 'Límites de presupuesto'],
  },
  recommendations: {
    title: 'Recomendaciones',
    description: 'Convierte tus datos en acciones para el siguiente mes.',
    highlights: ['Sugerencias útiles', 'Ajustes guiados', 'Más criterio'],
  },
  guided_close_advanced: {
    title: 'Cierre avanzado',
    description: 'Analiza el mes con contexto premium para decidir el siguiente.',
    highlights: ['Proceso experto', 'Contexto mejorado', 'Visión total'],
  },
  insights_financial_health: {
    title: 'Salud del hogar',
    description: 'Mide si el hogar está ordenado, tensionado o en riesgo.',
    highlights: ['Semáforo rápido', 'Lectura de riesgos', 'Criterio premium'],
  },
};

export const PLAN_TIER_ORDER: readonly PlanTier[] = ['free', 'essential', 'strategic'] as const;
export const COMMERCIAL_PLAN_ORDER: readonly CommercialPlanTier[] = ['free', 'premium'] as const;

export function getPlanRank(plan: PlanTier) {
  return PLAN_TIER_ORDER.indexOf(plan);
}

export function isPlanAtLeast(currentPlan: PlanTier, requiredPlan: PlanTier) {
  return getPlanRank(currentPlan) >= getPlanRank(requiredPlan);
}

export function hasFeature(plan: PlanTier, feature: FeatureKey) {
  return PLAN_FEATURES[plan][feature];
}

export function getPlanCapabilities(plan: PlanTier) {
  return {
    tier: plan,
    features: PLAN_FEATURES[plan],
    limits: PLAN_LIMITS[plan],
    info: PUBLIC_PLAN_INFO[plan],
  };
}

export function mapBillingPlanCodeToTier(planCode: BillingPlanCode | null | undefined): PlanTier {
  switch (planCode) {
    case 'base':
      return 'essential';
    case 'plus':
    case 'admin':
      return 'strategic';
    default:
      return 'free';
  }
}

export function mapTierToCommercialPlan(plan: PlanTier): CommercialPlanTier {
  return plan === 'free' ? 'free' : 'premium';
}

export function getCommercialPlanInfo(plan: PlanTier | CommercialPlanTier) {
  const tier = plan === 'premium' ? plan : mapTierToCommercialPlan(plan);
  return COMMERCIAL_PLAN_INFO[tier];
}

export function resolvePlanTier(subscription: {
  plan_code?: string | null;
  status?: string | null;
} | null | undefined): PlanTier {
  if (!subscription || subscription.status !== 'active') {
    return 'free';
  }

  return mapBillingPlanCodeToTier(subscription.plan_code as BillingPlanCode | null | undefined);
}

export function getFeatureRequiredPlan(feature: FeatureKey): PlanTier {
  for (const tier of PLAN_TIER_ORDER) {
    if (PLAN_FEATURES[tier][feature]) {
      return tier;
    }
  }

  return 'strategic';
}

export function getUpgradePlanForFeature(feature: FeatureKey): Exclude<PlanTier, 'free'> | null {
  const required = getFeatureRequiredPlan(feature);
  return required === 'free' ? null : required;
}

export function getPlanName(plan: PlanTier) {
  return getCommercialPlanInfo(plan).name;
}

export function getPlanDescription(plan: PlanTier) {
  return getCommercialPlanInfo(plan).description;
}

export function getPlanPromise(plan: PlanTier) {
  return getCommercialPlanInfo(plan).promise;
}

export function getPlanMaxGoals(plan: PlanTier) {
  return PLAN_LIMITS[plan].maxGoals;
}

export function getPlanMaxMembers(plan: PlanTier) {
  return PLAN_LIMITS[plan].maxMembers;
}

export function canCreateGoal(plan: PlanTier, activeGoalsCount: number) {
  const maxGoals = getPlanMaxGoals(plan);
  return maxGoals === null || activeGoalsCount < maxGoals;
}

export function getFeatureUpgradeCopy(feature: FeatureKey) {
  const requiredPlan = getUpgradePlanForFeature(feature);
  if (!requiredPlan) {
    return {
      requiredPlan: null,
      badge: '',
      message: '',
      actionLabel: '',
      route: '/app/suscripcion',
      title: '',
      description: '',
      highlights: [] as string[],
    };
  }

  const content = FEATURE_UPGRADE_CONTENT[feature];

  return {
    requiredPlan,
    commercialPlan: mapTierToCommercialPlan(requiredPlan),
    badge: 'Disponible en Premium',
    message: 'Actualiza a Premium para usar esta función.',
    actionLabel: 'Desbloquear Premium',
    route: `/app/suscripcion?plan=premium&feature=${feature}`,
    title: content.title,
    description: content.description,
    highlights: content.highlights,
  };
}

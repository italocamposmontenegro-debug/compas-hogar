export type ControlRole = 'CEO' | 'OPS_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT' | 'BREAK_GLASS';

export type ControlModuleKey =
  | 'executive'
  | 'billing'
  | 'customers'
  | 'operations'
  | 'risk'
  | 'growth';

export type ControlCapability =
  | 'executive.read'
  | 'billing.read'
  | 'billing.operate'
  | 'customers.read'
  | 'customers.operate'
  | 'operations.read'
  | 'operations.operate'
  | 'risk.read'
  | 'growth.read'
  | 'roles.manage'
  | 'break_glass.use';

export const CONTROL_ROLE_ORDER: readonly ControlRole[] = [
  'BREAK_GLASS',
  'OPS_ADMIN',
  'FINANCE_ADMIN',
  'SUPPORT',
  'CEO',
] as const;

export const CONTROL_ROLE_LABELS: Record<ControlRole, string> = {
  CEO: 'CEO',
  OPS_ADMIN: 'Ops Admin',
  FINANCE_ADMIN: 'Finance Admin',
  SUPPORT: 'Support',
  BREAK_GLASS: 'Break Glass',
};

export const CONTROL_ROLE_DESCRIPTIONS: Record<ControlRole, string> = {
  CEO: 'Lectura ejecutiva amplia sin acciones destructivas por defecto.',
  OPS_ADMIN: 'Operación amplia del sistema con acciones controladas.',
  FINANCE_ADMIN: 'Lectura comercial y financiera con foco en suscripciones y cobro.',
  SUPPORT: 'Diagnóstico de usuarios, hogares e incidencias operativas.',
  BREAK_GLASS: 'Acceso excepcional de máxima cobertura, reservado y auditable.',
};

export const CONTROL_MODULE_LABELS: Record<ControlModuleKey, string> = {
  executive: 'Ejecutivo',
  billing: 'Cobros y suscripciones',
  customers: 'Clientes 360',
  operations: 'Operaciones',
  risk: 'Riesgos y auditoría',
  growth: 'Crecimiento',
};

export const CONTROL_ROLE_CAPABILITIES: Record<ControlRole, readonly ControlCapability[]> = {
  CEO: [
    'executive.read',
    'billing.read',
    'customers.read',
    'operations.read',
    'risk.read',
    'growth.read',
  ],
  OPS_ADMIN: [
    'executive.read',
    'billing.read',
    'billing.operate',
    'customers.read',
    'customers.operate',
    'operations.read',
    'operations.operate',
    'risk.read',
    'growth.read',
  ],
  FINANCE_ADMIN: [
    'executive.read',
    'billing.read',
    'billing.operate',
    'customers.read',
    'risk.read',
    'growth.read',
  ],
  SUPPORT: [
    'customers.read',
    'customers.operate',
    'operations.read',
    'risk.read',
  ],
  BREAK_GLASS: [
    'executive.read',
    'billing.read',
    'billing.operate',
    'customers.read',
    'customers.operate',
    'operations.read',
    'operations.operate',
    'risk.read',
    'growth.read',
    'roles.manage',
    'break_glass.use',
  ],
};

export const CONTROL_MODULE_REQUIREMENTS: Record<ControlModuleKey, ControlCapability> = {
  executive: 'executive.read',
  billing: 'billing.read',
  customers: 'customers.read',
  operations: 'operations.read',
  risk: 'risk.read',
  growth: 'growth.read',
};

export function normalizeControlRole(value: string | null | undefined): ControlRole | null {
  switch (value) {
    case 'CEO':
    case 'OPS_ADMIN':
    case 'FINANCE_ADMIN':
    case 'SUPPORT':
    case 'BREAK_GLASS':
      return value;
    default:
      return null;
  }
}

export function dedupeControlRoles(roles: Array<ControlRole | null | undefined>): ControlRole[] {
  const unique = new Set<ControlRole>();

  roles.forEach((role) => {
    const normalized = normalizeControlRole(role ?? null);
    if (normalized) unique.add(normalized);
  });

  return CONTROL_ROLE_ORDER.filter((role) => unique.has(role));
}

export function getPrimaryControlRole(roles: Array<ControlRole | null | undefined>) {
  return dedupeControlRoles(roles)[0] ?? null;
}

export function getControlCapabilities(roles: Array<ControlRole | null | undefined>) {
  const capabilities = new Set<ControlCapability>();

  dedupeControlRoles(roles).forEach((role) => {
    CONTROL_ROLE_CAPABILITIES[role].forEach((capability) => capabilities.add(capability));
  });

  return capabilities;
}

export function hasControlCapability(
  roles: Array<ControlRole | null | undefined>,
  capability: ControlCapability,
) {
  return getControlCapabilities(roles).has(capability);
}

export function canAccessControlModule(
  roles: Array<ControlRole | null | undefined>,
  module: ControlModuleKey,
) {
  return hasControlCapability(roles, CONTROL_MODULE_REQUIREMENTS[module]);
}

export function canUseBreakGlass(roles: Array<ControlRole | null | undefined>) {
  return hasControlCapability(roles, 'break_glass.use');
}

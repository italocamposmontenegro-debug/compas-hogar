// ============================================
// Casa Clara — Calculador de reparto
// ============================================

import type { Transaction, HouseholdMember, Household, Json } from '../types/database';

export interface SplitResult {
  memberId: string;
  memberName: string;
  shouldPay: number;   // cuánto debería según la regla
  actualPaid: number;  // cuánto pagó realmente
  difference: number;  // positivo = pagó de más, negativo = debe
}

export interface SplitSummary {
  totalSharedExpenses: number;
  results: SplitResult[];
  hasImbalance: boolean;
  imbalanceAmount: number;
}

/**
 * Calcula el reparto del mes actual basado en la regla del hogar.
 * Solo considera gastos con scope = 'shared'.
 */
export function calculateSplit(
  household: Household,
  members: HouseholdMember[],
  transactions: Transaction[]
): SplitSummary {
  // Filtrar solo gastos compartidos
  const sharedExpenses = transactions.filter(
    t => t.type === 'expense' && t.scope === 'shared' && !t.deleted_at
  );

  const totalSharedExpenses = sharedExpenses.reduce((sum, t) => sum + t.amount_clp, 0);

  if (members.length === 0) {
    return {
      totalSharedExpenses,
      results: [],
      hasImbalance: false,
      imbalanceAmount: 0,
    };
  }

  // Calcular cuánto debería pagar cada miembro según la regla
  const shouldPay = calculateShouldPay(
    household.split_rule_type,
    household.split_rule_config,
    members,
    totalSharedExpenses
  );

  // Calcular cuánto pagó realmente cada miembro
  const actualPaid: Record<string, number> = {};
  for (const member of members) {
    actualPaid[member.id] = sharedExpenses
      .filter(t => t.paid_by_member_id === member.id)
      .reduce((sum, t) => sum + t.amount_clp, 0);
  }

  const results: SplitResult[] = members.map(member => {
    const should = shouldPay[member.id] || 0;
    const actual = actualPaid[member.id] || 0;
    return {
      memberId: member.id,
      memberName: member.display_name,
      shouldPay: should,
      actualPaid: actual,
      difference: actual - should,
    };
  });

  const maxDiff = Math.max(...results.map(r => Math.abs(r.difference)));

  return {
    totalSharedExpenses,
    results,
    hasImbalance: maxDiff > 1000, // tolerancia de $1.000
    imbalanceAmount: maxDiff,
  };
}

function calculateShouldPay(
  ruleType: string,
  ruleConfig: Json,
  members: HouseholdMember[],
  total: number
): Record<string, number> {
  const result: Record<string, number> = {};
  const config = isJsonRecord(ruleConfig) ? ruleConfig : {};

  switch (ruleType) {
    case '50_50':
    case 'fifty_fifty': {
      const share = Math.round(total / members.length);
      for (const m of members) {
        result[m.id] = share;
      }
      break;
    }

    case 'proportional': {
      const totalIncome = members.reduce((s, m) => s + (m.monthly_income || 0), 0);
      if (totalIncome === 0) {
        // Si no hay ingresos registrados, repartir parejo
        const share = Math.round(total / members.length);
        for (const m of members) {
          result[m.id] = share;
        }
      } else {
        for (const m of members) {
          result[m.id] = Math.round((m.monthly_income / totalIncome) * total);
        }
      }
      break;
    }

    case 'fixed_amount': {
      for (const m of members) {
        const amount = config[m.id];
        result[m.id] = typeof amount === 'number' ? amount : Math.round(total / members.length);
      }
      break;
    }

    case 'custom_percent': {
      for (const m of members) {
        const pct = typeof config[m.id] === 'number' ? config[m.id] as number : (100 / members.length);
        result[m.id] = Math.round((pct / 100) * total);
      }
      break;
    }

    default: {
      const share = Math.round(total / members.length);
      for (const m of members) {
        result[m.id] = share;
      }
    }
  }

  return result;
}

function isJsonRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Describe el desequilibrio en lenguaje natural.
 */
export function describeSplitImbalance(results: SplitResult[]): string | null {
  const overpayer = results.find(r => r.difference > 1000);
  const underpayer = results.find(r => r.difference < -1000);

  if (overpayer && underpayer) {
    const amount = Math.abs(underpayer.difference);
    return `${underpayer.memberName} le debe $${amount.toLocaleString('es-CL')} a ${overpayer.memberName} este mes.`;
  }

  return null;
}

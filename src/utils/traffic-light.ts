// ============================================
// Casa Clara — Semáforo del mes
// ============================================

import type { PaymentCalendarItem, SavingsGoal } from '../types/database';

export type TrafficLightStatus = 'order' | 'tension' | 'risk';

export interface TrafficLightResult {
  status: TrafficLightStatus;
  label: string;
  emoji: string;
  reasons: string[];
}

/**
 * Calcula el semáforo del mes con reglas transparentes.
 * 
 * 🟢 Orden: saldo ≥ 20% ingresos AND pagos al día AND meta en camino
 * 🟡 Tensión: saldo entre 5%-20% OR pagos próximos ≥ saldo OR meta atrasada
 * 🔴 Riesgo: saldo < 5% OR pagos vencidos OR gastos > ingresos
 */
export function calculateTrafficLight(
  totalIncome: number,
  totalExpenses: number,
  upcomingPayments: PaymentCalendarItem[],
  primaryGoal: SavingsGoal | null,
  currentMonth: number,
): TrafficLightResult {
  const balance = totalIncome - totalExpenses;
  const balanceRatio = totalIncome > 0 ? balance / totalIncome : 0;

  const overduePayments = upcomingPayments.filter(p => p.status === 'overdue');
  const pendingPayments = upcomingPayments.filter(p => p.status === 'pending');
  const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount_clp, 0);

  const reasons: string[] = [];

  // ========= RIESGO =========
  if (totalExpenses > totalIncome && totalIncome > 0) {
    reasons.push('Los gastos superan los ingresos este mes');
  }
  if (overduePayments.length > 0) {
    reasons.push(`${overduePayments.length} pago(s) vencido(s)`);
  }
  if (balanceRatio < 0.05 && totalIncome > 0) {
    reasons.push('El saldo disponible es menor al 5% de los ingresos');
  }

  if (reasons.length > 0) {
    return {
      status: 'risk',
      label: 'Riesgo',
      emoji: '🔴',
      reasons,
    };
  }

  // ========= TENSIÓN =========
  if (balanceRatio < 0.20 && totalIncome > 0) {
    reasons.push('El saldo disponible es menor al 20% de los ingresos');
  }
  if (pendingTotal >= balance && pendingTotal > 0) {
    reasons.push('Los pagos pendientes se acercan al saldo disponible');
  }
  if (primaryGoal && primaryGoal.status === 'active') {
    const monthsElapsed = currentMonth;
    const targetMonth = new Date(primaryGoal.target_date).getMonth() + 1;
    const targetYear = new Date(primaryGoal.target_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const totalMonths = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
    if (totalMonths > 0) {
      const expectedProgress = primaryGoal.target_amount_clp * (monthsElapsed / (monthsElapsed + totalMonths));
      if (primaryGoal.current_amount_clp < expectedProgress * 0.7) {
        reasons.push('La meta principal avanza más lento de lo esperado');
      }
    }
  }

  if (reasons.length > 0) {
    return {
      status: 'tension',
      label: 'Tensión',
      emoji: '🟡',
      reasons,
    };
  }

  // ========= ORDEN =========
  return {
    status: 'order',
    label: 'Orden',
    emoji: '🟢',
    reasons: ['Ingresos, gastos y pagos están bajo control'],
  };
}

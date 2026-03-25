import type { Category, PaymentCalendarItem, SavingsGoal, Transaction } from '../types/database';
import { formatCLP } from './format-clp';

export type InsightSeverity = 'danger' | 'warning' | 'info' | 'success';
export type InsightActionTarget = 'calendar' | 'transactions' | 'comparison' | 'goals';

export interface InsightAction {
  target: InsightActionTarget;
  status?: 'pending' | 'overdue';
  type?: 'income' | 'expense';
  categoryId?: string;
}

export interface FinancialAlert {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  action?: InsightAction;
}

export interface FinancialRecommendation {
  id: string;
  title: string;
  message: string;
  action?: InsightAction;
}

export interface FinancialInsightsResult {
  alerts: FinancialAlert[];
  recommendations: FinancialRecommendation[];
}

interface BuildFinancialInsightsInput {
  currentTransactions: Transaction[];
  previousTransactions: Transaction[];
  upcomingPayments: PaymentCalendarItem[];
  primaryGoal: SavingsGoal | null;
  categories: Category[];
  currentYear: number;
  currentMonth: number;
}

function getTopExpenseCategory(currentTransactions: Transaction[], categories: Category[]) {
  const totals = new Map<string, number>();

  for (const transaction of currentTransactions) {
    if (transaction.type !== 'expense' || !transaction.category_id) continue;
    totals.set(transaction.category_id, (totals.get(transaction.category_id) ?? 0) + transaction.amount_clp);
  }

  let topCategoryId: string | null = null;
  let topCategoryTotal = 0;

  for (const [categoryId, total] of totals.entries()) {
    if (total > topCategoryTotal) {
      topCategoryId = categoryId;
      topCategoryTotal = total;
    }
  }

  if (!topCategoryId) return null;

  const category = categories.find((item) => item.id === topCategoryId);
  return {
    id: topCategoryId,
    name: category?.name ?? 'una categoría',
    total: topCategoryTotal,
  };
}

function getGoalGap(primaryGoal: SavingsGoal | null, currentYear: number, currentMonth: number) {
  if (!primaryGoal || primaryGoal.status !== 'active') return null;

  const targetDate = new Date(primaryGoal.target_date);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  const remainingMonths = Math.max(1, (targetYear - currentYear) * 12 + (targetMonth - currentMonth) + 1);
  const remainingAmount = Math.max(0, primaryGoal.target_amount_clp - primaryGoal.current_amount_clp);
  const suggestedMonthlyContribution = Math.ceil(remainingAmount / remainingMonths);

  return {
    remainingMonths,
    remainingAmount,
    suggestedMonthlyContribution,
  };
}

export function buildFinancialInsights({
  currentTransactions,
  previousTransactions,
  upcomingPayments,
  primaryGoal,
  categories,
  currentYear,
  currentMonth,
}: BuildFinancialInsightsInput): FinancialInsightsResult {
  const alerts: FinancialAlert[] = [];
  const recommendations: FinancialRecommendation[] = [];

  const totalIncome = currentTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount_clp, 0);

  const totalExpenses = currentTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount_clp, 0);

  const previousExpenses = previousTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount_clp, 0);

  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? balance / totalIncome : 0;
  const overduePayments = upcomingPayments.filter((payment) => payment.status === 'overdue');
  const pendingPayments = upcomingPayments.filter((payment) => payment.status === 'pending');
  const overdueAmount = overduePayments.reduce((sum, payment) => sum + payment.amount_clp, 0);
  const pendingAmount = pendingPayments.reduce((sum, payment) => sum + payment.amount_clp, 0);
  const topExpenseCategory = getTopExpenseCategory(currentTransactions, categories);
  const goalGap = getGoalGap(primaryGoal, currentYear, currentMonth);

  if (overduePayments.length > 0) {
    alerts.push({
      id: 'overdue-payments',
      severity: 'danger',
      title: 'Pagos vencidos',
      message: `Tienen ${overduePayments.length} pago(s) vencido(s) por ${formatCLP(overdueAmount)}.`,
      action: { target: 'calendar', status: 'overdue' },
    });

    recommendations.push({
      id: 'catch-up-overdue',
      title: 'Regularicen pagos atrasados',
      message: 'Pónganse al día con los pagos vencidos antes de agregar nuevos gastos variables este mes.',
      action: { target: 'calendar', status: 'overdue' },
    });
  }

  if (totalIncome > 0 && totalExpenses > totalIncome) {
    alerts.push({
      id: 'month-negative',
      severity: 'danger',
      title: 'El mes va en rojo',
      message: `Los gastos ya superan los ingresos por ${formatCLP(totalExpenses - totalIncome)}.`,
      action: { target: 'transactions', type: 'expense' },
    });

    recommendations.push({
      id: 'freeze-variable-spend',
      title: 'Congelen gasto variable',
      message: 'Durante los próximos días prioricen solo gastos esenciales hasta volver a saldo positivo.',
      action: { target: 'transactions', type: 'expense' },
    });
  }

  if (pendingAmount > 0 && pendingAmount >= Math.max(balance, 0)) {
    alerts.push({
      id: 'pending-vs-balance',
      severity: 'warning',
      title: 'Pagos pendientes altos',
      message: `Los pagos pendientes suman ${formatCLP(pendingAmount)} y se acercan a todo el saldo disponible.`,
      action: { target: 'calendar', status: 'pending' },
    });

    recommendations.push({
      id: 'reserve-pending-payments',
      title: 'Reservar dinero para vencimientos',
      message: `Sepáren hoy ${formatCLP(pendingAmount)} para cubrir pagos pendientes y no tensionar el cierre del mes.`,
      action: { target: 'calendar', status: 'pending' },
    });
  }

  if (totalIncome > 0 && savingsRate < 0.1) {
    alerts.push({
      id: 'low-savings-rate',
      severity: savingsRate < 0.05 ? 'warning' : 'info',
      title: 'Poco margen para ahorrar',
      message: `El margen actual es ${Math.max(0, Math.round(savingsRate * 100))}% de sus ingresos.`,
    });
  }

  if (previousExpenses > 0) {
    const expenseChange = totalExpenses - previousExpenses;
    const expenseChangeRatio = expenseChange / previousExpenses;

    if (expenseChangeRatio >= 0.15) {
      alerts.push({
        id: 'expenses-up',
        severity: 'warning',
        title: 'Subieron los gastos',
        message: `Este mes gastaron ${formatCLP(expenseChange)} más que el mes pasado.`,
        action: { target: 'comparison' },
      });

      recommendations.push({
        id: 'review-monthly-increase',
        title: 'Revisen qué cambió este mes',
        message: 'Compárenlo con el mes pasado y detecten si el aumento fue puntual o se está volviendo costumbre.',
        action: { target: 'comparison' },
      });
    } else if (expenseChangeRatio <= -0.1) {
      recommendations.push({
        id: 'keep-positive-trend',
        title: 'Mantengan la mejora',
        message: `Sus gastos van ${formatCLP(Math.abs(expenseChange))} por debajo del mes pasado. Vale la pena sostener ese nivel.`,
        action: { target: 'comparison' },
      });
    }
  }

  if (topExpenseCategory && totalExpenses > 0) {
    const share = topExpenseCategory.total / totalExpenses;

    if (share >= 0.35) {
      alerts.push({
        id: 'top-category-concentration',
        severity: 'info',
        title: 'Una categoría concentra gran parte del gasto',
        message: `${topExpenseCategory.name} representa ${Math.round(share * 100)}% de sus gastos del mes.`,
        action: { target: 'transactions', type: 'expense', categoryId: topExpenseCategory.id },
      });

      recommendations.push({
        id: 'review-top-category',
        title: `Revisen ${topExpenseCategory.name}`,
        message: `Es la mayor fuga del mes con ${formatCLP(topExpenseCategory.total)}. Si la ajustan, el impacto se notará rápido.`,
        action: { target: 'transactions', type: 'expense', categoryId: topExpenseCategory.id },
      });
    }
  }

  if (goalGap && goalGap.remainingAmount > 0) {
    recommendations.push({
      id: 'goal-contribution',
      title: 'Aseguren el avance de la meta',
      message: `Para llegar a tiempo a su meta principal, deberían apartar cerca de ${formatCLP(goalGap.suggestedMonthlyContribution)} por mes.`,
      action: { target: 'goals' },
    });
  }

  if (balance > 0 && pendingAmount === 0 && savingsRate >= 0.15) {
    recommendations.push({
      id: 'allocate-surplus',
      title: 'Aprovechen el excedente',
      message: `Van cerrando con margen. Podrían separar ${formatCLP(Math.round(balance * 0.5))} para ahorro y dejar el resto como colchón.`,
      action: { target: 'goals' },
    });
  }

  return {
    alerts: alerts.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
  };
}

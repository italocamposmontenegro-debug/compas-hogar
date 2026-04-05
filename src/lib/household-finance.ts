import type { Category, Household, HouseholdMember, PaymentCalendarItem, SavingsGoal, Transaction } from '../types/database';

export type MovementFlowType =
  | 'income'
  | 'pago_obligatorio'
  | 'gasto_variable'
  | 'ahorro'
  | 'inversion'
  | 'ocio'
  | 'imprevisto'
  | 'abono_saldo_hogar';

export type BalanceOriginState = 'Pendiente' | 'Parcial' | 'Saldado' | 'Excluido' | 'Ajustado';

export interface HouseholdMonthSnapshot {
  totalIncome: number;
  totalRequiredPaymentsPaid: number;
  totalRequiredPaymentsPending: number;
  totalRequiredPaymentsCommitted: number;
  totalDayToDayExpenses: number;
  totalSavings: number;
  availableReal: number;
  paymentPressure: number;
  nextImportantPayment: PaymentCalendarItem | null;
  primaryGoal: SavingsGoal | null;
  primaryGoalProgress: number;
}

export interface HouseholdBalanceSettlement {
  id: string;
  amount: number;
  occurredOn: string;
  paidByMemberId: string;
  paidByMemberName: string;
  receivedByMemberId: string | null;
  receivedByMemberName: string | null;
  description: string;
  notes: string | null;
}

export interface HouseholdBalanceOrigin {
  id: string;
  description: string;
  occurredOn: string;
  amount: number;
  flowType: MovementFlowType;
  paidByMemberId: string;
  paidByMemberName: string;
  counterpartyMemberId: string | null;
  counterpartyMemberName: string | null;
  compensableAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  state: BalanceOriginState;
  affectsBalance: boolean;
}

export interface HouseholdBalanceSummary {
  status: 'Puesta al dia' | 'Pendiente';
  netAmount: number;
  favoredMemberId: string | null;
  favoredMemberName: string | null;
  pendingMemberId: string | null;
  pendingMemberName: string | null;
  origins: HouseholdBalanceOrigin[];
  settlements: HouseholdBalanceSettlement[];
  excludedOrigins: HouseholdBalanceOrigin[];
}

const DAY_TO_DAY_FLOW_TYPES: MovementFlowType[] = ['gasto_variable', 'ocio', 'imprevisto', 'inversion'];
const BALANCE_RELEVANT_FLOW_TYPES: MovementFlowType[] = ['pago_obligatorio', 'gasto_variable', 'ocio', 'imprevisto', 'inversion'];

export const FLOW_TYPE_LABELS: Record<MovementFlowType, string> = {
  income: 'Ingreso',
  pago_obligatorio: 'Pago obligatorio',
  gasto_variable: 'Gasto del día a día',
  ahorro: 'Ahorro',
  inversion: 'Inversión',
  ocio: 'Ocio',
  imprevisto: 'Imprevisto',
  abono_saldo_hogar: 'Abono de puesta al día',
};

export function getTransactionFlowType(transaction: Pick<Transaction, 'type' | 'expense_type' | 'flow_type' | 'category_id'>, categories: Category[] = []): MovementFlowType {
  if (transaction.flow_type) {
    return transaction.flow_type;
  }

  if (transaction.type === 'income') {
    return 'income';
  }

  if (transaction.expense_type === 'fixed') {
    return 'pago_obligatorio';
  }

  const categoryName = transaction.category_id
    ? categories.find((category) => category.id === transaction.category_id)?.name.toLowerCase()
    : null;

  if (categoryName?.includes('ahorro') || categoryName?.includes('meta')) {
    return 'ahorro';
  }

  if (categoryName?.includes('ocio') || categoryName?.includes('salida')) {
    return 'ocio';
  }

  if (categoryName?.includes('imprevisto')) {
    return 'imprevisto';
  }

  return 'gasto_variable';
}

export function isSavingsFlow(flowType: MovementFlowType) {
  return flowType === 'ahorro' || flowType === 'inversion';
}

export function isRequiredPaymentFlow(flowType: MovementFlowType) {
  return flowType === 'pago_obligatorio';
}

export function isSettlementFlow(flowType: MovementFlowType) {
  return flowType === 'abono_saldo_hogar';
}

export function isDayToDayExpenseFlow(flowType: MovementFlowType) {
  return DAY_TO_DAY_FLOW_TYPES.includes(flowType);
}

export function transactionAffectsHouseholdBalance(
  transaction: Pick<Transaction, 'type' | 'scope' | 'affects_household_balance' | 'balance_excluded_at' | 'flow_type' | 'expense_type' | 'category_id'>,
  categories: Category[] = [],
) {
  if (transaction.balance_excluded_at) {
    return false;
  }

  if (typeof transaction.affects_household_balance === 'boolean') {
    return transaction.affects_household_balance;
  }

  if (transaction.type !== 'expense') {
    return false;
  }

  const flowType = getTransactionFlowType(transaction, categories);
  return transaction.scope === 'shared' && BALANCE_RELEVANT_FLOW_TYPES.includes(flowType);
}

export function buildHouseholdMonthSnapshot({
  transactions,
  payments,
  goals,
  categories,
}: {
  transactions: Transaction[];
  payments: PaymentCalendarItem[];
  goals: SavingsGoal[];
  categories: Category[];
}): HouseholdMonthSnapshot {
  const activePrimaryGoal = goals.find((goal) => goal.is_primary && goal.status === 'active') ?? null;
  const requiredPaymentTransactions = transactions.filter(
    (transaction) => transaction.type === 'expense' && isRequiredPaymentFlow(getTransactionFlowType(transaction, categories)),
  );
  const dayToDayTransactions = transactions.filter(
    (transaction) => transaction.type === 'expense' && isDayToDayExpenseFlow(getTransactionFlowType(transaction, categories)),
  );
  const savingsTransactions = transactions.filter(
    (transaction) => transaction.type === 'expense' && isSavingsFlow(getTransactionFlowType(transaction, categories)),
  );

  const totalIncome = transactions
    .filter((transaction) => getTransactionFlowType(transaction, categories) === 'income')
    .reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const totalRequiredPaymentsPaid = requiredPaymentTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const totalRequiredPaymentsPending = payments
    .filter((payment) => payment.status === 'pending' || payment.status === 'overdue')
    .reduce((sum, payment) => sum + payment.amount_clp, 0);
  const totalRequiredPaymentsCommitted = totalRequiredPaymentsPaid + totalRequiredPaymentsPending;
  const totalDayToDayExpenses = dayToDayTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const totalSavings = savingsTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const availableReal = totalIncome - totalRequiredPaymentsCommitted - totalDayToDayExpenses - totalSavings;
  const paymentPressure = totalIncome > 0 ? totalRequiredPaymentsCommitted / totalIncome : 0;
  const nextImportantPayment = payments
    .filter((payment) => payment.status === 'pending' || payment.status === 'overdue')
    .sort((left, right) => left.due_date.localeCompare(right.due_date))[0] ?? null;
  const primaryGoalProgress = activePrimaryGoal && activePrimaryGoal.target_amount_clp > 0
    ? Math.round((activePrimaryGoal.current_amount_clp / activePrimaryGoal.target_amount_clp) * 100)
    : 0;

  return {
    totalIncome,
    totalRequiredPaymentsPaid,
    totalRequiredPaymentsPending,
    totalRequiredPaymentsCommitted,
    totalDayToDayExpenses,
    totalSavings,
    availableReal,
    paymentPressure,
    nextImportantPayment,
    primaryGoal: activePrimaryGoal,
    primaryGoalProgress,
  };
}

export function calculateHouseholdBalance({
  household,
  members,
  transactions,
  categories,
}: {
  household: Household | null;
  members: HouseholdMember[];
  transactions: Transaction[];
  categories: Category[];
}): HouseholdBalanceSummary {
  const acceptedMembers = members.filter((member) => member.invitation_status === 'accepted');
  const memberMap = new Map(acceptedMembers.map((member) => [member.id, member]));

  const settlements = transactions
    .filter((transaction) => !transaction.deleted_at && isSettlementFlow(getTransactionFlowType(transaction, categories)))
    .sort(compareTransactions)
    .map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount_clp,
      occurredOn: transaction.occurred_on,
      paidByMemberId: transaction.paid_by_member_id,
      paidByMemberName: memberMap.get(transaction.paid_by_member_id)?.display_name ?? 'Integrante',
      receivedByMemberId: transaction.assigned_to_member_id,
      receivedByMemberName: transaction.assigned_to_member_id
        ? (memberMap.get(transaction.assigned_to_member_id)?.display_name ?? 'Integrante')
        : null,
      description: transaction.description,
      notes: transaction.notes,
    }));

  const sharedOrigins = transactions
    .filter((transaction) => !transaction.deleted_at)
    .filter((transaction) => transaction.type === 'expense')
    .filter((transaction) => !isSettlementFlow(getTransactionFlowType(transaction, categories)))
    .filter((transaction) => transaction.scope === 'shared')
    .sort(compareTransactions);

  const totalCompensableBase = sharedOrigins
    .filter((transaction) => transactionAffectsHouseholdBalance(transaction, categories))
    .reduce((sum, transaction) => sum + transaction.amount_clp, 0);

  const shareMap = resolveMemberContributionMap(household, acceptedMembers, totalCompensableBase);
  const pairAllocations = new Map<string, number>();

  for (const settlement of settlements) {
    if (!settlement.receivedByMemberId) continue;
    const key = `${settlement.paidByMemberId}->${settlement.receivedByMemberId}`;
    pairAllocations.set(key, (pairAllocations.get(key) ?? 0) + settlement.amount);
  }

  const origins: HouseholdBalanceOrigin[] = [];
  const excludedOrigins: HouseholdBalanceOrigin[] = [];

  for (const transaction of sharedOrigins) {
    const flowType = getTransactionFlowType(transaction, categories);
    const payer = memberMap.get(transaction.paid_by_member_id);
    const counterparty = acceptedMembers.find((member) => member.id !== transaction.paid_by_member_id) ?? null;
    const affectsBalance = transactionAffectsHouseholdBalance(transaction, categories);

    if (!affectsBalance || !counterparty || !payer) {
      const excluded: HouseholdBalanceOrigin = {
        id: transaction.id,
        description: transaction.description,
        occurredOn: transaction.occurred_on,
        amount: transaction.amount_clp,
        flowType,
        paidByMemberId: transaction.paid_by_member_id,
        paidByMemberName: payer?.display_name ?? 'Integrante',
        counterpartyMemberId: counterparty?.id ?? null,
        counterpartyMemberName: counterparty?.display_name ?? null,
        compensableAmount: 0,
        appliedAmount: 0,
        remainingAmount: 0,
        state: transaction.balance_adjusted_manually ? 'Ajustado' : 'Excluido',
        affectsBalance,
      };
      excludedOrigins.push(excluded);
      continue;
    }

    const counterpartyShare = shareMap.get(counterparty.id) ?? 0.5;
    const compensableAmount = Math.max(0, Math.round(transaction.amount_clp * counterpartyShare));
    const pairKey = `${counterparty.id}->${transaction.paid_by_member_id}`;
    const availableSettlement = pairAllocations.get(pairKey) ?? 0;
    const appliedAmount = Math.min(compensableAmount, availableSettlement);
    const remainingAmount = Math.max(0, compensableAmount - appliedAmount);

    if (appliedAmount > 0) {
      pairAllocations.set(pairKey, Math.max(0, availableSettlement - appliedAmount));
    }

    const state: BalanceOriginState = transaction.balance_adjusted_manually
      ? 'Ajustado'
      : remainingAmount === 0
        ? 'Saldado'
        : appliedAmount > 0
          ? 'Parcial'
          : 'Pendiente';

    origins.push({
      id: transaction.id,
      description: transaction.description,
      occurredOn: transaction.occurred_on,
      amount: transaction.amount_clp,
      flowType,
      paidByMemberId: transaction.paid_by_member_id,
      paidByMemberName: payer.display_name,
      counterpartyMemberId: counterparty.id,
      counterpartyMemberName: counterparty.display_name,
      compensableAmount,
      appliedAmount,
      remainingAmount,
      state,
      affectsBalance,
    });
  }

  const netByMember = new Map<string, number>();

  for (const member of acceptedMembers) {
    netByMember.set(member.id, 0);
  }

  for (const origin of origins) {
    if (!origin.counterpartyMemberId || origin.remainingAmount <= 0) continue;
    netByMember.set(origin.paidByMemberId, (netByMember.get(origin.paidByMemberId) ?? 0) + origin.remainingAmount);
    netByMember.set(origin.counterpartyMemberId, (netByMember.get(origin.counterpartyMemberId) ?? 0) - origin.remainingAmount);
  }

  const sortedBalances = [...netByMember.entries()].sort((left, right) => right[1] - left[1]);
  const favored = sortedBalances.find(([, amount]) => amount > 0) ?? null;
  const pending = [...sortedBalances].reverse().find(([, amount]) => amount < 0) ?? null;
  const netAmount = favored ? Math.round(favored[1]) : 0;

  return {
    status: netAmount <= 0 ? 'Puesta al dia' : 'Pendiente',
    netAmount,
    favoredMemberId: favored?.[0] ?? null,
    favoredMemberName: favored ? (memberMap.get(favored[0])?.display_name ?? null) : null,
    pendingMemberId: pending?.[0] ?? null,
    pendingMemberName: pending ? (memberMap.get(pending[0])?.display_name ?? null) : null,
    origins,
    settlements,
    excludedOrigins,
  };
}

function resolveMemberContributionMap(household: Household | null, members: HouseholdMember[], total: number) {
  const result = new Map<string, number>();

  if (members.length === 0) {
    return result;
  }

  if (total <= 0) {
    const fallbackShare = 1 / members.length;
    for (const member of members) {
      result.set(member.id, fallbackShare);
    }
    return result;
  }

  const splitRule = household?.split_rule_type ?? 'fifty_fifty';
  const config = isRecord(household?.split_rule_config) ? household?.split_rule_config : {};

  if (splitRule === 'proportional') {
    const totalIncome = members.reduce((sum, member) => sum + (member.monthly_income || 0), 0);
    if (totalIncome > 0) {
      for (const member of members) {
        result.set(member.id, (member.monthly_income || 0) / totalIncome);
      }
      return result;
    }
  }

  if (splitRule === 'custom_percent') {
    const totalPercent = members.reduce((sum, member) => {
      const percent = typeof config[member.id] === 'number' ? Number(config[member.id]) : 0;
      return sum + percent;
    }, 0);

    if (totalPercent > 0) {
      for (const member of members) {
        const percent = typeof config[member.id] === 'number' ? Number(config[member.id]) : 0;
        result.set(member.id, percent / totalPercent);
      }
      return result;
    }
  }

  if (splitRule === 'fixed_amount') {
    const totalFixed = members.reduce((sum, member) => {
      const amount = typeof config[member.id] === 'number' ? Number(config[member.id]) : 0;
      return sum + amount;
    }, 0);

    if (totalFixed > 0) {
      for (const member of members) {
        const amount = typeof config[member.id] === 'number' ? Number(config[member.id]) : 0;
        result.set(member.id, amount / totalFixed);
      }
      return result;
    }
  }

  const fallbackShare = 1 / members.length;
  for (const member of members) {
    result.set(member.id, fallbackShare);
  }
  return result;
}

function compareTransactions(left: Pick<Transaction, 'occurred_on' | 'created_at'>, right: Pick<Transaction, 'occurred_on' | 'created_at'>) {
  const byDate = left.occurred_on.localeCompare(right.occurred_on);
  if (byDate !== 0) return byDate;
  return left.created_at.localeCompare(right.created_at);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

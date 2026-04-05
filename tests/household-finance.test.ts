import assert from 'node:assert/strict';
import { buildHouseholdMonthSnapshot, calculateHouseholdBalance } from '../src/lib/household-finance.ts';
import type { Category, Household, HouseholdMember, PaymentCalendarItem, SavingsGoal, Transaction } from '../src/types/database.ts';

const household: Household = {
  id: 'household-1',
  name: 'Hogar prueba',
  split_rule_type: 'fifty_fifty',
  split_rule_config: {},
  currency: 'CLP',
  timezone: 'America/Santiago',
  created_by: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
};

const members: HouseholdMember[] = [
  {
    id: 'member-a',
    household_id: household.id,
    user_id: 'user-a',
    role: 'owner',
    display_name: 'Ana',
    email: 'ana@test.dev',
    monthly_income: 1200000,
    invited_by: null,
    invitation_status: 'accepted',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'member-b',
    household_id: household.id,
    user_id: 'user-b',
    role: 'member',
    display_name: 'Bruno',
    email: 'bruno@test.dev',
    monthly_income: 1200000,
    invited_by: null,
    invitation_status: 'accepted',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  },
];

const categories: Category[] = [
  {
    id: 'cat-home',
    household_id: household.id,
    name: 'Compras del hogar',
    icon: '🏠',
    color: '#2563EB',
    is_default: true,
    sort_order: 0,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    deleted_at: null,
  },
];

const goals: SavingsGoal[] = [{
  id: 'goal-1',
  household_id: household.id,
  name: 'Fondo de emergencia',
  target_amount_clp: 500000,
  current_amount_clp: 100000,
  target_date: '2026-12-01',
  is_primary: true,
  status: 'active',
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
}];

function baseTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    household_id: household.id,
    created_by: null,
    type: 'expense',
    flow_type: 'gasto_variable',
    paid_by_member_id: members[0].id,
    scope: 'shared',
    assigned_to_member_id: null,
    affects_household_balance: true,
    balance_excluded_at: null,
    balance_adjusted_manually: false,
    amount_clp: 1000,
    category_id: categories[0].id,
    goal_id: null,
    description: 'Compra',
    occurred_on: '2026-04-10',
    expense_type: 'variable',
    is_recurring_instance: false,
    recurring_source_id: null,
    notes: null,
    created_at: '2026-04-10T00:00:00.000Z',
    updated_at: '2026-04-10T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function run(label: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}`);
    throw error;
  }
}

run('buildHouseholdMonthSnapshot computes available real with payments and savings', () => {
  const transactions: Transaction[] = [
    baseTransaction({
      id: 'income-1',
      type: 'income',
      flow_type: 'income',
      scope: 'personal',
      affects_household_balance: false,
      amount_clp: 2000000,
      category_id: null,
      description: 'Sueldo',
      expense_type: null,
    }),
    baseTransaction({
      id: 'payment-1',
      flow_type: 'pago_obligatorio',
      amount_clp: 300000,
      expense_type: 'fixed',
    }),
    baseTransaction({
      id: 'day-1',
      flow_type: 'gasto_variable',
      amount_clp: 200000,
      expense_type: 'variable',
    }),
    baseTransaction({
      id: 'save-1',
      flow_type: 'ahorro',
      scope: 'personal',
      affects_household_balance: false,
      amount_clp: 100000,
      category_id: null,
      goal_id: goals[0].id,
    }),
  ];

  const payments: PaymentCalendarItem[] = [{
    id: 'pending-1',
    household_id: household.id,
    description: 'Luz',
    amount_clp: 50000,
    due_date: '2026-04-20',
    status: 'pending',
    category_id: categories[0].id,
    recurring_source_id: null,
    paid_transaction_id: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  }];

  const snapshot = buildHouseholdMonthSnapshot({ transactions, payments, goals, categories });
  assert.equal(snapshot.totalIncome, 2000000);
  assert.equal(snapshot.totalRequiredPaymentsCommitted, 350000);
  assert.equal(snapshot.totalDayToDayExpenses, 200000);
  assert.equal(snapshot.totalSavings, 100000);
  assert.equal(snapshot.availableReal, 1350000);
});

run('calculateHouseholdBalance applies partial abono over shared expenses', () => {
  const transactions: Transaction[] = [
    baseTransaction({
      id: 'shared-1',
      paid_by_member_id: members[0].id,
      amount_clp: 100000,
      description: 'Supermercado',
    }),
    baseTransaction({
      id: 'abono-1',
      flow_type: 'abono_saldo_hogar',
      paid_by_member_id: members[1].id,
      assigned_to_member_id: members[0].id,
      amount_clp: 20000,
      description: 'Abono de Saldo Hogar',
      affects_household_balance: false,
      expense_type: 'variable',
    }),
  ];

  const summary = calculateHouseholdBalance({ household, members, transactions, categories });

  assert.equal(summary.status, 'Pendiente');
  assert.equal(summary.netAmount, 30000);
  assert.equal(summary.favoredMemberName, 'Ana');
  assert.equal(summary.pendingMemberName, 'Bruno');
  assert.equal(summary.origins[0].state, 'Parcial');
  assert.equal(summary.origins[0].remainingAmount, 30000);
});

console.log('All household finance tests passed.');

/**
 * Temporary seed for beta testers.
 *
 * Creates exactly three standalone beta accounts:
 * - one auth user per tester
 * - one profile per tester (trigger-backed, with safe fallback)
 * - one household per tester
 * - one owner membership per tester
 * - one active strategic subscription per household
 * - a small, believable demo dataset per household
 *
 * Execution is intentionally defensive:
 * - aborts if any target email already exists
 * - uses exact target emails only
 * - does not expose service_role anywhere outside server-side execution
 */

import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SEED_TAG = 'beta-testers-final-2026';
const STRATEGIC_PLAN_CODE = 'plus';
const STRATEGIC_PLAN_PRICE_CLP = 4990;
const DEFAULT_SPLIT_RULE = 'fifty_fifty';
const DEFAULT_CURRENCY = 'CLP';
const DEFAULT_TIMEZONE = 'America/Santiago';

const TESTERS = [
  {
    email: 'beta1@compashogar.local',
    fullName: 'Beta Tester 1',
    householdName: 'Hogar Demo 1',
    monthlyIncome: 1820000,
  },
  {
    email: 'beta2@compashogar.local',
    fullName: 'Beta Tester 2',
    householdName: 'Hogar Demo 2',
    monthlyIncome: 1960000,
  },
  {
    email: 'beta3@compashogar.local',
    fullName: 'Beta Tester 3',
    householdName: 'Hogar Demo 3',
    monthlyIncome: 2140000,
  },
];

const PASSWORD_CHARSETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digit: '23456789',
  symbol: '!@#$%^&*()-_=+',
};

function randomChar(charset) {
  return charset[randomInt(0, charset.length)];
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function generatePassword(length = 18) {
  const allChars = Object.values(PASSWORD_CHARSETS).join('');
  const chars = [
    randomChar(PASSWORD_CHARSETS.upper),
    randomChar(PASSWORD_CHARSETS.lower),
    randomChar(PASSWORD_CHARSETS.digit),
    randomChar(PASSWORD_CHARSETS.symbol),
  ];

  while (chars.length < length) {
    chars.push(randomChar(allChars));
  }

  return shuffle(chars).join('');
}

const DEFAULT_CATEGORIES = [
  { name: 'Supermercado', icon: '🛒', color: '#059669', is_default: true, sort_order: 0 },
  { name: 'Vivienda', icon: '🏠', color: '#2563EB', is_default: true, sort_order: 1 },
  { name: 'Servicios básicos', icon: '💡', color: '#D97706', is_default: true, sort_order: 2 },
  { name: 'Transporte', icon: '🚗', color: '#7C3AED', is_default: true, sort_order: 3 },
  { name: 'Salud', icon: '❤️', color: '#DC2626', is_default: true, sort_order: 4 },
  { name: 'Educación', icon: '📚', color: '#0891B2', is_default: true, sort_order: 5 },
  { name: 'Ocio', icon: '🎬', color: '#DB2777', is_default: true, sort_order: 6 },
  { name: 'Suscripciones', icon: '📱', color: '#6366F1', is_default: true, sort_order: 7 },
  { name: 'Mascotas', icon: '🐾', color: '#EA580C', is_default: true, sort_order: 8 },
  { name: 'Ahorro', icon: '💰', color: '#16A34A', is_default: true, sort_order: 9 },
  { name: 'Otros', icon: '📦', color: '#6B7280', is_default: true, sort_order: 10 },
  { name: 'Colegio', icon: '🎒', color: '#0F766E', is_default: false, sort_order: 11 },
  { name: 'Mantención', icon: '🧰', color: '#A16207', is_default: false, sort_order: 12 },
];

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthDate(baseDate, dayOffset) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = Math.min(Math.max(dayOffset, 1), 28);
  return new Date(year, month, day);
}

function previousMonthDate(baseDate, dayOffset) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() - 1;
  const day = Math.min(Math.max(dayOffset, 1), 28);
  return new Date(year, month, day);
}

function futureMonthDate(baseDate, monthOffset, dayOffset) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + monthOffset;
  const day = Math.min(Math.max(dayOffset, 1), 28);
  return new Date(year, month, day);
}

async function listAllUsers() {
  const allUsers = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    allUsers.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

async function assertTargetEmailsAvailable() {
  const existing = await listAllUsers();
  const byEmail = new Map(existing.map((user) => [user.email?.toLowerCase(), user]));
  const collisions = TESTERS.map((tester) => byEmail.get(tester.email.toLowerCase())).filter(Boolean);

  if (collisions.length > 0) {
    const details = collisions
      .map((user) => `${user.email} (${user.id})`)
      .join(', ');
    throw new Error(`Target beta emails already exist. Abort to avoid mixing data: ${details}`);
  }
}

async function createUser(tester) {
  const password = generatePassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email: tester.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: tester.fullName,
      test_user: true,
      seed: SEED_TAG,
      role_hint: 'owner',
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create user ${tester.email}`);
  }

  return {
    user: data.user,
    password,
  };
}

async function ensureProfile(user, tester) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      if (data.full_name !== tester.fullName || data.email !== tester.email) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: tester.fullName,
            email: tester.email,
          })
          .eq('id', user.id);

        if (updateError) throw updateError;
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    email: tester.email,
    full_name: tester.fullName,
    avatar_url: null,
    is_admin: false,
  });

  if (insertError) throw insertError;
}

async function createHousehold(user, tester) {
  const { data, error } = await supabase
    .from('households')
    .insert({
      name: tester.householdName,
      split_rule_type: DEFAULT_SPLIT_RULE,
      split_rule_config: {},
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to create household for ${tester.email}`);
  }

  return data;
}

async function createOwnerMembership(household, user, tester) {
  const { data, error } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
      display_name: tester.fullName,
      email: tester.email,
      monthly_income: tester.monthlyIncome,
      invited_by: null,
      invitation_status: 'accepted',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to create owner membership for ${tester.email}`);
  }

  return data;
}

async function seedCategories(householdId) {
  const payload = DEFAULT_CATEGORIES.map((category) => ({
    household_id: householdId,
    ...category,
  }));

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('*');

  if (error || !data) {
    throw error ?? new Error(`Failed to seed categories for household ${householdId}`);
  }

  return new Map(data.map((category) => [category.name, category]));
}

async function createSubscription(householdId, index) {
  const periodStart = new Date();
  const periodEnd = futureMonthDate(periodStart, 1, periodStart.getDate());

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      household_id: householdId,
      provider: 'mercadopago',
      provider_account_label: 'mp_default',
      plan_code: STRATEGIC_PLAN_CODE,
      billing_cycle: 'monthly',
      status: 'active',
      migration_status: null,
      external_reference: `${SEED_TAG}-external-${index + 1}`,
      provider_subscription_id: `${SEED_TAG}-subscription-${index + 1}`,
      price_amount_clp: STRATEGIC_PLAN_PRICE_CLP,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      last_payment_status: 'approved',
      trial_ends_at: null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to create subscription for household ${householdId}`);
  }

  return data;
}

function buildDemoTransactions({ baseDate, householdId, ownerMemberId, categoryMap, createdBy, offset }) {
  const currentDay = baseDate.getDate();
  const currentIncome = 1650000 + offset * 120000;
  const previousIncome = 1580000 + offset * 110000;

  return [
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'income',
      paid_by_member_id: ownerMemberId,
      scope: 'personal',
      amount_clp: previousIncome,
      category_id: null,
      description: 'Sueldo mes anterior',
      occurred_on: toIsoDate(previousMonthDate(baseDate, 3)),
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'shared',
      amount_clp: 112000 + offset * 2500,
      category_id: categoryMap.get('Supermercado').id,
      description: 'Supermercado mes anterior',
      occurred_on: toIsoDate(previousMonthDate(baseDate, 10)),
      expense_type: 'variable',
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'income',
      paid_by_member_id: ownerMemberId,
      scope: 'personal',
      amount_clp: currentIncome,
      category_id: null,
      description: 'Sueldo principal',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(2, currentDay - 15))),
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'shared',
      amount_clp: 520000 + offset * 15000,
      category_id: categoryMap.get('Vivienda').id,
      description: 'Arriendo',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(3, currentDay - 12))),
      expense_type: 'fixed',
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'shared',
      amount_clp: 98600 + offset * 3200,
      category_id: categoryMap.get('Supermercado').id,
      description: 'Supermercado',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(5, currentDay - 9))),
      expense_type: 'variable',
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'shared',
      amount_clp: 57900 + offset * 1800,
      category_id: categoryMap.get('Mantención').id,
      description: 'Mantención del hogar',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(8, currentDay - 6))),
      expense_type: 'variable',
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'shared',
      amount_clp: 12990 + offset * 250,
      category_id: categoryMap.get('Suscripciones').id,
      description: 'Streaming',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(10, currentDay - 4))),
      expense_type: 'fixed',
      notes: null,
    },
    {
      household_id: householdId,
      created_by: createdBy,
      type: 'expense',
      paid_by_member_id: ownerMemberId,
      scope: 'personal',
      amount_clp: 38800 + offset * 900,
      category_id: categoryMap.get('Transporte').id,
      description: 'Movilización',
      occurred_on: toIsoDate(monthDate(baseDate, Math.max(12, currentDay - 2))),
      expense_type: 'variable',
      notes: null,
    },
  ];
}

async function seedTransactions({ householdId, ownerMemberId, categoryMap, createdBy, offset, baseDate }) {
  const payload = buildDemoTransactions({
    baseDate,
    householdId,
    ownerMemberId,
    categoryMap,
    createdBy,
    offset,
  }).map((row) => ({
    assigned_to_member_id: null,
    is_recurring_instance: false,
    recurring_source_id: null,
    ...row,
  }));

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select('*');

  if (error || !data) {
    throw error ?? new Error(`Failed to seed transactions for household ${householdId}`);
  }

  return data;
}

async function seedGoals({ householdId, offset, baseDate }) {
  const goals = [
    {
      household_id: householdId,
      name: 'Fondo de emergencia',
      target_amount_clp: 900000 + offset * 70000,
      current_amount_clp: 320000 + offset * 25000,
      target_date: toIsoDate(futureMonthDate(baseDate, 5, 15)),
      is_primary: true,
      status: 'active',
    },
    {
      household_id: householdId,
      name: 'Vacaciones de invierno',
      target_amount_clp: 480000 + offset * 30000,
      current_amount_clp: 145000 + offset * 18000,
      target_date: toIsoDate(futureMonthDate(baseDate, 4, 10)),
      is_primary: false,
      status: 'active',
    },
  ];

  const { data, error } = await supabase
    .from('savings_goals')
    .insert(goals)
    .select('*');

  if (error || !data) {
    throw error ?? new Error(`Failed to seed goals for household ${householdId}`);
  }

  return data;
}

async function seedRecurring({ householdId, ownerMemberId, categoryMap, createdBy }) {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      household_id: householdId,
      created_by: createdBy,
      description: 'Internet hogar',
      amount_clp: 24990,
      category_id: categoryMap.get('Suscripciones').id,
      scope: 'shared',
      paid_by_member_id: ownerMemberId,
      assigned_to_member_id: null,
      day_of_month: 12,
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to seed recurring transaction for household ${householdId}`);
  }

  return data;
}

async function seedCalendar({ householdId, categoryMap, recurringId, paidTransactionId, offset, baseDate }) {
  const currentDay = baseDate.getDate();
  const futureDue = toIsoDate(monthDate(baseDate, Math.min(currentDay + 4, 28)));
  const overdueDue = toIsoDate(monthDate(baseDate, Math.max(currentDay - 3, 2)));
  const paidDue = toIsoDate(monthDate(baseDate, Math.max(currentDay - 8, 3)));

  const payload = [
    {
      household_id: householdId,
      description: 'Internet hogar',
      amount_clp: 24990,
      due_date: futureDue,
      status: 'pending',
      category_id: categoryMap.get('Suscripciones').id,
      recurring_source_id: recurringId,
      paid_transaction_id: null,
    },
    {
      household_id: householdId,
      description: 'Colegio',
      amount_clp: 174000 + offset * 6500,
      due_date: overdueDue,
      status: 'overdue',
      category_id: categoryMap.get('Colegio').id,
      recurring_source_id: null,
      paid_transaction_id: null,
    },
    {
      household_id: householdId,
      description: 'Streaming',
      amount_clp: 12990 + offset * 250,
      due_date: paidDue,
      status: 'paid',
      category_id: categoryMap.get('Suscripciones').id,
      recurring_source_id: null,
      paid_transaction_id: paidTransactionId,
    },
  ];

  const { data, error } = await supabase
    .from('payment_calendar_items')
    .insert(payload)
    .select('*');

  if (error || !data) {
    throw error ?? new Error(`Failed to seed calendar for household ${householdId}`);
  }

  return data;
}

function resolveStrategic(subscriptionRow) {
  return subscriptionRow?.status === 'active' && ['plus', 'admin'].includes(subscriptionRow?.plan_code);
}

async function validateTester({ userId, householdId, membershipId, householdName, email }) {
  const [{ data: profile }, { data: membership }, { data: subscription }, { data: household }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('household_members')
      .select('*')
      .eq('id', membershipId)
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .eq('role', 'owner')
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
  ]);

  if (!profile) throw new Error(`Profile missing for ${email}`);
  if (!membership) throw new Error(`Owner membership missing for ${email}`);
  if (!household || household.name !== householdName) throw new Error(`Household mismatch for ${email}`);
  if (!subscription || !resolveStrategic(subscription)) {
    throw new Error(`Strategic subscription not active for ${email}`);
  }
}

async function validateSeedCounts(householdId) {
  const [{ count: txCount }, { count: goalCount }, { count: calendarCount }, { count: recurringCount }] = await Promise.all([
    supabase.from('transactions').select('*', { head: true, count: 'exact' }).eq('household_id', householdId),
    supabase.from('savings_goals').select('*', { head: true, count: 'exact' }).eq('household_id', householdId),
    supabase.from('payment_calendar_items').select('*', { head: true, count: 'exact' }).eq('household_id', householdId),
    supabase.from('recurring_transactions').select('*', { head: true, count: 'exact' }).eq('household_id', householdId),
  ]);

  if ((txCount ?? 0) < 4) throw new Error(`Insufficient transactions for household ${householdId}`);
  if ((goalCount ?? 0) < 1) throw new Error(`Goals missing for household ${householdId}`);
  if ((calendarCount ?? 0) < 2) throw new Error(`Calendar items missing for household ${householdId}`);
  if ((recurringCount ?? 0) < 1) throw new Error(`Recurring transaction missing for household ${householdId}`);
}

async function main() {
  await assertTargetEmailsAvailable();

  const baseDate = new Date();
  const summary = [];

  for (const [index, tester] of TESTERS.entries()) {
    console.log(`Creating beta tester ${index + 1}: ${tester.email}`);

    const { user, password } = await createUser(tester);
    await ensureProfile(user, tester);

    const household = await createHousehold(user, tester);
    const ownerMembership = await createOwnerMembership(household, user, tester);
    const categoryMap = await seedCategories(household.id);
    const subscription = await createSubscription(household.id, index);
    const transactions = await seedTransactions({
      householdId: household.id,
      ownerMemberId: ownerMembership.id,
      categoryMap,
      createdBy: user.id,
      offset: index,
      baseDate,
    });
    const goals = await seedGoals({
      householdId: household.id,
      offset: index,
      baseDate,
    });
    const recurring = await seedRecurring({
      householdId: household.id,
      ownerMemberId: ownerMembership.id,
      categoryMap,
      createdBy: user.id,
    });

    const paidStreaming = transactions.find((transaction) => transaction.description === 'Streaming');
    if (!paidStreaming) {
      throw new Error(`Streaming transaction missing for ${tester.email}`);
    }

    const calendarItems = await seedCalendar({
      householdId: household.id,
      categoryMap,
      recurringId: recurring.id,
      paidTransactionId: paidStreaming.id,
      offset: index,
      baseDate,
    });

    await validateTester({
      userId: user.id,
      householdId: household.id,
      membershipId: ownerMembership.id,
      householdName: tester.householdName,
      email: tester.email,
    });
    await validateSeedCounts(household.id);

    summary.push({
      email: tester.email,
      password,
      userId: user.id,
      householdId: household.id,
      householdName: tester.householdName,
      ownerMembershipId: ownerMembership.id,
      subscription: {
        id: subscription.id,
        plan_code: subscription.plan_code,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
      },
      seeded: {
        categories: categoryMap.size,
        transactions: transactions.length,
        goals: goals.length,
        calendarItems: calendarItems.length,
        recurringTransactions: 1,
      },
    });
  }

  const createdUsers = await listAllUsers();
  for (const tester of TESTERS) {
    const found = createdUsers.find((user) => user.email?.toLowerCase() === tester.email.toLowerCase());
    if (!found) {
      throw new Error(`Auth validation failed for ${tester.email}`);
    }
  }

  console.log('\nBeta testers created successfully.\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('\ncreate-beta-testers failed:\n');
  console.error(error);
  process.exitCode = 1;
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { assertHouseholdFeature } from '../_shared/entitlements.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getChileMonthContext() {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(new Date());
  const year = Number.parseInt(parts.find((part) => part.type === 'year')?.value || '2026', 10);
  const month = Number.parseInt(parts.find((part) => part.type === 'month')?.value || '1', 10);
  const day = Number.parseInt(parts.find((part) => part.type === 'day')?.value || '1', 10);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return { year, month, day, daysInMonth };
}

function formatDueDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function insertRecurringIncomeInstance(recurring: {
  id: string;
  household_id: string;
  created_by: string | null;
  description: string;
  amount_clp: number;
  paid_by_member_id: string;
}, occurredOn: string) {
  const { error } = await supabase
    .from('transactions')
    .insert({
      household_id: recurring.household_id,
      created_by: recurring.created_by,
      type: 'income',
      flow_type: 'income',
      paid_by_member_id: recurring.paid_by_member_id,
      scope: 'personal',
      assigned_to_member_id: null,
      affects_household_balance: false,
      balance_excluded_at: null,
      balance_adjusted_manually: false,
      amount_clp: recurring.amount_clp,
      category_id: null,
      goal_id: null,
      description: recurring.description,
      occurred_on: occurredOn,
      expense_type: null,
      is_recurring_instance: true,
      recurring_source_id: recurring.id,
      notes: null,
    });

  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Unauthorized');

    const { householdId } = await req.json() as { householdId?: string };
    if (!householdId) throw new Error('householdId es obligatorio.');

    const { data: actorMember, error: actorMemberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    if (actorMemberError || !actorMember) {
      throw new Error('No tienes acceso a este hogar.');
    }

    await assertHouseholdFeature(supabase, householdId, 'recurring_transactions');

    const { year, month, day, daysInMonth } = getChileMonthContext();
    const monthStart = formatDueDate(year, month, 1);
    const monthEnd = formatDueDate(year, month, daysInMonth);

    const [recurringRes, existingExpenseRes, existingRecurringTransactionRes] = await Promise.all([
      supabase
        .from('recurring_transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true),
      supabase
        .from('payment_calendar_items')
        .select('id, recurring_source_id, due_date, status')
        .eq('household_id', householdId)
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd)
        .not('recurring_source_id', 'is', null),
      supabase
        .from('transactions')
        .select('id, recurring_source_id, occurred_on, type')
        .eq('household_id', householdId)
        .eq('is_recurring_instance', true)
        .gte('occurred_on', monthStart)
        .lte('occurred_on', monthEnd)
        .not('recurring_source_id', 'is', null)
        .is('deleted_at', null),
    ]);

    if (recurringRes.error) throw recurringRes.error;
    if (existingExpenseRes.error) throw existingExpenseRes.error;
    if (existingRecurringTransactionRes.error) throw existingRecurringTransactionRes.error;

    const existingByRecurringAndDate = new Map<string, { id: string; status: string }>();
    for (const item of existingExpenseRes.data || []) {
      if (!item.recurring_source_id) continue;
      existingByRecurringAndDate.set(`${item.recurring_source_id}:${item.due_date}`, {
        id: item.id,
        status: item.status,
      });
    }

    const existingRecurringTransactionIds = new Set<string>();
    for (const transaction of existingRecurringTransactionRes.data || []) {
      if (!transaction.recurring_source_id) continue;
      existingRecurringTransactionIds.add(transaction.recurring_source_id);
    }

    const itemsToInsert = [];
    let createdIncomeCount = 0;
    for (const recurring of recurringRes.data || []) {
      const transactionType = recurring.transaction_type ?? 'expense';
      const occurrenceDay = Math.min(recurring.day_of_month, daysInMonth);
      const occurrenceDate = formatDueDate(year, month, occurrenceDay);

      if (transactionType === 'income') {
        if (day < occurrenceDay) continue;
        if (existingRecurringTransactionIds.has(recurring.id)) continue;

        const created = await insertRecurringIncomeInstance(recurring, occurrenceDate);
        if (created) {
          createdIncomeCount += 1;
          existingRecurringTransactionIds.add(recurring.id);
        }
        continue;
      }

      if (existingRecurringTransactionIds.has(recurring.id)) continue;

      const existingKey = `${recurring.id}:${occurrenceDate}`;
      if (existingByRecurringAndDate.has(existingKey)) continue;

      itemsToInsert.push({
        household_id: householdId,
        description: recurring.description,
        amount_clp: recurring.amount_clp,
        due_date: occurrenceDate,
        status: occurrenceDay < day ? 'overdue' : 'pending',
        category_id: recurring.category_id,
        recurring_source_id: recurring.id,
        paid_transaction_id: null,
      });
    }

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('payment_calendar_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;
    }

    const pendingIdsToOverdue = (existingRes.data || [])
      .filter((item) => {
        const dueDay = Number.parseInt(item.due_date.split('-')[2] || '0', 10);
        return item.status === 'pending' && dueDay < day;
      })
      .map((item) => item.id);

    if (pendingIdsToOverdue.length > 0) {
      const { error: overdueError } = await supabase
        .from('payment_calendar_items')
        .update({ status: 'overdue' })
        .in('id', pendingIdsToOverdue);

      if (overdueError) throw overdueError;
    }

    return new Response(JSON.stringify({
      success: true,
      created: itemsToInsert.length + createdIncomeCount,
      created_payments: itemsToInsert.length,
      created_income_transactions: createdIncomeCount,
      updated_to_overdue: pendingIdsToOverdue.length,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : 400,
    });
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { assertHouseholdFeature } from '../_shared/entitlements.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'create' | 'update' | 'toggle' | 'delete';
type Scope = 'personal' | 'shared';
type TransactionType = 'expense' | 'income';

function parseRequiredText(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }

  return value.trim();
}

function parseAmount(value: unknown) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('El monto debe ser un numero mayor a 0.');
  }

  return parsed;
}

function parseDayOfMonth(value: unknown) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) {
    throw new Error('El dia del mes debe estar entre 1 y 31.');
  }

  return parsed;
}

function parseTransactionType(value: unknown): TransactionType {
  return value === 'income' ? 'income' : 'expense';
}

function parseScope(value: unknown): Scope {
  return value === 'personal' ? 'personal' : 'shared';
}

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

async function getAuthenticatedUser(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

async function assertHouseholdAccess(householdId: string, userId: string) {
  const { data, error } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .eq('invitation_status', 'accepted')
    .maybeSingle();

  if (error || !data) {
    throw new Error('No tienes acceso a este hogar.');
  }
}

async function assertCategory(householdId: string, categoryId: string | null) {
  if (!categoryId) return;

  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos la categoria seleccionada.');
  }
}

async function assertMember(householdId: string, memberId: string) {
  const { data, error } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('id', memberId)
    .eq('invitation_status', 'accepted')
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos al miembro seleccionado.');
  }
}

async function updateCurrentMonthGeneratedItems(recurringId: string, values: {
  description: string;
  amountClp: number;
  categoryId: string | null;
  dueDate: string;
  nextStatus: 'pending' | 'overdue';
}) {
  const { year, month, daysInMonth } = getChileMonthContext();
  const monthStart = formatDueDate(year, month, 1);
  const monthEnd = formatDueDate(year, month, daysInMonth);

  const { error } = await supabase
    .from('payment_calendar_items')
    .update({
      description: values.description,
      amount_clp: values.amountClp,
      category_id: values.categoryId,
      due_date: values.dueDate,
      status: values.nextStatus,
    })
    .eq('recurring_source_id', recurringId)
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)
    .is('paid_transaction_id', null);

  if (error) throw error;
}

async function deletePendingGeneratedItems(recurringId: string) {
  const { year, month, daysInMonth } = getChileMonthContext();
  const monthStart = formatDueDate(year, month, 1);
  const monthEnd = formatDueDate(year, month, daysInMonth);

  const { error } = await supabase
    .from('payment_calendar_items')
    .delete()
    .eq('recurring_source_id', recurringId)
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)
    .is('paid_transaction_id', null);

  if (error) throw error;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const user = await getAuthenticatedUser(authHeader.replace('Bearer ', ''));
    const body = await req.json() as {
      action?: Action;
      recurringId?: string;
      householdId?: string;
      transactionType?: unknown;
      description?: unknown;
      amountClp?: unknown;
      categoryId?: string | null;
      dayOfMonth?: unknown;
      scope?: unknown;
      paidByMemberId?: string;
      isActive?: boolean;
    };

    const action = body.action || 'create';

    if (action === 'create') {
      const householdId = parseRequiredText(body.householdId, 'El hogar');
      await assertHouseholdAccess(householdId, user.id);
      await assertHouseholdFeature(supabase, householdId, 'recurring_transactions');

      const description = parseRequiredText(body.description, 'La descripcion');
      const amountClp = parseAmount(body.amountClp);
      const transactionType = parseTransactionType(body.transactionType);
      const categoryId = transactionType === 'expense' ? body.categoryId ?? null : null;
      const dayOfMonth = parseDayOfMonth(body.dayOfMonth);
      const scope = transactionType === 'income' ? 'personal' : parseScope(body.scope);
      const paidByMemberId = parseRequiredText(body.paidByMemberId, 'El miembro responsable');

      await assertCategory(householdId, categoryId);
      await assertMember(householdId, paidByMemberId);

      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert({
          household_id: householdId,
          created_by: user.id,
          transaction_type: transactionType,
          description,
          amount_clp: amountClp,
          category_id: categoryId,
          scope,
          paid_by_member_id: paidByMemberId,
          assigned_to_member_id: null,
          day_of_month: dayOfMonth,
          is_active: true,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('No pudimos crear la recurrencia.');
      }

      return new Response(JSON.stringify({ item: data }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const recurringId = parseRequiredText(body.recurringId, 'La recurrencia');
    const { data: recurring, error: recurringError } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', recurringId)
      .maybeSingle();

    if (recurringError || !recurring) {
      throw new Error('No encontramos esa recurrencia.');
    }

    await assertHouseholdAccess(recurring.household_id, user.id);
    await assertHouseholdFeature(supabase, recurring.household_id, 'recurring_transactions');

    if (action === 'delete') {
      if ((recurring.transaction_type ?? 'expense') === 'expense') {
        await deletePendingGeneratedItems(recurring.id);
      }

      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', recurring.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'toggle') {
      const isActive = !!body.isActive;
      const { data, error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: isActive })
        .eq('id', recurring.id)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('No pudimos actualizar el estado de la recurrencia.');
      }

      return new Response(JSON.stringify({ item: data }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const description = parseRequiredText(body.description, 'La descripcion');
    const amountClp = parseAmount(body.amountClp);
    const transactionType = parseTransactionType(body.transactionType ?? recurring.transaction_type);
    const categoryId = transactionType === 'expense' ? body.categoryId ?? null : null;
    const dayOfMonth = parseDayOfMonth(body.dayOfMonth);
    const scope = transactionType === 'income' ? 'personal' : parseScope(body.scope);
    const paidByMemberId = parseRequiredText(body.paidByMemberId, 'El miembro responsable');

    await assertCategory(recurring.household_id, categoryId);
    await assertMember(recurring.household_id, paidByMemberId);

    const { day, month, year, daysInMonth } = getChileMonthContext();
    const effectiveDueDay = Math.min(dayOfMonth, daysInMonth);
    const nextStatus = effectiveDueDay < day ? 'overdue' : 'pending';
    const nextDueDate = formatDueDate(year, month, effectiveDueDay);

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update({
        transaction_type: transactionType,
        description,
        amount_clp: amountClp,
        category_id: categoryId,
        scope,
        paid_by_member_id: paidByMemberId,
        day_of_month: dayOfMonth,
      })
      .eq('id', recurring.id)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('No pudimos actualizar la recurrencia.');
    }

    if ((recurring.transaction_type ?? 'expense') === 'expense' && transactionType === 'income') {
      await deletePendingGeneratedItems(recurring.id);
    }

    if (transactionType === 'expense') {
      await updateCurrentMonthGeneratedItems(recurring.id, {
        description,
        amountClp,
        categoryId,
        dueDate: nextDueDate,
        nextStatus,
      });
    }

    return new Response(JSON.stringify({ item: data }), {
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

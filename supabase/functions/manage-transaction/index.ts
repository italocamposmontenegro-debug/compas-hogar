import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { getHouseholdPlanTier } from '../_shared/entitlements.ts';
import { hasFeature } from '../../../shared/plans.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'create' | 'update' | 'delete';
type TransactionType = 'income' | 'expense';
type TransactionScope = 'personal' | 'shared';
type ExpenseType = 'fixed' | 'variable' | null;
type FlowType =
  | 'income'
  | 'pago_obligatorio'
  | 'gasto_variable'
  | 'ahorro'
  | 'inversion'
  | 'ocio'
  | 'imprevisto'
  | 'abono_saldo_hogar';

const BALANCE_RELEVANT_FLOW_TYPES: FlowType[] = ['pago_obligatorio', 'gasto_variable', 'inversion', 'ocio', 'imprevisto'];

function parseRequiredText(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }

  return value.trim();
}

function parseOptionalText(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('El valor enviado no es valido.');
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

function parseType(value: unknown): TransactionType {
  if (value === 'income' || value === 'expense') return value;
  throw new Error('Tipo de movimiento invalido.');
}

function parseScope(value: unknown): TransactionScope {
  return value === 'personal' ? 'personal' : 'shared';
}

function parseExpenseType(value: unknown): ExpenseType {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'fixed' || value === 'variable') return value;
  throw new Error('Tipo de gasto invalido.');
}

function parseFlowType(value: unknown, transactionType: TransactionType, expenseType: ExpenseType): FlowType {
  if (transactionType === 'income') return 'income';

  if (
    value === 'pago_obligatorio'
    || value === 'gasto_variable'
    || value === 'ahorro'
    || value === 'inversion'
    || value === 'ocio'
    || value === 'imprevisto'
    || value === 'abono_saldo_hogar'
  ) {
    return value;
  }

  return expenseType === 'fixed' ? 'pago_obligatorio' : 'gasto_variable';
}

function resolveAffectsHouseholdBalance(
  explicitValue: unknown,
  transactionType: TransactionType,
  scope: TransactionScope,
  flowType: FlowType,
) {
  if (transactionType !== 'expense') return false;
  if (flowType === 'abono_saldo_hogar' || flowType === 'ahorro') return false;
  if (typeof explicitValue === 'boolean') return explicitValue;
  return scope === 'shared' && BALANCE_RELEVANT_FLOW_TYPES.includes(flowType);
}

function getTodayChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

async function getTransaction(transactionId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos ese movimiento.');
  }

  return data;
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

  return data;
}

async function getCategory(householdId: string, categoryId: string | null) {
  if (!categoryId) return null;

  const { data, error } = await supabase
    .from('categories')
    .select('id, is_default')
    .eq('household_id', householdId)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos la categoria seleccionada.');
  }

  return data;
}

async function assertMember(householdId: string, memberId: string | null) {
  if (!memberId) return;

  const { data, error } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('id', memberId)
    .eq('invitation_status', 'accepted')
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos al integrante seleccionado.');
  }
}

async function assertCategoryAllowed(householdId: string, categoryId: string | null, canUseCustomCategories: boolean) {
  const category = await getCategory(householdId, categoryId);
  if (!category) return;
  if (!canUseCustomCategories && !category.is_default) {
    throw new Error('Las categorías personalizadas están disponibles en Premium.');
  }
}

async function assertGoal(householdId: string, goalId: string | null) {
  if (!goalId) return;

  const { data, error } = await supabase
    .from('savings_goals')
    .select('id')
    .eq('household_id', householdId)
    .eq('id', goalId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos la meta seleccionada.');
  }
}

async function adjustGoalAmount(goalId: string | null, delta: number) {
  if (!goalId || delta === 0) return;

  const { data, error } = await supabase
    .from('savings_goals')
    .select('current_amount_clp')
    .eq('id', goalId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No pudimos actualizar el avance del ahorro.');
  }

  const { error: updateError } = await supabase
    .from('savings_goals')
    .update({
      current_amount_clp: Math.max(0, (data.current_amount_clp ?? 0) + delta),
    })
    .eq('id', goalId);

  if (updateError) throw updateError;
}

async function getLinkedPaymentItem(transactionId: string) {
  const { data, error } = await supabase
    .from('payment_calendar_items')
    .select('*')
    .eq('paid_transaction_id', transactionId)
    .maybeSingle();

  if (error) throw error;
  return data;
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
      householdId?: string;
      transactionId?: string;
      type?: unknown;
      flowType?: unknown;
      description?: unknown;
      amountClp?: unknown;
      categoryId?: string | null;
      goalId?: string | null;
      occurredOn?: unknown;
      paidByMemberId?: string;
      assignedToMemberId?: string | null;
      scope?: unknown;
      expenseType?: unknown;
      affectsHouseholdBalance?: unknown;
      notes?: unknown;
    };

    if (!body.action) throw new Error('Accion requerida.');

    if (body.action === 'create') {
      if (!body.householdId) throw new Error('Hogar requerido.');

      const actorMember = await assertHouseholdAccess(body.householdId, user.id);
      const planTier = await getHouseholdPlanTier(supabase, body.householdId);
      const nextType = parseType(body.type);
      const nextDescription = parseRequiredText(body.description, 'La descripcion');
      const nextAmount = parseAmount(body.amountClp);
      const nextOccurredOn = parseRequiredText(body.occurredOn, 'La fecha');
      const canUseCustomCategories = hasFeature(planTier, 'categories_custom');
      const nextPaidByMemberId = parseOptionalText(body.paidByMemberId) ?? actorMember.id;
      const nextScope = parseScope(body.scope);
      const nextExpenseType = nextType === 'expense'
        ? parseExpenseType(body.expenseType)
        : null;
      const nextFlowType = parseFlowType(body.flowType, nextType, nextExpenseType);
      const nextCategoryId = body.categoryId ?? null;
      const nextGoalId = nextFlowType === 'ahorro' ? parseOptionalText(body.goalId) : null;
      const nextAssignedToMemberId = nextFlowType === 'abono_saldo_hogar'
        ? parseRequiredText(body.assignedToMemberId, 'A quien se abona')
        : parseOptionalText(body.assignedToMemberId);
      const nextAffectsHouseholdBalance = resolveAffectsHouseholdBalance(
        body.affectsHouseholdBalance,
        nextType,
        nextScope,
        nextFlowType,
      );
      const nextNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

      await assertMember(body.householdId, nextPaidByMemberId);
      await assertMember(body.householdId, nextAssignedToMemberId);
      await assertCategoryAllowed(body.householdId, nextCategoryId, canUseCustomCategories);
      await assertGoal(body.householdId, nextGoalId);

      if (nextFlowType === 'abono_saldo_hogar' && nextAssignedToMemberId === nextPaidByMemberId) {
        throw new Error('El abono debe quedar asociado al otro integrante.');
      }

      const { data: createdTransaction, error: createError } = await supabase
        .from('transactions')
        .insert({
          household_id: body.householdId,
          created_by: user.id,
          type: nextType,
          flow_type: nextFlowType,
          paid_by_member_id: nextPaidByMemberId,
          scope: nextScope,
          assigned_to_member_id: nextAssignedToMemberId,
          affects_household_balance: nextAffectsHouseholdBalance,
          balance_excluded_at: nextType === 'expense' && nextScope === 'shared' && !nextAffectsHouseholdBalance ? new Date().toISOString() : null,
          balance_adjusted_manually: nextType === 'expense' && nextScope === 'shared' && !nextAffectsHouseholdBalance,
          amount_clp: nextAmount,
          category_id: nextType === 'expense' ? nextCategoryId : null,
          goal_id: nextGoalId,
          description: nextDescription,
          occurred_on: nextOccurredOn,
          expense_type: nextExpenseType,
          is_recurring_instance: false,
          recurring_source_id: null,
          notes: nextNotes,
        })
        .select('*')
        .single();

      if (createError || !createdTransaction) {
        throw createError ?? new Error('No pudimos crear el movimiento.');
      }

      if (nextFlowType === 'ahorro' && nextGoalId) {
        await adjustGoalAmount(nextGoalId, nextAmount);
      }

      return new Response(JSON.stringify({ transaction: createdTransaction }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!body.transactionId) throw new Error('Movimiento requerido.');

    const transaction = await getTransaction(body.transactionId);
    const actorMember = await assertHouseholdAccess(transaction.household_id, user.id);
    const planTier = await getHouseholdPlanTier(supabase, transaction.household_id);
    const canUseCustomCategories = hasFeature(planTier, 'categories_custom');
    const linkedPaymentItem = await getLinkedPaymentItem(transaction.id);

    if (body.action === 'delete') {
      if (transaction.flow_type === 'ahorro' && transaction.goal_id) {
        await adjustGoalAmount(transaction.goal_id, -transaction.amount_clp);
      }

      const { error: deleteError } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', transaction.id)
        .is('deleted_at', null);

      if (deleteError) throw deleteError;

      if (linkedPaymentItem) {
        const nextStatus = linkedPaymentItem.due_date < getTodayChile() ? 'overdue' : 'pending';
        const { error: paymentError } = await supabase
          .from('payment_calendar_items')
          .update({
            status: nextStatus,
            paid_transaction_id: null,
          })
          .eq('id', linkedPaymentItem.id);

        if (paymentError) throw paymentError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const nextType = parseType(body.type);
    const nextDescription = parseRequiredText(body.description, 'La descripcion');
    const nextAmount = parseAmount(body.amountClp);
    const nextOccurredOn = parseRequiredText(body.occurredOn, 'La fecha');
    const nextPaidByMemberId = parseOptionalText(body.paidByMemberId) ?? transaction.paid_by_member_id || actorMember.id;
    const nextScope = parseOptionalText(body.scope) ? parseScope(body.scope) : transaction.scope;
    const nextExpenseType = nextType === 'expense'
      ? (parseOptionalText(body.expenseType) ? parseExpenseType(body.expenseType) : transaction.expense_type ?? 'variable')
      : null;
    const nextFlowType = linkedPaymentItem
      ? 'pago_obligatorio'
      : parseFlowType(body.flowType, nextType, nextExpenseType);
    const nextCategoryId = body.categoryId ?? null;
    const nextGoalId = nextFlowType === 'ahorro' ? parseOptionalText(body.goalId) : null;
    const nextAssignedToMemberId = nextFlowType === 'abono_saldo_hogar'
      ? parseRequiredText(body.assignedToMemberId, 'A quien se abona')
      : parseOptionalText(body.assignedToMemberId);
    const nextAffectsHouseholdBalance = resolveAffectsHouseholdBalance(
      body.affectsHouseholdBalance,
      nextType,
      nextScope,
      nextFlowType,
    );
    const nextNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

    await assertMember(transaction.household_id, nextPaidByMemberId);
    await assertMember(transaction.household_id, nextAssignedToMemberId);
    await assertCategoryAllowed(transaction.household_id, nextCategoryId, canUseCustomCategories);
    await assertGoal(transaction.household_id, nextGoalId);

    if (linkedPaymentItem && nextType !== 'expense') {
      throw new Error('No puedes convertir en ingreso un gasto asociado a un pago programado.');
    }

    if (nextFlowType === 'abono_saldo_hogar' && nextAssignedToMemberId === nextPaidByMemberId) {
      throw new Error('El abono debe quedar asociado al otro integrante.');
    }

    if (transaction.flow_type === 'ahorro' && transaction.goal_id) {
      await adjustGoalAmount(transaction.goal_id, -transaction.amount_clp);
    }

    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        type: nextType,
        flow_type: nextFlowType,
        description: nextDescription,
        amount_clp: nextAmount,
        category_id: nextCategoryId,
        goal_id: nextGoalId,
        occurred_on: nextOccurredOn,
        paid_by_member_id: nextPaidByMemberId,
        scope: nextScope,
        assigned_to_member_id: nextAssignedToMemberId,
        affects_household_balance: nextAffectsHouseholdBalance,
        balance_excluded_at: nextType === 'expense' && nextScope === 'shared' && !nextAffectsHouseholdBalance ? new Date().toISOString() : null,
        balance_adjusted_manually: nextType === 'expense' && nextScope === 'shared' && !nextAffectsHouseholdBalance,
        expense_type: nextExpenseType,
        notes: nextNotes,
      })
      .eq('id', transaction.id)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (updateError || !updatedTransaction) {
      throw updateError ?? new Error('No pudimos actualizar el movimiento.');
    }

    if (nextFlowType === 'ahorro' && nextGoalId) {
      await adjustGoalAmount(nextGoalId, nextAmount);
    }

    if (linkedPaymentItem) {
      const { error: paymentError } = await supabase
        .from('payment_calendar_items')
        .update({
          description: nextDescription,
          amount_clp: nextAmount,
          category_id: nextCategoryId,
        })
        .eq('id', linkedPaymentItem.id);

      if (paymentError) throw paymentError;
    }

    return new Response(JSON.stringify({ transaction: updatedTransaction }), {
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

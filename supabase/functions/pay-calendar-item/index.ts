import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ExpenseScope = 'personal' | 'shared';
type ExpenseType = 'fixed' | 'variable';
type Action = 'pay' | 'undo';

function parseScope(value: unknown): ExpenseScope {
  return value === 'personal' ? 'personal' : 'shared';
}

function parseExpenseType(value: unknown): ExpenseType {
  return value === 'variable' ? 'variable' : 'fixed';
}

function parseOccurredOn(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

function getTodayChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

    const {
      action,
      itemId,
      paidByMemberId,
      occurredOn,
      scope,
      expenseType,
      categoryId,
      notes,
    } = await req.json() as {
      action?: Action;
      itemId?: string;
      paidByMemberId?: string;
      occurredOn?: unknown;
      scope?: unknown;
      expenseType?: unknown;
      categoryId?: string | null;
      notes?: string | null;
    };

    if (!itemId) throw new Error('Pago requerido.');
    const resolvedAction: Action = action === 'undo' ? 'undo' : 'pay';
    if (resolvedAction === 'pay' && !paidByMemberId) throw new Error('Debes indicar quién pagó.');

    const { data: item, error: itemError } = await supabase
      .from('payment_calendar_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError || !item) {
      throw new Error('No encontramos ese pago programado.');
    }

    const { data: actorMember, error: actorMemberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', item.household_id)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    if (actorMemberError || !actorMember) {
      throw new Error('No tienes acceso a este hogar.');
    }

    if (resolvedAction === 'undo') {
      if (item.status !== 'paid') {
        throw new Error('Ese pago no está marcado como pagado.');
      }

      if (item.paid_transaction_id) {
        const { error: deleteError } = await supabase
          .from('transactions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.paid_transaction_id)
          .is('deleted_at', null);

        if (deleteError) throw deleteError;
      }

      const nextStatus = item.due_date < getTodayChile() ? 'overdue' : 'pending';
      const { error: revertError } = await supabase
        .from('payment_calendar_items')
        .update({
          status: nextStatus,
          paid_transaction_id: null,
        })
        .eq('id', item.id);

      if (revertError) throw revertError;

      return new Response(JSON.stringify({
        success: true,
        payment_calendar_item_id: item.id,
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: paidByMember, error: paidByMemberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', item.household_id)
      .eq('id', paidByMemberId)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    if (paidByMemberError || !paidByMember) {
      throw new Error('No encontramos al miembro que realizó el pago.');
    }

    if (item.status === 'paid' && item.paid_transaction_id) {
      return new Response(JSON.stringify({
        success: true,
        transaction_id: item.paid_transaction_id,
        payment_calendar_item_id: item.id,
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const finalCategoryId = categoryId ?? item.category_id ?? null;

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        household_id: item.household_id,
        created_by: user.id,
        type: 'expense',
        paid_by_member_id: paidByMemberId,
        scope: parseScope(scope),
        assigned_to_member_id: null,
        amount_clp: item.amount_clp,
        category_id: finalCategoryId,
        description: item.description,
        occurred_on: parseOccurredOn(occurredOn, item.due_date),
        expense_type: parseExpenseType(expenseType),
        is_recurring_instance: !!item.recurring_source_id,
        recurring_source_id: item.recurring_source_id,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      })
      .select('id')
      .single();

    if (transactionError || !transaction) {
      throw transactionError ?? new Error('No pudimos registrar el gasto asociado al pago.');
    }

    const { error: updateError } = await supabase
      .from('payment_calendar_items')
      .update({
        status: 'paid',
        category_id: finalCategoryId,
        paid_transaction_id: transaction.id,
      })
      .eq('id', item.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction.id,
      payment_calendar_item_id: item.id,
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function assertAccess(householdId: string, userId: string) {
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

async function softDeleteLinkedTransaction(transactionId: string | null) {
  if (!transactionId) return;

  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', transactionId)
    .is('deleted_at', null);

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
      action?: 'update' | 'delete';
      itemId?: string;
      description?: unknown;
      amountClp?: unknown;
      dueDate?: unknown;
      categoryId?: string | null;
    };

    if (!body.itemId) throw new Error('Pago programado requerido.');

    const { data: item, error: itemError } = await supabase
      .from('payment_calendar_items')
      .select('*')
      .eq('id', body.itemId)
      .maybeSingle();

    if (itemError || !item) {
      throw new Error('No encontramos ese pago programado.');
    }

    await assertAccess(item.household_id, user.id);

    if (body.action === 'delete') {
      if (item.recurring_source_id) {
        throw new Error('Este pago viene de una recurrencia. Gestiona esa recurrencia desde la sección Recurrencias.');
      }

      await softDeleteLinkedTransaction(item.paid_transaction_id);

      const { error: deleteError } = await supabase
        .from('payment_calendar_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const nextDescription = parseRequiredText(body.description, 'La descripcion');
    const nextAmount = parseAmount(body.amountClp);
    const nextDueDate = parseRequiredText(body.dueDate, 'La fecha de vencimiento');
    const nextCategoryId = body.categoryId ?? null;
    await assertCategory(item.household_id, nextCategoryId);

    const { data: updatedItem, error: updateError } = await supabase
      .from('payment_calendar_items')
      .update({
        description: nextDescription,
        amount_clp: nextAmount,
        due_date: nextDueDate,
        category_id: nextCategoryId,
      })
      .eq('id', item.id)
      .select('*')
      .single();

    if (updateError || !updatedItem) {
      throw updateError ?? new Error('No pudimos actualizar el pago programado.');
    }

    if (item.paid_transaction_id) {
      const { error: txError } = await supabase
        .from('transactions')
        .update({
          description: nextDescription,
          amount_clp: nextAmount,
          category_id: nextCategoryId,
        })
        .eq('id', item.paid_transaction_id)
        .is('deleted_at', null);

      if (txError) throw txError;
    }

    return new Response(JSON.stringify({ item: updatedItem }), {
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

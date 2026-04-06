import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { requireOperationalOwnerHouseholdId } from '../_shared/current-household.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ResetCounts = {
  transactions: number;
  payment_calendar_items: number;
  recurring_transactions: number;
  savings_goals: number;
  monthly_reviews: number;
  csv_imports: number;
  invitation_tokens: number;
};

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

async function countRows(table: string, householdId: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  if (error) throw error;
  return count ?? 0;
}

async function deleteRows(table: string, householdId: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('household_id', householdId);

  if (error) throw error;
}

async function writeAuditLog(userId: string, householdId: string, counts: ResetCounts) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      household_id: householdId,
      user_id: userId,
      action: 'household_data_reset',
      resource_type: 'household',
      resource_id: householdId,
      metadata: {
        reset_scope: 'operational_data_only',
        counts,
      },
    });

  if (error) {
    console.error('reset-household-data audit log failed', error);
    return false;
  }

  return true;
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

    const token = authHeader.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);
    const householdId = await requireOperationalOwnerHouseholdId(
      supabase,
      user.id,
      'Solo el owner puede reiniciar los datos del hogar.',
    );

    const counts: ResetCounts = {
      transactions: await countRows('transactions', householdId),
      payment_calendar_items: await countRows('payment_calendar_items', householdId),
      recurring_transactions: await countRows('recurring_transactions', householdId),
      savings_goals: await countRows('savings_goals', householdId),
      monthly_reviews: await countRows('monthly_reviews', householdId),
      csv_imports: await countRows('csv_imports', householdId),
      invitation_tokens: await countRows('invitation_tokens', householdId),
    };

    await deleteRows('payment_calendar_items', householdId);
    await deleteRows('transactions', householdId);
    await deleteRows('recurring_transactions', householdId);
    await deleteRows('savings_goals', householdId);
    await deleteRows('monthly_reviews', householdId);
    await deleteRows('csv_imports', householdId);
    await deleteRows('invitation_tokens', householdId);

    const auditLogged = await writeAuditLog(user.id, householdId, counts);

    return new Response(JSON.stringify({
      success: true,
      householdId,
      counts,
      auditLogged,
      preserved: [
        'household',
        'household_members',
        'subscription',
        'categories',
        'profile',
      ],
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

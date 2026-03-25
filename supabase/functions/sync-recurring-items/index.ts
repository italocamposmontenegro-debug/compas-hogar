import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getChileDateParts() {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(new Date());
  return {
    year: Number.parseInt(parts.find((part) => part.type === 'year')?.value || '2026', 10),
    month: Number.parseInt(parts.find((part) => part.type === 'month')?.value || '1', 10),
    day: Number.parseInt(parts.find((part) => part.type === 'day')?.value || '1', 10),
  };
}

function formatDueDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

    const { year, month, day } = getChileDateParts();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthStart = formatDueDate(year, month, 1);
    const monthEnd = formatDueDate(year, month, daysInMonth);

    const [recurringRes, existingRes] = await Promise.all([
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
    ]);

    if (recurringRes.error) throw recurringRes.error;
    if (existingRes.error) throw existingRes.error;

    const existingByRecurringAndDate = new Map<string, { id: string; status: string }>();
    for (const item of existingRes.data || []) {
      if (!item.recurring_source_id) continue;
      existingByRecurringAndDate.set(`${item.recurring_source_id}:${item.due_date}`, {
        id: item.id,
        status: item.status,
      });
    }

    const itemsToInsert = [];
    for (const recurring of recurringRes.data || []) {
      const dueDay = Math.min(recurring.day_of_month, daysInMonth);
      const dueDate = formatDueDate(year, month, dueDay);
      const existingKey = `${recurring.id}:${dueDate}`;
      if (existingByRecurringAndDate.has(existingKey)) continue;

      itemsToInsert.push({
        household_id: householdId,
        description: recurring.description,
        amount_clp: recurring.amount_clp,
        due_date: dueDate,
        status: dueDay < day ? 'overdue' : 'pending',
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
      created: itemsToInsert.length,
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { requireOperationalOwnerHouseholdId } from '../_shared/current-household.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'update' | 'remove';

function parseDisplayName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('El nombre visible es obligatorio.');
  }

  return value.trim().slice(0, 80);
}

function parseMonthlyIncome(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('El ingreso mensual debe ser un numero igual o mayor a 0.');
  }

  return parsed;
}

async function getOwnerHouseholdId(userId: string) {
  return requireOperationalOwnerHouseholdId(
    supabase,
    userId,
    'Solo el owner del hogar puede gestionar a su pareja.',
  );
}

async function getTargetMember(householdId: string, memberId: string) {
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .eq('id', memberId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No encontramos a ese miembro dentro del hogar.');
  }

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

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Unauthorized');

    const { action, memberId, displayName, monthlyIncome } = await req.json() as {
      action?: Action;
      memberId?: string;
      displayName?: unknown;
      monthlyIncome?: unknown;
    };

    if (!action) throw new Error('Accion requerida.');
    if (!memberId) throw new Error('Miembro requerido.');

    const householdId = await getOwnerHouseholdId(user.id);
    const targetMember = await getTargetMember(householdId, memberId);

    if (targetMember.role !== 'member') {
      throw new Error('No puedes editar ni sacar al owner del hogar.');
    }

    if (action === 'update') {
      const nextDisplayName = parseDisplayName(displayName);
      const nextMonthlyIncome = parseMonthlyIncome(monthlyIncome);

      const { data, error } = await supabase
        .from('household_members')
        .update({
          display_name: nextDisplayName,
          monthly_income: nextMonthlyIncome,
        })
        .eq('id', memberId)
        .eq('household_id', householdId)
        .eq('role', 'member')
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('No pudimos actualizar los datos de tu pareja.');
      }

      return new Response(JSON.stringify({ member: data }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (targetMember.invitation_status !== 'accepted') {
      throw new Error('Ese miembro ya no tiene acceso activo al hogar.');
    }

    const { data, error } = await supabase
      .from('household_members')
      .update({
        user_id: null,
        invitation_status: 'rejected',
      })
      .eq('id', memberId)
      .eq('household_id', householdId)
      .eq('role', 'member')
      .eq('invitation_status', 'accepted')
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('No pudimos sacar a tu pareja del hogar.');
    }

    const { error: revokePendingError } = await supabase
      .from('invitation_tokens')
      .update({ status: 'revoked' })
      .eq('household_id', householdId)
      .eq('invited_email', targetMember.email)
      .eq('status', 'pending');

    if (revokePendingError) throw revokePendingError;

    return new Response(JSON.stringify({ success: true, member: data }), {
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

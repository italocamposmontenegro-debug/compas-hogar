import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { requireOperationalHouseholdContext } from '../_shared/current-household.ts';
import { getHouseholdPlanTier } from '../_shared/entitlements.ts';
import { hasFeature } from '../../../shared/plans.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_SPLIT_RULES = new Set(['fifty_fifty', 'proportional', 'fixed_amount', 'custom_percent']);

function parseDisplayName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Tu nombre visible es obligatorio.');
  }

  return value.trim().slice(0, 80);
}

function parseHouseholdName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('El nombre del hogar es obligatorio.');
  }

  return value.trim().slice(0, 100);
}

function parseMonthlyIncome(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Tu ingreso mensual debe ser un numero igual o mayor a 0.');
  }

  return parsed;
}

function parseSplitRule(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'fifty_fifty';
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_SPLIT_RULES.has(normalized)) {
    throw new Error('La regla de reparto no es valida.');
  }

  return normalized;
}

async function getAcceptedMember(userId: string) {
  return requireOperationalHouseholdContext(supabase, userId);
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

    const {
      householdName,
      splitRule,
      displayName,
      monthlyIncome,
    } = await req.json() as {
      householdName?: unknown;
      splitRule?: unknown;
      displayName?: unknown;
      monthlyIncome?: unknown;
    };

    const member = await getAcceptedMember(user.id);
    const planTier = await getHouseholdPlanTier(supabase, member.householdId);
    const nextDisplayName = parseDisplayName(displayName);
    const nextMonthlyIncome = parseMonthlyIncome(monthlyIncome);

    const memberUpdate = await supabase
      .from('household_members')
      .update({
        display_name: nextDisplayName,
        monthly_income: nextMonthlyIncome,
      })
      .eq('id', member.membershipId)
      .select('id, display_name, monthly_income')
      .single();

    if (memberUpdate.error) {
      throw memberUpdate.error;
    }

    let householdUpdateData: Record<string, unknown> | null = null;

    if (member.role === 'owner') {
      const nextHouseholdName = parseHouseholdName(householdName);
      const requestedSplitRule = parseSplitRule(splitRule);
      const nextSplitRule = hasFeature(planTier, 'split_manual')
        ? requestedSplitRule
        : 'fifty_fifty';

      const householdUpdate = await supabase
        .from('households')
        .update({
          name: nextHouseholdName,
          split_rule_type: nextSplitRule,
        })
        .eq('id', member.householdId)
        .select('id, name, split_rule_type')
        .single();

      if (householdUpdate.error) {
        throw householdUpdate.error;
      }

      householdUpdateData = householdUpdate.data;
    }

    return new Response(JSON.stringify({
      household: householdUpdateData,
      member: memberUpdate.data,
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

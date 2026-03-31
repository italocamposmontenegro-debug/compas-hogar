import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  buildSubscriptionBackUrl,
  cancelMercadoPagoPreapproval,
  createPendingPreapproval,
  getMercadoPagoAccessToken,
  getMercadoPagoWebhookUrl,
  getSubscriptionPrice,
  normalizeBillingCycle,
  normalizePlanCode,
} from '../_shared/subscription.ts';
import { recordSubscriptionEvent } from '../_shared/subscription-events.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) throw new Error('Unauthorized');

    const { household_id, plan_code, billing_cycle } = await req.json();
    const normalizedPlan = normalizePlanCode(plan_code);
    const normalizedCycle = normalizeBillingCycle(billing_cycle);

    const { data: householdMember, error: memberError } = await supabase
      .from('household_members')
      .select('role')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .single();

    if (memberError || !householdMember || householdMember.role !== 'owner') {
      throw new Error('Solo el owner puede modificar la suscripcion.');
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('provider_subscription_id, status, provider, provider_account_label, current_period_start, current_period_end, trial_ends_at')
      .eq('household_id', household_id)
      .maybeSingle();

    if (subError) {
      throw subError;
    }

    const accessToken = getMercadoPagoAccessToken();
    const webhookUrl = getMercadoPagoWebhookUrl();
    const backUrl = buildSubscriptionBackUrl();
    const priceAmountClp = getSubscriptionPrice(normalizedPlan, normalizedCycle);
    const idempotencyKey = `${household_id}:${normalizedPlan}:${normalizedCycle}:switch`;

    if (sub?.provider_subscription_id) {
      await cancelMercadoPagoPreapproval(accessToken, sub.provider_subscription_id);
    }

    if (!user.email) {
      throw new Error('Usuario sin email');
    }

    const mpData = await createPendingPreapproval({
      accessToken,
      householdId: household_id,
      payerEmail: user.email,
      planCode: normalizedPlan,
      billingCycle: normalizedCycle,
      backUrl,
      webhookUrl,
      idempotencyKey,
    });

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('subscriptions')
      .upsert({
        household_id,
        provider: sub.provider ?? 'mercadopago',
        provider_account_label: sub.provider_account_label ?? 'mp_default',
        plan_code: normalizedPlan,
        billing_cycle: normalizedCycle,
        status: 'pending',
        migration_status: null,
        external_reference: household_id,
        provider_subscription_id: mpData.id ?? sub.provider_subscription_id,
        price_amount_clp: priceAmountClp,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        last_payment_status: mpData.status ?? 'pending',
        updated_at: now,
      }, { onConflict: 'household_id' });

    if (updateError) throw updateError;

    await recordSubscriptionEvent(supabase, {
      householdId: household_id,
      eventType: 'checkout_restarted',
      providerEventId: typeof mpData.id === 'string' ? mpData.id : null,
      metadata: {
        previous_provider_subscription_id: sub?.provider_subscription_id ?? null,
        plan_code: normalizedPlan,
        billing_cycle: normalizedCycle,
        provider_status: mpData.status ?? 'pending',
      },
    });

    return new Response(JSON.stringify({
      success: true,
      init_point: mpData.init_point,
      status: mpData.status ?? 'pending',
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

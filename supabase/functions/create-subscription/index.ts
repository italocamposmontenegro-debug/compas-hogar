import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  buildSubscriptionBackUrl,
  createPendingPreapproval,
  formatMercadoPagoError,
  getMercadoPagoAccessToken,
  getMercadoPagoWebhookUrl,
  getSubscriptionPrice,
  getSubscriptionProviderAccountLabel,
  normalizeBillingCycle,
  normalizePlanCode,
} from '../_shared/subscription.ts';

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
    if (!user.email) throw new Error('Usuario sin email');

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
      throw new Error('Solo el owner del hogar puede administrar la suscripcion.');
    }

    const accessToken = getMercadoPagoAccessToken();
    const webhookUrl = getMercadoPagoWebhookUrl();
    const priceAmountClp = getSubscriptionPrice(normalizedPlan, normalizedCycle);
    const backUrl = buildSubscriptionBackUrl();
    const idempotencyKey = `${household_id}:${normalizedPlan}:${normalizedCycle}`;
    let mpData: Record<string, unknown>;
    try {
      mpData = await createPendingPreapproval({
        accessToken,
        householdId: household_id,
        payerEmail: user.email,
        planCode: normalizedPlan,
        billingCycle: normalizedCycle,
        backUrl,
        webhookUrl,
        idempotencyKey,
      }) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error creando suscripcion en Mercado Pago';
      console.error('Mercado Pago preapproval error:', {
        household_id,
        plan_code: normalizedPlan,
        billing_cycle: normalizedCycle,
        message,
      });
      throw error;
    }

    if (typeof mpData.init_point !== 'string' || !mpData.init_point) {
      console.error('Mercado Pago preapproval missing init_point:', {
        household_id,
        plan_code: normalizedPlan,
        billing_cycle: normalizedCycle,
        response: mpData,
      });
      throw new Error(formatMercadoPagoError(400, { message: 'Mercado Pago no devolvio init_point' }));
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from('subscriptions').upsert(
      {
        household_id,
        provider: 'mercadopago',
        provider_account_label: getSubscriptionProviderAccountLabel(),
        plan_code: normalizedPlan,
        billing_cycle: normalizedCycle,
        status: 'pending',
        migration_status: null,
        external_reference: household_id,
        provider_subscription_id: mpData.id ?? null,
        price_amount_clp: priceAmountClp,
        current_period_start: null,
        current_period_end: null,
        last_payment_status: mpData.status ?? 'pending',
        trial_ends_at: null,
        updated_at: now,
      },
      { onConflict: 'household_id' },
    );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        id: mpData.id,
        init_point: mpData.init_point,
        status: mpData.status,
      }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('Create subscription error:', {
      message,
      error,
    });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : 400,
    });
  }
});

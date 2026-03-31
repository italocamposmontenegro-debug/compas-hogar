import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { buildSubscriptionManageUrl, getMercadoPagoAccessToken } from '../_shared/subscription.ts';
import { getHouseholdName, getHouseholdOwnerContact } from '../_shared/household.ts';
import { sendSubscriptionLifecycleEmail } from '../_shared/email.ts';
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

    const { household_id } = await req.json();

    const { data: householdMember, error: memberError } = await supabase
      .from('household_members')
      .select('role')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .single();

    if (memberError || !householdMember || householdMember.role !== 'owner') {
      throw new Error('Solo el owner del hogar puede cancelar la suscripcion.');
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('provider_subscription_id, provider, provider_account_label, plan_code, billing_cycle, price_amount_clp')
      .eq('household_id', household_id)
      .single();

    if (subError || !sub?.provider_subscription_id) {
      throw new Error('No se encontro una suscripcion de proveedor activa en la BD.');
    }

    const accessToken = getMercadoPagoAccessToken();

    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) throw new Error(mpData.message || 'Error cancelando el preapproval en MP');

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        provider: sub.provider ?? 'mercadopago',
        provider_account_label: sub.provider_account_label ?? 'mp_default',
        plan_code: sub.plan_code,
        billing_cycle: sub.billing_cycle,
        status: 'cancelled',
        provider_subscription_id: sub.provider_subscription_id,
        price_amount_clp: sub.price_amount_clp,
        last_payment_status: 'cancelled',
        updated_at: now,
      })
      .eq('household_id', household_id);

    if (updateError) throw updateError;

    await recordSubscriptionEvent(supabase, {
      householdId: household_id,
      eventType: 'subscription_cancelled',
      providerEventId: sub.provider_subscription_id,
      metadata: {
        provider: sub.provider,
        provider_account_label: sub.provider_account_label,
        plan_code: sub.plan_code,
        billing_cycle: sub.billing_cycle,
      },
    });

    const [householdName, ownerContact] = await Promise.all([
      getHouseholdName(supabase, household_id),
      getHouseholdOwnerContact(supabase, household_id),
    ]);

    if (ownerContact.email) {
      await sendSubscriptionLifecycleEmail({
        recipientEmail: ownerContact.email,
        householdName,
        planName: sub.plan_code === 'plus' ? 'Estratégico' : 'Esencial',
        billingCycleLabel: sub.billing_cycle === 'yearly' ? 'anual' : 'mensual',
        manageUrl: buildSubscriptionManageUrl(),
        type: 'cancelled',
      });
    }

    return new Response(JSON.stringify({ success: true, status: 'cancelled' }), {
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

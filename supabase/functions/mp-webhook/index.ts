import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  buildSubscriptionManageUrl,
  getMercadoPagoAccessToken,
  mapMercadoPagoSubscriptionStatus,
} from '../_shared/subscription.ts';
import { getHouseholdName, getHouseholdOwnerContact } from '../_shared/household.ts';
import { sendSubscriptionLifecycleEmail } from '../_shared/email.ts';
import { recordSubscriptionEvent } from '../_shared/subscription-events.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchMercadoPagoJson(accessToken: string, path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      (typeof payload?.message === 'string' && payload.message)
      || `Mercado Pago request failed for ${path}`;
    throw new Error(message);
  }

  return payload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  const now = new Date().toISOString();

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => null);

    const action = url.searchParams.get('data.id')
      || url.searchParams.get('id')
      || body?.data?.id
      || body?.id
      || null;

    const type = url.searchParams.get('type')
      || url.searchParams.get('topic')
      || body?.type
      || body?.topic
      || null;

    const externalEventId = `${type || 'unknown'}:${action || 'unknown'}`;

    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        provider: 'mercadopago',
        external_event_id: externalEventId,
        event_type: type || 'unknown',
        resource_id: action,
        payload_raw: body ?? {},
        processing_status: 'received',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response('Already processed', { status: 200, headers: CORS_HEADERS });
      }
      throw insertError;
    }

    const normalizedType = type?.toLowerCase() ?? '';
    const isPreapprovalEvent = Boolean(action) && normalizedType.includes('preapproval');
    const isAuthorizedPaymentEvent = Boolean(action) && normalizedType.includes('authorized_payment');

    if (!isPreapprovalEvent && !isAuthorizedPaymentEvent) {
      await supabase
        .from('webhook_events')
        .update({ processing_status: 'skipped', processed_at: now })
        .eq('id', webhookEvent.id);

      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const accessToken = getMercadoPagoAccessToken();
    let preapprovalId = action;
    if (isAuthorizedPaymentEvent) {
      const authorizedPayment = await fetchMercadoPagoJson(accessToken, `/authorized_payments/${action}`);
      if (!authorizedPayment?.preapproval_id || typeof authorizedPayment.preapproval_id !== 'string') {
        throw new Error('Mercado Pago no devolvió preapproval_id para el authorized payment');
      }
      preapprovalId = authorizedPayment.preapproval_id;
    }

    const preapprovalData = await fetchMercadoPagoJson(accessToken, `/preapproval/${preapprovalId}`);
    const resolvedHouseholdId = preapprovalData.external_reference || null;
    const mpStatus = preapprovalData.status || 'pending';
    const newStatus = mapMercadoPagoSubscriptionStatus(mpStatus);

    const { data: subscriptionByProviderId } = preapprovalId
      ? await supabase.from('subscriptions').select('*').eq('provider_subscription_id', preapprovalId).maybeSingle()
      : { data: null };

    const { data: existingSubscription } = resolvedHouseholdId
      ? await supabase.from('subscriptions').select('*').eq('household_id', resolvedHouseholdId).maybeSingle()
      : { data: null };

    const subscriptionRow = subscriptionByProviderId
      ?? (
        existingSubscription
        && (!existingSubscription.provider_subscription_id || existingSubscription.provider_subscription_id === preapprovalId)
          ? existingSubscription
          : null
      );

    if (!subscriptionRow && resolvedHouseholdId && existingSubscription?.provider_subscription_id && existingSubscription.provider_subscription_id !== preapprovalId) {
      await supabase
        .from('webhook_events')
        .update({ processing_status: 'skipped', processed_at: now })
        .eq('id', webhookEvent.id);

      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'stale_subscription_event' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const householdId = resolvedHouseholdId || subscriptionRow?.household_id || null;

    if (!householdId) {
      throw new Error('No se pudo resolver el hogar asociado al webhook');
    }

    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert(
        {
          household_id: householdId,
          provider: subscriptionRow?.provider ?? 'mercadopago',
          provider_account_label: subscriptionRow?.provider_account_label ?? 'mp_default',
          plan_code: subscriptionRow?.plan_code ?? 'base',
          billing_cycle: subscriptionRow?.billing_cycle ?? 'monthly',
          status: newStatus,
          migration_status: subscriptionRow?.migration_status ?? null,
          external_reference: householdId,
          provider_subscription_id: preapprovalData.id ?? preapprovalId,
          price_amount_clp: subscriptionRow?.price_amount_clp ?? 0,
          current_period_start: subscriptionRow?.current_period_start ?? null,
          current_period_end: subscriptionRow?.current_period_end ?? null,
          last_payment_status: mpStatus,
          trial_ends_at: subscriptionRow?.trial_ends_at ?? null,
          updated_at: now,
        },
        { onConflict: 'household_id' },
      );

    if (subErr) throw subErr;

    await recordSubscriptionEvent(supabase, {
      householdId,
      eventType: `webhook_${newStatus}`,
      providerEventId: preapprovalId,
      metadata: {
        resource_type: normalizedType,
        provider_status: mpStatus,
        provider_subscription_id: preapprovalData.id ?? preapprovalId,
      },
    });

    if (newStatus === 'active' || newStatus === 'failed') {
      const [householdName, ownerContact] = await Promise.all([
        getHouseholdName(supabase, householdId),
        getHouseholdOwnerContact(supabase, householdId),
      ]);

      if (ownerContact.email) {
        await sendSubscriptionLifecycleEmail({
          recipientEmail: ownerContact.email,
          householdName,
          planName: (subscriptionRow?.plan_code ?? 'base') === 'plus' ? 'Estratégico' : 'Esencial',
          billingCycleLabel: (subscriptionRow?.billing_cycle ?? 'monthly') === 'yearly' ? 'anual' : 'mensual',
          manageUrl: buildSubscriptionManageUrl(),
          type: newStatus === 'active' ? 'activated' : 'payment_issue',
        });
      }
    }

    await supabase
      .from('webhook_events')
      .update({ processing_status: 'processed', processed_at: now })
      .eq('id', webhookEvent.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

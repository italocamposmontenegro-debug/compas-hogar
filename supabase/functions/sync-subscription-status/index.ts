import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  getMercadoPagoAccessToken,
  mapMercadoPagoSubscriptionStatus,
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

    const { household_id } = await req.json();
    if (!household_id || typeof household_id !== 'string') {
      throw new Error('household_id es obligatorio');
    }

    const { data: member, error: memberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    if (memberError || !member) {
      throw new Error('No tienes acceso a este hogar.');
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('household_id', household_id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (!subscription?.provider_subscription_id) {
      throw new Error('No se encontró una suscripción para sincronizar.');
    }

    const accessToken = getMercadoPagoAccessToken();
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${subscription.provider_subscription_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const mpData = await mpResp.json().catch(() => null) as Record<string, unknown> | null;
    if (!mpResp.ok) {
      const message =
        (typeof mpData?.message === 'string' && mpData.message)
        || 'No se pudo consultar la suscripción en Mercado Pago';
      throw new Error(message);
    }

    const providerStatus = typeof mpData?.status === 'string' ? mpData.status : 'pending';
    const localStatus = mapMercadoPagoSubscriptionStatus(providerStatus);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: localStatus,
        last_payment_status: providerStatus,
        provider_subscription_id:
          typeof mpData?.id === 'string'
            ? mpData.id
            : subscription.provider_subscription_id,
        external_reference:
          typeof mpData?.external_reference === 'string'
            ? mpData.external_reference
            : subscription.external_reference,
        updated_at: now,
      })
      .eq('household_id', household_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      status: localStatus,
      provider_status: providerStatus,
      provider_subscription_id: typeof mpData?.id === 'string' ? mpData.id : subscription.provider_subscription_id,
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function asString(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      throw new Error('Forbidden');
    }

    const [
      profilesCount,
      householdsCount,
      activeSubscriptionsCount,
      pendingSubscriptionsCount,
      failedSubscriptionsCount,
      householdsRes,
      membersRes,
      subscriptionsRes,
      webhookEventsRes,
      subscriptionEventsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('households').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('households').select('id, name, created_at, updated_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('household_members').select('household_id, role, display_name, email, invitation_status, created_at'),
      supabase.from('subscriptions').select('id, household_id, plan_code, billing_cycle, status, price_amount_clp, updated_at, provider_subscription_id').order('updated_at', { ascending: false }),
      supabase.from('webhook_events').select('id, event_type, resource_id, processing_status, processing_error, received_at').order('received_at', { ascending: false }).limit(12),
      supabase.from('subscription_events').select('id, subscription_id, event_type, provider_event_id, created_at, metadata').order('created_at', { ascending: false }).limit(12),
    ]);

    if (householdsRes.error) throw householdsRes.error;
    if (membersRes.error) throw membersRes.error;
    if (subscriptionsRes.error) throw subscriptionsRes.error;
    if (webhookEventsRes.error) throw webhookEventsRes.error;
    if (subscriptionEventsRes.error) throw subscriptionEventsRes.error;

    const households = (householdsRes.data ?? []) as Array<Record<string, unknown>>;
    const householdIds = households.map((row) => String(row.id));
    const householdById = new Map(households.map((row) => [String(row.id), row]));

    const members = ((membersRes.data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => householdIds.includes(String(row.household_id)));
    const subscriptions = ((subscriptionsRes.data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => householdIds.includes(String(row.household_id)));

    const subscriptionByHousehold = new Map(
      subscriptions.map((row) => [String(row.household_id), row]),
    );

    const rows = households.map((household) => {
      const householdId = String(household.id);
      const acceptedMembers = members.filter(
        (member) => String(member.household_id) === householdId && member.invitation_status === 'accepted',
      );
      const owner = acceptedMembers.find((member) => member.role === 'owner');
      const subscription = subscriptionByHousehold.get(householdId);

      return {
        household_id: householdId,
        household_name: asString(household.name),
        created_at: asString(household.created_at),
        updated_at: asString(household.updated_at),
        members_count: acceptedMembers.length,
        owner_name: asString(owner?.display_name),
        owner_email: asString(owner?.email),
        plan_code: asString(subscription?.plan_code, 'free'),
        billing_cycle: asString(subscription?.billing_cycle, '—'),
        subscription_status: asString(subscription?.status, 'free'),
        price_amount_clp: typeof subscription?.price_amount_clp === 'number' ? subscription.price_amount_clp : 0,
        provider_subscription_id: asString(subscription?.provider_subscription_id),
      };
    });

    const subscriptionIds = subscriptions.map((row) => String(row.id));
    const subscriptionById = new Map(
      subscriptions.map((row) => [String(row.id), row]),
    );

    const recentSubscriptionEvents = ((subscriptionEventsRes.data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => subscriptionIds.includes(String(row.subscription_id)))
      .map((row) => {
        const subscription = subscriptionById.get(String(row.subscription_id));
        const household = subscription ? householdById.get(String(subscription.household_id)) : null;

        return {
          id: asString(row.id),
          event_type: asString(row.event_type),
          provider_event_id: asString(row.provider_event_id),
          created_at: asString(row.created_at),
          household_name: asString(household?.name),
          subscription_status: asString(subscription?.status),
          plan_code: asString(subscription?.plan_code),
        };
      });

    return new Response(JSON.stringify({
      summary: {
        profiles: profilesCount.count ?? 0,
        households: householdsCount.count ?? 0,
        active_subscriptions: activeSubscriptionsCount.count ?? 0,
        pending_subscriptions: pendingSubscriptionsCount.count ?? 0,
        failed_subscriptions: failedSubscriptionsCount.count ?? 0,
      },
      households: rows,
      webhook_events: webhookEventsRes.data ?? [],
      subscription_events: recentSubscriptionEvents,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400,
    });
  }
});

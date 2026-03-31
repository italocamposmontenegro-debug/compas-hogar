type SupabaseAdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
    insert: (value: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

interface SubscriptionEventPayload {
  householdId: string;
  eventType: string;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordSubscriptionEvent(
  supabase: SupabaseAdminClient,
  payload: SubscriptionEventPayload,
) {
  try {
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('household_id', payload.householdId)
      .maybeSingle();

    if (subscriptionError || !subscription?.id) {
      console.warn('[subscription-events] skipping event because subscription was not found', {
        householdId: payload.householdId,
        eventType: payload.eventType,
        error: subscriptionError,
      });
      return;
    }

    const { error: insertError } = await supabase
      .from('subscription_events')
      .insert({
        subscription_id: subscription.id,
        event_type: payload.eventType,
        provider_event_id: payload.providerEventId ?? null,
        metadata: payload.metadata ?? {},
      });

    if (insertError) {
      console.warn('[subscription-events] failed to insert subscription event', {
        householdId: payload.householdId,
        eventType: payload.eventType,
        error: insertError,
      });
    }
  } catch (error) {
    console.warn('[subscription-events] unexpected error while inserting event', {
      householdId: payload.householdId,
      eventType: payload.eventType,
      error,
    });
  }
}

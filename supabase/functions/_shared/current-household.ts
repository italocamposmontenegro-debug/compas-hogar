import {
  resolveOperationalHousehold,
  type HouseholdResolutionCandidate,
} from '../../../shared/household-resolution.ts';

type SupabaseQueryResult = Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;

type SupabaseFilterChain = {
  eq: (column: string, value: string) => SupabaseFilterChain;
  order: (column: string, options: { ascending: boolean }) => SupabaseQueryResult;
};

type SupabaseSelectChain = {
  eq: (column: string, value: string) => SupabaseFilterChain;
  in: (column: string, values: string[]) => SupabaseQueryResult;
};

type SupabaseAdminClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseSelectChain;
  };
};

export interface OperationalHouseholdContext extends HouseholdResolutionCandidate {
  acceptedHouseholdCount: number;
  activeHouseholdCount: number;
  resolutionReason: 'single_active_subscription' | 'single_accepted_membership';
}

async function loadAcceptedMembershipCandidates(
  supabase: SupabaseAdminClient,
  userId: string,
): Promise<HouseholdResolutionCandidate[]> {
  const membershipQuery = supabase
    .from('household_members')
    .select('id, household_id, role, display_name, email, monthly_income')
    .eq('user_id', userId)
    .eq('invitation_status', 'accepted')
    .order('created_at', { ascending: true });

  const membershipResult = await membershipQuery as { data: Record<string, unknown>[] | null; error: unknown };

  if (membershipResult.error) throw membershipResult.error;
  const membershipData = membershipResult.data ?? [];

  if (membershipData.length === 0) {
    return [];
  }

  const householdIds = [...new Set(membershipData
    .map((member) => typeof member.household_id === 'string' ? member.household_id : null)
    .filter((value): value is string => !!value))];

  if (householdIds.length === 0) {
    return [];
  }

  const [{ data: households, error: householdsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase
      .from('households')
      .select('id, name')
      .in('id', householdIds),
    supabase
      .from('subscriptions')
      .select('id, household_id, status, plan_code, billing_cycle')
      .in('household_id', householdIds),
  ]);

  if (householdsError) throw householdsError;
  if (subscriptionsError) throw subscriptionsError;

  const householdMap = new Map(
    (households ?? []).map((household) => [String(household.id), household]),
  );
  const subscriptionMap = new Map(
    (subscriptions ?? []).map((subscription) => [String(subscription.household_id), subscription]),
  );

  return membershipData.map((member) => {
    const householdId = String(member.household_id);
    const household = householdMap.get(householdId);
    const subscription = subscriptionMap.get(householdId);

    return {
      membershipId: String(member.id),
      householdId,
      role: member.role === 'owner' ? 'owner' : 'member',
      displayName: typeof member.display_name === 'string' ? member.display_name : '',
      email: typeof member.email === 'string' ? member.email : '',
      monthlyIncome: Number(member.monthly_income ?? 0),
      householdName: typeof household?.name === 'string' ? household.name : null,
      subscriptionId: typeof subscription?.id === 'string' ? subscription.id : null,
      subscriptionStatus: typeof subscription?.status === 'string' ? subscription.status : null,
      subscriptionPlanCode: typeof subscription?.plan_code === 'string' ? subscription.plan_code : null,
      subscriptionBillingCycle: typeof subscription?.billing_cycle === 'string' ? subscription.billing_cycle : null,
    };
  });
}

export async function requireOperationalHouseholdContext(
  supabase: SupabaseAdminClient,
  userId: string,
): Promise<OperationalHouseholdContext> {
  const candidates = await loadAcceptedMembershipCandidates(supabase, userId);
  const resolution = resolveOperationalHousehold(candidates);

  if (resolution.status === 'none') {
    throw new Error('No encontramos tu hogar activo.');
  }

  if (resolution.status === 'inconsistent') {
    throw new Error(resolution.message);
  }

  return {
    ...resolution.candidate,
    acceptedHouseholdCount: resolution.acceptedHouseholdCount,
    activeHouseholdCount: resolution.activeHouseholdCount,
    resolutionReason: resolution.reason,
  };
}

export async function requireOperationalOwnerHouseholdId(
  supabase: SupabaseAdminClient,
  userId: string,
  ownerErrorMessage: string,
): Promise<string> {
  const context = await requireOperationalHouseholdContext(supabase, userId);

  if (context.role !== 'owner') {
    throw new Error(ownerErrorMessage);
  }

  return context.householdId;
}

export async function listAcceptedHouseholdIds(
  supabase: SupabaseAdminClient,
  userId: string,
): Promise<string[]> {
  const candidates = await loadAcceptedMembershipCandidates(supabase, userId);
  return candidates.map((candidate) => candidate.householdId);
}

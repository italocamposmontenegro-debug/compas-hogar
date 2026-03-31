export type HouseholdResolutionReason =
  | 'no_accepted_membership'
  | 'single_active_subscription'
  | 'single_accepted_membership'
  | 'multiple_active_households'
  | 'multiple_accepted_households';

export interface HouseholdResolutionCandidate {
  membershipId: string;
  householdId: string;
  role: 'owner' | 'member';
  displayName: string;
  email: string;
  monthlyIncome: number;
  householdName: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlanCode: string | null;
  subscriptionBillingCycle: string | null;
}

export type HouseholdResolutionResult =
  | {
    status: 'none';
    reason: 'no_accepted_membership';
    acceptedHouseholdCount: 0;
    activeHouseholdCount: 0;
    message: null;
  }
  | {
    status: 'resolved';
    reason: 'single_active_subscription' | 'single_accepted_membership';
    acceptedHouseholdCount: number;
    activeHouseholdCount: number;
    candidate: HouseholdResolutionCandidate;
    message: null;
  }
  | {
    status: 'inconsistent';
    reason: 'multiple_active_households' | 'multiple_accepted_households';
    acceptedHouseholdCount: number;
    activeHouseholdCount: number;
    message: string;
  };

export function resolveOperationalHousehold(
  candidates: HouseholdResolutionCandidate[],
): HouseholdResolutionResult {
  if (candidates.length === 0) {
    return {
      status: 'none',
      reason: 'no_accepted_membership',
      acceptedHouseholdCount: 0,
      activeHouseholdCount: 0,
      message: null,
    };
  }

  const activeCandidates = candidates.filter((candidate) => candidate.subscriptionStatus === 'active');

  if (activeCandidates.length > 1) {
    return {
      status: 'inconsistent',
      reason: 'multiple_active_households',
      acceptedHouseholdCount: candidates.length,
      activeHouseholdCount: activeCandidates.length,
      message:
        'Tu cuenta tiene más de un hogar con suscripción activa. Compás Hogar v1 admite un solo hogar operativo por usuario.',
    };
  }

  if (activeCandidates.length === 1) {
    return {
      status: 'resolved',
      reason: 'single_active_subscription',
      acceptedHouseholdCount: candidates.length,
      activeHouseholdCount: 1,
      candidate: activeCandidates[0],
      message: null,
    };
  }

  if (candidates.length === 1) {
    return {
      status: 'resolved',
      reason: 'single_accepted_membership',
      acceptedHouseholdCount: 1,
      activeHouseholdCount: 0,
      candidate: candidates[0],
      message: null,
    };
  }

  return {
    status: 'inconsistent',
    reason: 'multiple_accepted_households',
    acceptedHouseholdCount: candidates.length,
    activeHouseholdCount: 0,
    message:
      'Tu cuenta tiene más de un hogar aceptado. Compás Hogar v1 admite un solo hogar operativo por usuario.',
  };
}

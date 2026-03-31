import assert from 'node:assert/strict';
import {
  resolveOperationalHousehold,
  type HouseholdResolutionCandidate,
} from '../shared/household-resolution.ts';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function candidate(overrides: Partial<HouseholdResolutionCandidate>): HouseholdResolutionCandidate {
  return {
    membershipId: overrides.membershipId ?? crypto.randomUUID(),
    householdId: overrides.householdId ?? crypto.randomUUID(),
    role: overrides.role ?? 'member',
    displayName: overrides.displayName ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
    monthlyIncome: overrides.monthlyIncome ?? 0,
    householdName: overrides.householdName ?? 'Hogar demo',
    subscriptionId: overrides.subscriptionId ?? null,
    subscriptionStatus: overrides.subscriptionStatus ?? null,
    subscriptionPlanCode: overrides.subscriptionPlanCode ?? null,
    subscriptionBillingCycle: overrides.subscriptionBillingCycle ?? null,
  };
}

run('returns none when the user has no accepted households', () => {
  const resolution = resolveOperationalHousehold([]);
  assert.equal(resolution.status, 'none');
  assert.equal(resolution.reason, 'no_accepted_membership');
});

run('prefers the single accepted household with an active subscription', () => {
  const resolution = resolveOperationalHousehold([
    candidate({
      householdId: 'free-household',
      role: 'owner',
      subscriptionStatus: 'inactive',
      subscriptionPlanCode: 'base',
    }),
    candidate({
      householdId: 'premium-household',
      role: 'member',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'plus',
    }),
  ]);

  assert.equal(resolution.status, 'resolved');
  if (resolution.status !== 'resolved') {
    throw new Error('Expected a resolved household.');
  }

  assert.equal(resolution.reason, 'single_active_subscription');
  assert.equal(resolution.candidate.householdId, 'premium-household');
});

run('uses the only accepted household when there is no active subscription', () => {
  const resolution = resolveOperationalHousehold([
    candidate({
      householdId: 'single-household',
      role: 'owner',
      subscriptionStatus: 'inactive',
      subscriptionPlanCode: 'base',
    }),
  ]);

  assert.equal(resolution.status, 'resolved');
  if (resolution.status !== 'resolved') {
    throw new Error('Expected a resolved household.');
  }

  assert.equal(resolution.reason, 'single_accepted_membership');
  assert.equal(resolution.candidate.householdId, 'single-household');
});

run('flags multiple accepted households without a unique active subscription as inconsistent', () => {
  const resolution = resolveOperationalHousehold([
    candidate({ householdId: 'household-a', subscriptionStatus: 'inactive' }),
    candidate({ householdId: 'household-b', subscriptionStatus: 'inactive' }),
  ]);

  assert.equal(resolution.status, 'inconsistent');
  if (resolution.status !== 'inconsistent') {
    throw new Error('Expected an inconsistent household context.');
  }

  assert.equal(resolution.reason, 'multiple_accepted_households');
});

run('flags multiple active households as inconsistent', () => {
  const resolution = resolveOperationalHousehold([
    candidate({ householdId: 'household-a', subscriptionStatus: 'active', subscriptionPlanCode: 'plus' }),
    candidate({ householdId: 'household-b', subscriptionStatus: 'active', subscriptionPlanCode: 'plus' }),
  ]);

  assert.equal(resolution.status, 'inconsistent');
  if (resolution.status !== 'inconsistent') {
    throw new Error('Expected an inconsistent household context.');
  }

  assert.equal(resolution.reason, 'multiple_active_households');
});

console.log('All household resolution tests passed.');

import assert from 'node:assert/strict';
import {
  COMMERCIAL_PLAN_INFO,
  COMMERCIAL_PLAN_ORDER,
  PLAN_LIMITS,
  canCreateGoal,
  getCommercialPlanInfo,
  getFeatureRequiredPlan,
  getFeatureUpgradeCopy,
  getPlanName,
  getPlanCapabilities,
  hasFeature,
  mapBillingPlanCodeToTier,
  mapTierToCommercialPlan,
  resolvePlanTier,
} from '../shared/plans.ts';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('resolvePlanTier maps active subscriptions into app tiers', () => {
  assert.equal(resolvePlanTier(null), 'free');
  assert.equal(resolvePlanTier({ status: 'pending', plan_code: 'base' }), 'free');
  assert.equal(resolvePlanTier({ status: 'active', plan_code: 'base' }), 'essential');
  assert.equal(resolvePlanTier({ status: 'active', plan_code: 'plus' }), 'strategic');
  assert.equal(resolvePlanTier({ status: 'active', plan_code: 'admin' }), 'strategic');
});

run('mapBillingPlanCodeToTier keeps billing codes isolated from app tiers', () => {
  assert.equal(mapBillingPlanCodeToTier('base'), 'essential');
  assert.equal(mapBillingPlanCodeToTier('plus'), 'strategic');
  assert.equal(mapBillingPlanCodeToTier('admin'), 'strategic');
  assert.equal(mapBillingPlanCodeToTier(null), 'free');
});

run('commercial plan layer exposes only free and premium while preserving internal compatibility', () => {
  assert.deepEqual(COMMERCIAL_PLAN_ORDER, ['free', 'premium']);
  assert.equal(COMMERCIAL_PLAN_INFO.free.billingPlanCode, null);
  assert.equal(COMMERCIAL_PLAN_INFO.premium.billingPlanCode, 'plus');
  assert.equal(mapTierToCommercialPlan('free'), 'free');
  assert.equal(mapTierToCommercialPlan('essential'), 'premium');
  assert.equal(mapTierToCommercialPlan('strategic'), 'premium');
  assert.equal(getPlanName('essential'), 'Premium');
  assert.equal(getPlanName('strategic'), 'Premium');
  assert.equal(getCommercialPlanInfo('premium').prices.monthly, 4990);
});

run('hasFeature enforces free, essential and strategic boundaries', () => {
  assert.equal(hasFeature('free', 'categories_custom'), false);
  assert.equal(hasFeature('essential', 'categories_custom'), true);
  assert.equal(hasFeature('essential', 'csv_import'), false);
  assert.equal(hasFeature('strategic', 'csv_import'), true);
});

run('getFeatureRequiredPlan and upgrade copy point to the correct tier', () => {
  assert.equal(getFeatureRequiredPlan('categories_custom'), 'essential');
  assert.equal(getFeatureRequiredPlan('csv_import'), 'strategic');

  const essentialUpgrade = getFeatureUpgradeCopy('categories_custom');
  assert.equal(essentialUpgrade.requiredPlan, 'essential');
  assert.equal(essentialUpgrade.commercialPlan, 'premium');
  assert.equal(essentialUpgrade.badge, 'Disponible en Premium');
  assert.equal(essentialUpgrade.actionLabel, 'Desbloquear Premium');
  assert.match(essentialUpgrade.route, /plan=premium/);

  const strategicUpgrade = getFeatureUpgradeCopy('recommendations');
  assert.equal(strategicUpgrade.requiredPlan, 'strategic');
  assert.equal(strategicUpgrade.commercialPlan, 'premium');
  assert.match(strategicUpgrade.route, /plan=premium/);
});

run('free plan keeps a single active goal limit', () => {
  assert.equal(PLAN_LIMITS.free.maxGoals, 1);
  assert.equal(canCreateGoal('free', 0), true);
  assert.equal(canCreateGoal('free', 1), false);
  assert.equal(canCreateGoal('essential', 10), true);
});

run('getPlanCapabilities exposes centralized flags and limits', () => {
  const freeCapabilities = getPlanCapabilities('free');
  assert.equal(freeCapabilities.limits.maxMembers, 2);
  assert.equal(freeCapabilities.features.dashboard_basic, true);
  assert.equal(freeCapabilities.features.dashboard_full, false);
});

console.log('All plan entitlement tests passed.');

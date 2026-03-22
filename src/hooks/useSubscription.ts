// ============================================
// Casa Clara — useSubscription hook
// ============================================

import { useHousehold } from './useHousehold';
import { getSubscriptionCTA, hasFeatureAccess, type Feature, type PlanCode, type SubscriptionStatus } from '../lib/constants';

export interface UseSubscriptionResult {
  status: SubscriptionStatus | null;
  planCode: PlanCode | null;
  billingCycle: 'monthly' | 'yearly' | null;
  isActive: boolean;
  isRestricted: boolean;
  canWrite: boolean;
  canUsePlus: boolean;
  hasFeature: (feature: Feature) => boolean;
  ctaMessage: string;
  ctaAction: string;
  ctaRoute: string;
}

export function useSubscription(): UseSubscriptionResult {
  const { subscription } = useHousehold();

  const status = (subscription?.status as SubscriptionStatus) ?? null;
  const planCode = (subscription?.plan_code as PlanCode) ?? null;
  const billingCycle = subscription?.billing_cycle ?? null;
  const isActive = status === 'active';
  const isRestricted = !isActive;
  const canWrite = isActive;
  const canUsePlus = isActive && (planCode === 'plus' || planCode === 'admin');

  const cta = getSubscriptionCTA(status);

  return {
    status,
    planCode,
    billingCycle,
    isActive,
    isRestricted,
    canWrite,
    canUsePlus,
    hasFeature: (feature: Feature) => isActive && hasFeatureAccess(planCode, feature),
    ctaMessage: cta.message,
    ctaAction: cta.action,
    ctaRoute: cta.route,
  };
}

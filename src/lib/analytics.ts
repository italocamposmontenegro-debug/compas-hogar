export type AnalyticsEventName =
  | 'landing_cta_primary_click'
  | 'landing_cta_plans_click'
  | 'landing_cta_example_click'
  | 'signup_started'
  | 'signup_completed'
  | 'household_created'
  | 'first_session_started'
  | 'onboarding_completed'
  | 'first_transaction_created'
  | 'first_income_created'
  | 'first_shared_expense_created'
  | 'first_goal_created'
  | 'partner_invite_sent'
  | 'partner_invite_accepted'
  | 'premium_viewed'
  | 'subscription_page_viewed'
  | 'limit_reached_viewed'
  | 'upgrade_cta_clicked'
  | 'checkout_started'
  | 'upgrade_completed';

type AnalyticsPayload = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function getStorage(kind: 'local' | 'session') {
  if (typeof window === 'undefined') return null;
  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

export function trackEvent(event: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;

  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(entry);
  window.dispatchEvent(new CustomEvent('compas-hogar:analytics', { detail: entry }));

  if (import.meta.env.DEV) {
    console.info('[analytics]', entry);
  }
}

export function trackOnce(
  storageKey: string,
  event: AnalyticsEventName,
  payload: AnalyticsPayload = {},
  storage: 'local' | 'session' = 'session',
) {
  const target = getStorage(storage);
  if (!target) return;

  const composedKey = `compas-hogar:${storageKey}`;
  if (target.getItem(composedKey)) return;

  trackEvent(event, payload);
  target.setItem(composedKey, '1');
}

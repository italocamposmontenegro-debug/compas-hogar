export type PlanCode = 'base' | 'plus';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'pending' | 'cancelled' | 'expired' | 'failed' | 'inactive';
export type MercadoPagoAutoRecurring = {
  frequency: number;
  frequency_type: 'months';
  transaction_amount: number;
  currency_id: 'CLP';
};
export type MercadoPagoPreapprovalResponse = {
  id?: string;
  init_point?: string;
  status?: string;
  external_reference?: string;
};

const APP_NAME = 'Compás Hogar';

const PLAN_PRICES: Record<PlanCode, Record<BillingCycle, number>> = {
  base: {
    monthly: 2990,
    yearly: 29900,
  },
  plus: {
    monthly: 4990,
    yearly: 49900,
  },
};

export function normalizePlanCode(value: string): PlanCode {
  if (value === 'base' || value === 'plus') return value;
  throw new Error(`Invalid plan code: ${value}`);
}

export function normalizeBillingCycle(value: string): BillingCycle {
  if (value === 'monthly' || value === 'yearly') return value;
  throw new Error(`Invalid billing cycle: ${value}`);
}

export function getPlanEnvKey(planCode: PlanCode, billingCycle: BillingCycle) {
  return `MP_PLAN_${planCode.toUpperCase()}_${billingCycle.toUpperCase()}`;
}

export function getMercadoPagoPlanId(planCode: PlanCode, billingCycle: BillingCycle): string {
  const envKey = getPlanEnvKey(planCode, billingCycle);
  const planId = Deno.env.get(envKey);

  if (!planId) {
    throw new Error(`Missing Mercado Pago plan config: ${envKey}`);
  }

  return planId;
}

export function getMercadoPagoAccessToken() {
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? Deno.env.get('MP_ACCESS_TOKEN_SANDBOX');

  if (!token) {
    throw new Error('Missing Mercado Pago access token');
  }

  return token;
}

export function getSubscriptionPrice(planCode: PlanCode, billingCycle: BillingCycle) {
  return PLAN_PRICES[planCode][billingCycle];
}

export function getSubscriptionFrequency(planCode: PlanCode, billingCycle: BillingCycle) {
  void planCode;
  return billingCycle === 'monthly' ? 1 : 12;
}

export function buildSubscriptionReason(planCode: PlanCode, billingCycle: BillingCycle) {
  const planLabel = planCode === 'base' ? 'Base' : 'Plus';
  const cycleLabel = billingCycle === 'monthly' ? 'mensual' : 'anual';
  return `${APP_NAME} ${planLabel} ${cycleLabel}`;
}

function normalizeUrl(rawValue: string) {
  const url = new URL(rawValue);
  return url.toString().replace(/\/$/, '');
}

export function getAppBaseUrl() {
  const baseUrl = Deno.env.get('APP_BASE_URL');
  if (!baseUrl) return null;

  try {
    return normalizeUrl(baseUrl);
  } catch {
    throw new Error('APP_BASE_URL no es válida');
  }
}

export function buildSubscriptionManageUrl() {
  const appBaseUrl = getAppBaseUrl();
  if (appBaseUrl) {
    return new URL('/app/suscripcion', appBaseUrl).toString();
  }

  return 'http://localhost:5173/app/suscripcion';
}

export function mapMercadoPagoSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case 'authorized':
    case 'approved':
    case 'active':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'paused':
      return 'inactive';
    case 'expired':
      return 'expired';
    case 'rejected':
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

export function buildAutoRecurring(planCode: PlanCode, billingCycle: BillingCycle): MercadoPagoAutoRecurring {
  return {
    frequency: getSubscriptionFrequency(planCode, billingCycle),
    frequency_type: 'months',
    transaction_amount: getSubscriptionPrice(planCode, billingCycle),
    currency_id: 'CLP',
  };
}

export function getSubscriptionProviderAccountLabel() {
  return Deno.env.get('MP_ACCOUNT_LABEL') ?? 'mp_default';
}

export function buildSubscriptionBackUrl() {
  const returnUrl = Deno.env.get('MP_BACK_URL');
  if (returnUrl) {
    const url = new URL(normalizeUrl(returnUrl));
    url.searchParams.set('status', 'success');
    return url.toString();
  }

  const appBaseUrl = getAppBaseUrl();
  if (appBaseUrl) {
    const url = new URL('/app/suscripcion', appBaseUrl);
    url.searchParams.set('status', 'success');
    return url.toString();
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl) {
    const url = new URL('/functions/v1/subscription-return', supabaseUrl);
    url.searchParams.set('status', 'success');
    return url.toString();
  }

  const fallbackUrl = new URL('/app/suscripcion', 'http://localhost:5173');
  fallbackUrl.searchParams.set('status', 'success');
  return fallbackUrl.toString();
}

export function getMercadoPagoWebhookUrl() {
  return Deno.env.get('MP_WEBHOOK_URL') ?? null;
}

export function formatMercadoPagoError(status: number, payload: Record<string, unknown> | null) {
  const cause = Array.isArray(payload?.cause) ? payload.cause[0] as Record<string, unknown> | undefined : undefined;
  const details =
    (typeof payload?.message === 'string' && payload.message)
    || (typeof payload?.error === 'string' && payload.error)
    || (typeof cause?.description === 'string' && cause.description)
    || (typeof cause?.code === 'string' && cause.code)
    || 'Error creando suscripcion en Mercado Pago';

  return `Mercado Pago ${status}: ${details}`;
}

type CreatePendingPreapprovalInput = {
  accessToken: string;
  householdId: string;
  payerEmail: string;
  planCode: PlanCode;
  billingCycle: BillingCycle;
  backUrl: string;
  webhookUrl?: string | null;
  idempotencyKey?: string;
};

export async function createPendingPreapproval({
  accessToken,
  householdId,
  payerEmail,
  planCode,
  billingCycle,
  backUrl,
  webhookUrl,
  idempotencyKey,
}: CreatePendingPreapprovalInput): Promise<MercadoPagoPreapprovalResponse> {
  const payload: Record<string, unknown> = {
    reason: buildSubscriptionReason(planCode, billingCycle),
    external_reference: householdId,
    payer_email: payerEmail,
    auto_recurring: buildAutoRecurring(planCode, billingCycle),
    back_url: backUrl,
    status: 'pending',
  };

  if (webhookUrl) {
    payload.notification_url = webhookUrl;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const responsePayload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(formatMercadoPagoError(response.status, responsePayload));
  }

  return responsePayload ?? {};
}

export async function cancelMercadoPagoPreapproval(accessToken: string, subscriptionId: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  const responsePayload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(formatMercadoPagoError(response.status, responsePayload));
  }

  return responsePayload;
}

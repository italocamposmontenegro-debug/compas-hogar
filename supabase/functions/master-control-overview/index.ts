import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { assertControlModuleAccess, getControlViewer } from '../_shared/control-auth.ts';
import type { ControlModuleKey } from '../../../shared/control.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCALE = 'es-CL';

type JsonRecord = Record<string, unknown>;

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'pending':
      return 'Pendiente';
    case 'cancelled':
      return 'Cancelada';
    case 'expired':
      return 'Expirada';
    case 'failed':
      return 'Pago fallido';
    case 'inactive':
      return 'Inactiva';
    default:
      return 'Sin estado';
  }
}

function internalPlanLabel(planCode: string | null | undefined) {
  switch (planCode) {
    case 'plus':
      return 'Estratégico';
    case 'base':
      return 'Esencial';
    case 'admin':
      return 'Admin';
    default:
      return 'Free';
  }
}

function visiblePlanLabel(planCode: string | null | undefined) {
  return planCode && planCode !== 'free' ? 'Premium' : 'Free';
}

function money(value: number | null | undefined) {
  if (!value) return '$0';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `${value.toFixed(1)}%`;
}

function monthlyEquivalent(price: number, billingCycle: string | null | undefined) {
  if (billingCycle === 'yearly') {
    return Math.round(price / 12);
  }
  return price;
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
}

function buildMonthKeys(months: number) {
  const keys: string[] = [];
  const current = new Date();

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - index, 1));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${year}-${month}`);
  }

  return keys;
}

function toMonthKey(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function countDistinct<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = pick(row);
    if (value) values.add(value);
  });
  return values.size;
}

function groupCountsByMonth(rows: JsonRecord[], dateKey: string, months = 6) {
  const monthKeys = buildMonthKeys(months);
  const bucket = new Map(monthKeys.map((key) => [key, 0]));

  rows.forEach((row) => {
    const monthKey = toMonthKey(typeof row[dateKey] === 'string' ? row[dateKey] as string : null);
    if (!monthKey || !bucket.has(monthKey)) return;
    bucket.set(monthKey, (bucket.get(monthKey) ?? 0) + 1);
  });

  return monthKeys.map((monthKey) => ({
    month: monthKey,
    label: formatMonthLabel(monthKey),
    value: bucket.get(monthKey) ?? 0,
  }));
}

function computeConversionRate(activePaidHouseholds: number, totalHouseholds: number) {
  if (totalHouseholds === 0) return null;
  return (activePaidHouseholds / totalHouseholds) * 100;
}

async function countRows(table: string) {
  const { count, error } = await (supabase.from(table).select('*', { count: 'exact', head: true }) as Promise<{
    count: number | null;
    error: { message?: string } | null;
  }>);

  if (error) throw error;
  return count ?? 0;
}

async function loadHouseholdOwnerMap(householdIds: string[]) {
  if (householdIds.length === 0) return new Map<string, JsonRecord>();

  const { data, error } = await (supabase
    .from('household_members')
    .select('household_id, display_name, email, user_id')
    .in('household_id', householdIds)
    .eq('role', 'owner')
    .eq('invitation_status', 'accepted') as Promise<{
      data: JsonRecord[] | null;
      error: { message?: string } | null;
    }>);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [String(row.household_id), row]));
}

async function loadOperationalIncidents() {
  const [subscriptionsRes, householdsRes, webhooksRes, invitationsRes, membershipsRes] = await Promise.all([
    supabase.from('subscriptions').select('id, household_id, plan_code, billing_cycle, status, provider_subscription_id, updated_at, last_payment_status'),
    supabase.from('households').select('id, name'),
    supabase.from('webhook_events').select('id, event_type, resource_id, processing_status, processing_error, received_at').order('received_at', { ascending: false }).limit(30),
    supabase.from('invitation_tokens').select('id, household_id, invited_email, status, expires_at, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('household_members').select('user_id, household_id, role, invitation_status, created_at, email, display_name'),
  ]) as unknown as [
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
  ];

  if (subscriptionsRes.error) throw subscriptionsRes.error;
  if (householdsRes.error) throw householdsRes.error;
  if (webhooksRes.error) throw webhooksRes.error;
  if (invitationsRes.error) throw invitationsRes.error;
  if (membershipsRes.error) throw membershipsRes.error;

  const households = new Map((householdsRes.data ?? []).map((row) => [String(row.id), row]));
  const incidents: JsonRecord[] = [];
  const now = Date.now();

  (subscriptionsRes.data ?? []).forEach((subscription) => {
    const householdId = String(subscription.household_id);
    const household = households.get(householdId);
    const updatedAt = typeof subscription.updated_at === 'string' ? subscription.updated_at : null;
    const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : now;
    const hoursOpen = (now - updatedAtMs) / 36e5;

    if (subscription.status === 'failed') {
      incidents.push({
        id: `subscription-failed:${subscription.id}`,
        type: 'billing_failed',
        severity: 'crítica',
        status: 'abierto',
        household_id: householdId,
        household_name: household?.name ?? 'Hogar sin nombre',
        title: 'Cobro fallido en suscripción',
        description: `La suscripción de ${household?.name ?? 'este hogar'} quedó en estado fallido.`,
        created_at: updatedAt,
      });
    }

    if (subscription.status === 'pending' && hoursOpen >= 24) {
      incidents.push({
        id: `subscription-pending:${subscription.id}`,
        type: 'billing_pending_stale',
        severity: 'alta',
        status: 'abierto',
        household_id: householdId,
        household_name: household?.name ?? 'Hogar sin nombre',
        title: 'Suscripción pendiente estancada',
        description: `La suscripción sigue pendiente hace ${Math.floor(hoursOpen)} horas.`,
        created_at: updatedAt,
      });
    }

    if (subscription.status === 'active' && !subscription.provider_subscription_id) {
      incidents.push({
        id: `subscription-active-without-provider:${subscription.id}`,
        type: 'billing_missing_provider_id',
        severity: 'crítica',
        status: 'abierto',
        household_id: householdId,
        household_name: household?.name ?? 'Hogar sin nombre',
        title: 'Suscripción activa sin provider id',
        description: 'La fila de suscripción está activa pero no tiene identificador de proveedor.',
        created_at: updatedAt,
      });
    }
  });

  (webhooksRes.data ?? []).forEach((event) => {
    if (event.processing_status !== 'failed') return;

    incidents.push({
      id: `webhook-failed:${event.id}`,
      type: 'webhook_failed',
      severity: 'crítica',
      status: 'abierto',
      household_id: null,
      household_name: null,
      title: 'Webhook fallido',
      description: typeof event.processing_error === 'string' && event.processing_error
        ? event.processing_error
        : 'Hubo un fallo al procesar un evento externo.',
      created_at: event.received_at ?? null,
    });
  });

  (invitationsRes.data ?? []).forEach((invitation) => {
    const expiresAt = typeof invitation.expires_at === 'string' ? invitation.expires_at : null;
    if (invitation.status !== 'pending' || !expiresAt || new Date(expiresAt).getTime() > now) return;

    const household = households.get(String(invitation.household_id));

    incidents.push({
      id: `invitation-expired:${invitation.id}`,
      type: 'invitation_expired',
      severity: 'media',
      status: 'abierto',
      household_id: invitation.household_id ?? null,
      household_name: household?.name ?? 'Hogar sin nombre',
      title: 'Invitación vencida',
      description: `La invitación a ${invitation.invited_email ?? 'un correo'} venció sin aceptación.`,
      created_at: invitation.created_at ?? null,
    });
  });

  const acceptedMemberships = (membershipsRes.data ?? []).filter((row) => row.invitation_status === 'accepted' && row.user_id);
  const membershipByUser = new Map<string, JsonRecord[]>();
  acceptedMemberships.forEach((row) => {
    const userId = String(row.user_id);
    const current = membershipByUser.get(userId) ?? [];
    current.push(row);
    membershipByUser.set(userId, current);
  });

  membershipByUser.forEach((rows, userId) => {
    if (rows.length <= 1) return;

    incidents.push({
      id: `multiple-households:${userId}`,
      type: 'multiple_households',
      severity: 'crítica',
      status: 'abierto',
      user_id: userId,
      title: 'Usuario con múltiples hogares aceptados',
      description: `${rows[0].email ?? rows[0].display_name ?? 'Un usuario'} tiene ${rows.length} memberships aceptadas. Compás Hogar v1 soporta un solo hogar operativo.`,
      created_at: rows[0].created_at ?? null,
    });
  });

  const sorted = incidents.sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));
  return {
    incidents: sorted,
    criticalCount: sorted.filter((incident) => incident.severity === 'crítica').length,
  };
}

async function loadExecutiveData() {
  const [
    totalProfiles,
    totalHouseholds,
    subscriptionsRes,
    transactionsRes,
    goalsRes,
    subscriptionEventsRes,
    incidentData,
  ] = await Promise.all([
    countRows('profiles'),
    countRows('households'),
    supabase.from('subscriptions').select('id, household_id, plan_code, billing_cycle, status, price_amount_clp, updated_at, created_at'),
    supabase.from('transactions').select('household_id, created_at'),
    supabase.from('savings_goals').select('household_id, created_at'),
    supabase.from('subscription_events').select('event_type, created_at'),
    loadOperationalIncidents(),
  ]) as unknown as [
    number,
    number,
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { incidents: JsonRecord[]; criticalCount: number },
  ];

  if (subscriptionsRes.error) throw subscriptionsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (subscriptionEventsRes.error) throw subscriptionEventsRes.error;

  const subscriptions = subscriptionsRes.data ?? [];
  const activePaidSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active' && subscription.plan_code);
  const mrr = activePaidSubscriptions.reduce((sum, subscription) => {
    const price = Number(subscription.price_amount_clp ?? 0);
    return sum + monthlyEquivalent(price, typeof subscription.billing_cycle === 'string' ? subscription.billing_cycle : null);
  }, 0);

  const transactions = transactionsRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const activatedHouseholds = new Set<string>();
  transactions.forEach((row) => {
    if (row.household_id) activatedHouseholds.add(String(row.household_id));
  });
  goals.forEach((row) => {
    if (row.household_id) activatedHouseholds.add(String(row.household_id));
  });

  const activationRate = totalHouseholds === 0 ? null : (activatedHouseholds.size / totalHouseholds) * 100;
  const conversionRate = computeConversionRate(activePaidSubscriptions.length, totalHouseholds);
  const recentCancels = (subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'subscription_cancelled' && typeof event.created_at === 'string' && event.created_at >= isoDaysAgo(30)).length;

  const paymentOutcomeEvents = (subscriptionEventsRes.data ?? []).filter((event) =>
    (event.event_type === 'webhook_active' || event.event_type === 'webhook_failed')
    && typeof event.created_at === 'string'
    && event.created_at >= isoDaysAgo(30),
  );
  const paymentSuccessRate = paymentOutcomeEvents.length === 0
    ? null
    : (paymentOutcomeEvents.filter((event) => event.event_type === 'webhook_active').length / paymentOutcomeEvents.length) * 100;

  const activationFunnel = [
    { id: 'signups', label: 'Registros', value: totalProfiles, note: 'Perfiles creados' },
    { id: 'households', label: 'Hogares creados', value: totalHouseholds, note: 'Base operativa' },
    { id: 'first_transaction', label: 'Primer movimiento', value: countDistinct(transactions, (row) => typeof row.household_id === 'string' ? row.household_id : null), note: 'Hogares con al menos un movimiento' },
    { id: 'first_goal', label: 'Primera meta', value: countDistinct(goals, (row) => typeof row.household_id === 'string' ? row.household_id : null), note: 'Hogares con al menos una meta' },
    { id: 'premium', label: 'Premium activo', value: activePaidSubscriptions.length, note: 'Hogares de pago activos' },
  ];

  const movementByMonth = buildMonthKeys(6).map((monthKey) => {
    const checkouts = (subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'checkout_started' && toMonthKey(typeof event.created_at === 'string' ? event.created_at : null) === monthKey).length;
    const activations = (subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'webhook_active' && toMonthKey(typeof event.created_at === 'string' ? event.created_at : null) === monthKey).length;
    const cancellations = (subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'subscription_cancelled' && toMonthKey(typeof event.created_at === 'string' ? event.created_at : null) === monthKey).length;

    return {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      checkouts,
      activations,
      cancellations,
    };
  });

  const health = {
    active: subscriptions.filter((subscription) => subscription.status === 'active').length,
    pending: subscriptions.filter((subscription) => subscription.status === 'pending').length,
    failed: subscriptions.filter((subscription) => subscription.status === 'failed').length,
    cancelled: subscriptions.filter((subscription) => subscription.status === 'cancelled').length,
  };

  return {
    kpis: [
      { id: 'mrr', label: 'MRR', value: money(mrr), detail: 'Ingreso mensual equivalente de suscripciones activas', tone: 'neutral' },
      { id: 'paid_households', label: 'Hogares de pago activos', value: String(activePaidSubscriptions.length), detail: 'Suscripciones activas con plan pagado', tone: 'neutral' },
      { id: 'conversion', label: 'Conversión Free → Premium', value: percent(conversionRate) ?? 'No disponible aún', detail: 'Activos pagados sobre hogares totales', tone: conversionRate === null ? 'muted' : 'neutral' },
      { id: 'churn', label: 'Cancelaciones recientes', value: String(recentCancels), detail: 'Últimos 30 días', tone: recentCancels > 0 ? 'warning' : 'neutral' },
      { id: 'activation', label: 'Tasa de activación', value: percent(activationRate) ?? 'No disponible aún', detail: 'Hogares con movimiento o meta', tone: activationRate === null ? 'muted' : 'neutral' },
      { id: 'payment_success', label: 'Tasa de éxito de cobro', value: percent(paymentSuccessRate) ?? 'No disponible aún', detail: 'Eventos de webhook de los últimos 30 días', tone: paymentSuccessRate === null ? 'muted' : 'neutral' },
      { id: 'critical_incidents', label: 'Incidentes críticos abiertos', value: String(incidentData.criticalCount), detail: 'Anomalías abiertas detectadas por el sistema', tone: incidentData.criticalCount > 0 ? 'danger' : 'success' },
    ],
    funnel: activationFunnel,
    movement: movementByMonth,
    payment_health: health,
    critical_incidents: incidentData.incidents.filter((incident) => incident.severity === 'crítica').slice(0, 5),
    availability_notes: paymentSuccessRate === null
      ? ['La tasa de éxito de cobro aún no tiene suficientes eventos recientes para ser robusta.']
      : [],
  };
}

async function loadBillingData() {
  const [subscriptionsRes, householdsRes, subscriptionEventsRes, webhooksRes] = await Promise.all([
    supabase.from('subscriptions').select('id, household_id, provider, provider_account_label, plan_code, billing_cycle, status, provider_subscription_id, price_amount_clp, last_payment_status, current_period_end, updated_at, created_at').order('updated_at', { ascending: false }).limit(100),
    supabase.from('households').select('id, name'),
    supabase.from('subscription_events').select('subscription_id, event_type, provider_event_id, created_at, metadata').order('created_at', { ascending: false }).limit(30),
    supabase.from('webhook_events').select('id, event_type, resource_id, processing_status, processing_error, received_at').order('received_at', { ascending: false }).limit(20),
  ]) as unknown as [
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
  ];

  if (subscriptionsRes.error) throw subscriptionsRes.error;
  if (householdsRes.error) throw householdsRes.error;
  if (subscriptionEventsRes.error) throw subscriptionEventsRes.error;
  if (webhooksRes.error) throw webhooksRes.error;

  const households = new Map((householdsRes.data ?? []).map((row) => [String(row.id), row]));
  const householdIds = Array.from(households.keys());
  const ownerMap = await loadHouseholdOwnerMap(householdIds);
  const subscriptions = subscriptionsRes.data ?? [];

  const summary = {
    active: subscriptions.filter((subscription) => subscription.status === 'active').length,
    pending: subscriptions.filter((subscription) => subscription.status === 'pending').length,
    cancelled: subscriptions.filter((subscription) => subscription.status === 'cancelled').length,
    failed: subscriptions.filter((subscription) => subscription.status === 'failed').length,
    mrr: subscriptions
      .filter((subscription) => subscription.status === 'active' && subscription.plan_code)
      .reduce((sum, subscription) => sum + monthlyEquivalent(Number(subscription.price_amount_clp ?? 0), typeof subscription.billing_cycle === 'string' ? subscription.billing_cycle : null), 0),
  };

  const rows = subscriptions.map((subscription) => {
    const household = households.get(String(subscription.household_id));
    const owner = ownerMap.get(String(subscription.household_id));

    return {
      subscription_id: subscription.id,
      household_id: subscription.household_id,
      household_name: household?.name ?? 'Hogar sin nombre',
      owner_name: owner?.display_name ?? 'Sin owner visible',
      owner_email: owner?.email ?? '—',
      visible_plan: visiblePlanLabel(typeof subscription.plan_code === 'string' ? subscription.plan_code : null),
      internal_plan: internalPlanLabel(typeof subscription.plan_code === 'string' ? subscription.plan_code : null),
      billing_cycle: subscription.billing_cycle ?? '—',
      status: subscription.status ?? '—',
      status_label: statusLabel(typeof subscription.status === 'string' ? subscription.status : null),
      provider: subscription.provider ?? '—',
      provider_account_label: subscription.provider_account_label ?? '—',
      provider_subscription_id: subscription.provider_subscription_id ?? '—',
      last_payment_status: subscription.last_payment_status ?? '—',
      price_amount_clp: Number(subscription.price_amount_clp ?? 0),
      price_label: Number(subscription.price_amount_clp ?? 0) > 0 ? money(Number(subscription.price_amount_clp ?? 0)) : 'Gratis',
      current_period_end: subscription.current_period_end ?? null,
      updated_at: subscription.updated_at ?? subscription.created_at ?? null,
    };
  });

  const recentMovements = (subscriptionEventsRes.data ?? []).map((event) => {
    const subscription = subscriptions.find((item) => item.id === event.subscription_id);
    const household = subscription ? households.get(String(subscription.household_id)) : null;
    return {
      id: `${event.subscription_id}:${event.event_type}:${event.created_at}`,
      household_name: household?.name ?? 'Hogar sin nombre',
      event_type: event.event_type ?? 'evento',
      provider_event_id: event.provider_event_id ?? null,
      created_at: event.created_at ?? null,
      status: subscription?.status ?? null,
      plan: subscription ? internalPlanLabel(typeof subscription.plan_code === 'string' ? subscription.plan_code : null) : '—',
    };
  });

  const anomalies = [
    {
      id: 'pending_stale',
      label: 'Pendientes prolongadas',
      value: rows.filter((row) => row.status === 'pending' && row.updated_at && new Date(String(row.updated_at)).getTime() <= Date.now() - 24 * 36e5).length,
    },
    {
      id: 'failed',
      label: 'Cobros fallidos',
      value: rows.filter((row) => row.status === 'failed').length,
    },
    {
      id: 'missing_provider_id',
      label: 'Activas sin provider id',
      value: rows.filter((row) => row.status === 'active' && row.provider_subscription_id === '—').length,
    },
  ];

  return {
    summary: [
      { id: 'active', label: 'Activas', value: String(summary.active), detail: 'Suscripciones activas' },
      { id: 'pending', label: 'Pendientes', value: String(summary.pending), detail: 'A la espera de confirmación' },
      { id: 'failed', label: 'Fallidas', value: String(summary.failed), detail: 'Cobro o estado fallido' },
      { id: 'cancelled', label: 'Canceladas', value: String(summary.cancelled), detail: 'Canceladas por usuario o ciclo' },
      { id: 'mrr', label: 'MRR', value: money(summary.mrr), detail: 'Ingreso mensual equivalente activo' },
    ],
    distribution: [
      { label: 'Activas', value: summary.active },
      { label: 'Pendientes', value: summary.pending },
      { label: 'Fallidas', value: summary.failed },
      { label: 'Canceladas', value: summary.cancelled },
    ],
    subscriptions: rows,
    recent_movements: recentMovements,
    recent_webhooks: webhooksRes.data ?? [],
    anomalies,
  };
}

async function loadCustomer360Data(search: string | null) {
  const trimmedSearch = search?.trim() ?? '';
  const queryValue = trimmedSearch.length > 1 ? `%${trimmedSearch}%` : null;

  const householdSearch = queryValue
    ? supabase.from('households').select('id, name, created_at, updated_at').ilike('name', queryValue).limit(8)
    : supabase.from('households').select('id, name, created_at, updated_at').order('updated_at', { ascending: false }).limit(6);

  const memberSearch = queryValue
    ? supabase.from('household_members').select('id, household_id, user_id, role, display_name, email, invitation_status, created_at').or(`email.ilike.${queryValue},display_name.ilike.${queryValue}`).limit(12)
    : supabase.from('household_members').select('id, household_id, user_id, role, display_name, email, invitation_status, created_at').eq('role', 'owner').eq('invitation_status', 'accepted').order('created_at', { ascending: false }).limit(6);

  const profileSearch = queryValue
    ? supabase.from('profiles').select('id, email, full_name, created_at, is_admin').or(`email.ilike.${queryValue},full_name.ilike.${queryValue}`).limit(8)
    : supabase.from('profiles').select('id, email, full_name, created_at, is_admin').order('created_at', { ascending: false }).limit(6);

  const [householdsRes, membersRes, profilesRes] = await Promise.all([householdSearch, memberSearch, profileSearch]) as unknown as [
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
  ];

  if (householdsRes.error) throw householdsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const householdIds = new Set<string>();
  (householdsRes.data ?? []).forEach((row) => householdIds.add(String(row.id)));
  (membersRes.data ?? []).forEach((row) => householdIds.add(String(row.household_id)));

  const userIds = new Set<string>();
  (membersRes.data ?? []).forEach((row) => {
    if (row.user_id) userIds.add(String(row.user_id));
  });
  (profilesRes.data ?? []).forEach((row) => userIds.add(String(row.id)));

  const householdIdList = Array.from(householdIds);
  const userIdList = Array.from(userIds);

  const [subscriptionsRes, allMembersRes, invitationsRes, transactionsRes, goalsRes, recurringRes, controlRolesRes] = await Promise.all([
    householdIdList.length > 0 ? supabase.from('subscriptions').select('id, household_id, plan_code, billing_cycle, status, provider_subscription_id, last_payment_status, updated_at').in('household_id', householdIdList) : Promise.resolve({ data: [], error: null }),
    householdIdList.length > 0 ? supabase.from('household_members').select('id, household_id, user_id, role, display_name, email, invitation_status, created_at').in('household_id', householdIdList) : Promise.resolve({ data: [], error: null }),
    householdIdList.length > 0 ? supabase.from('invitation_tokens').select('id, household_id, invited_email, status, expires_at, accepted_at, created_at').in('household_id', householdIdList).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    householdIdList.length > 0 ? supabase.from('transactions').select('household_id, created_at').in('household_id', householdIdList) : Promise.resolve({ data: [], error: null }),
    householdIdList.length > 0 ? supabase.from('savings_goals').select('household_id, created_at, status').in('household_id', householdIdList) : Promise.resolve({ data: [], error: null }),
    householdIdList.length > 0 ? supabase.from('recurring_transactions').select('household_id, is_active, created_at').in('household_id', householdIdList) : Promise.resolve({ data: [], error: null }),
    userIdList.length > 0 ? supabase.from('control_role_assignments').select('user_id, role, is_active').in('user_id', userIdList).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
  ]) as unknown as Array<{ data: JsonRecord[] | null; error: { message?: string } | null }>;

  const responses = [subscriptionsRes, allMembersRes, invitationsRes, transactionsRes, goalsRes, recurringRes, controlRolesRes];
  for (const response of responses) {
    if (response.error) throw response.error;
  }

  const subscriptions = subscriptionsRes.data ?? [];
  const memberRows = allMembersRes.data ?? [];
  const invitations = invitationsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const recurring = recurringRes.data ?? [];
  const controlRoles = controlRolesRes.data ?? [];

  const householdSummaries = householdIdList.map((householdId) => {
    const household = (householdsRes.data ?? []).find((row) => String(row.id) === householdId)
      ?? (membersRes.data ?? []).find((row) => String(row.household_id) === householdId);
    const subscription = subscriptions.find((row) => String(row.household_id) === householdId) ?? null;
    const members = memberRows.filter((row) => String(row.household_id) === householdId);
    const owner = members.find((row) => row.role === 'owner') ?? null;

    return {
      household_id: householdId,
      household_name: household?.name ?? 'Hogar sin nombre',
      subscription: subscription ? {
        visible_plan: visiblePlanLabel(typeof subscription.plan_code === 'string' ? subscription.plan_code : null),
        internal_plan: internalPlanLabel(typeof subscription.plan_code === 'string' ? subscription.plan_code : null),
        status: subscription.status ?? null,
        status_label: statusLabel(typeof subscription.status === 'string' ? subscription.status : null),
        billing_cycle: subscription.billing_cycle ?? null,
        provider_subscription_id: subscription.provider_subscription_id ?? null,
        last_payment_status: subscription.last_payment_status ?? null,
      } : null,
      owner_name: owner?.display_name ?? 'Sin owner visible',
      owner_email: owner?.email ?? '—',
      members: members.map((member) => ({
        id: member.id,
        role: member.role,
        display_name: member.display_name,
        email: member.email,
        invitation_status: member.invitation_status,
      })),
      activity: {
        transactions: transactions.filter((row) => String(row.household_id) === householdId).length,
        goals: goals.filter((row) => String(row.household_id) === householdId).length,
        recurring_rules: recurring.filter((row) => String(row.household_id) === householdId).length,
        invitations: invitations.filter((row) => String(row.household_id) === householdId).length,
      },
      invitations: invitations
        .filter((row) => String(row.household_id) === householdId)
        .slice(0, 3)
        .map((row) => ({
          invited_email: row.invited_email ?? '—',
          status: row.status ?? 'pending',
          accepted_at: row.accepted_at ?? null,
          expires_at: row.expires_at ?? null,
        })),
      risks: [
        ...(members.length > 2 ? ['Más de dos miembros aceptados en un producto v1 pensado para un hogar operativo único.'] : []),
        ...(subscription?.status === 'failed' ? ['La suscripción del hogar está en estado fallido.'] : []),
        ...(subscription?.status === 'pending' ? ['La suscripción del hogar sigue pendiente.'] : []),
      ],
    };
  });

  const userSummaries = userIdList.map((userId) => {
    const profile = (profilesRes.data ?? []).find((row) => String(row.id) === userId);
    const memberships = memberRows.filter((row) => String(row.user_id ?? '') === userId);

    return {
      user_id: userId,
      full_name: profile?.full_name ?? memberships[0]?.display_name ?? 'Usuario sin nombre',
      email: profile?.email ?? memberships[0]?.email ?? '—',
      is_admin: profile?.is_admin === true,
      memberships: memberships.map((membership) => {
        const household = householdSummaries.find((item) => item.household_id === membership.household_id);
        return {
          household_id: membership.household_id,
          household_name: household?.household_name ?? 'Hogar sin nombre',
          role: membership.role,
          invitation_status: membership.invitation_status,
          visible_plan: household?.subscription?.visible_plan ?? 'Free',
          internal_plan: household?.subscription?.internal_plan ?? 'Free',
          subscription_status: household?.subscription?.status_label ?? 'Sin estado',
        };
      }),
      control_roles: controlRoles
        .filter((assignment) => String(assignment.user_id) === userId)
        .map((assignment) => assignment.role),
      risks: memberships.length > 1
        ? ['Tiene múltiples memberships aceptadas; revisar coherencia del hogar operativo.']
        : [],
    };
  });

  return {
    search: trimmedSearch || null,
    households: householdSummaries,
    users: userSummaries,
    availability_notes: trimmedSearch.length <= 1
      ? ['Ingresa un correo, nombre o nombre de hogar para una búsqueda más precisa.']
      : [],
  };
}

async function loadRiskData() {
  const [auditRes, webhooksRes, roleAssignmentsRes, incidents] = await Promise.all([
    supabase.from('audit_logs').select('id, user_id, household_id, action, resource_type, resource_id, metadata, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('webhook_events').select('id, event_type, processing_status, processing_error, received_at, resource_id').order('received_at', { ascending: false }).limit(20),
    supabase.from('control_role_assignments').select('id, user_id, role, is_active, note, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(20),
    loadOperationalIncidents(),
  ]) as unknown as [
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { incidents: JsonRecord[]; criticalCount: number },
  ];

  if (auditRes.error) throw auditRes.error;
  if (webhooksRes.error) throw webhooksRes.error;
  if (roleAssignmentsRes.error) throw roleAssignmentsRes.error;

  const failedWebhooks = (webhooksRes.data ?? []).filter((event) => event.processing_status === 'failed');
  const breakGlassAssignments = (roleAssignmentsRes.data ?? []).filter((assignment) => assignment.role === 'BREAK_GLASS');

  return {
    summary: [
      { id: 'audit_logs', label: 'Eventos auditados', value: String((auditRes.data ?? []).length), detail: 'Feed reciente de auditoría' },
      { id: 'failed_webhooks', label: 'Fallos de integración', value: String(failedWebhooks.length), detail: 'Webhook events fallidos recientes' },
      { id: 'break_glass', label: 'Cuentas Break Glass', value: String(breakGlassAssignments.length), detail: 'Acceso excepcional activo' },
      { id: 'critical_incidents', label: 'Incidentes críticos', value: String(incidents.criticalCount), detail: 'Anomalías abiertas del sistema' },
    ],
    audit_feed: auditRes.data ?? [],
    webhook_failures: failedWebhooks,
    role_assignments: roleAssignmentsRes.data ?? [],
    operational_health: [
      { label: 'Webhook fallidos', value: failedWebhooks.length, tone: failedWebhooks.length > 0 ? 'danger' : 'success' },
      { label: 'Break Glass activos', value: breakGlassAssignments.length, tone: breakGlassAssignments.length > 0 ? 'warning' : 'neutral' },
      { label: 'Incidentes críticos', value: incidents.criticalCount, tone: incidents.criticalCount > 0 ? 'danger' : 'success' },
    ],
  };
}

async function loadOperationsData(filters: JsonRecord) {
  const incidentData = await loadOperationalIncidents();
  const severityFilter = typeof filters.severity === 'string' ? filters.severity : '';
  const typeFilter = typeof filters.type === 'string' ? filters.type : '';
  const statusFilter = typeof filters.status === 'string' ? filters.status : '';
  const searchFilter = typeof filters.search === 'string' ? filters.search.toLowerCase() : '';

  const incidents = incidentData.incidents.filter((incident) => {
    if (severityFilter && incident.severity !== severityFilter) return false;
    if (typeFilter && incident.type !== typeFilter) return false;
    if (statusFilter && incident.status !== statusFilter) return false;
    if (searchFilter) {
      const haystack = [
        incident.title,
        incident.description,
        incident.household_name,
        incident.user_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchFilter)) return false;
    }
    return true;
  });

  const bySeverity = {
    crítica: incidents.filter((incident) => incident.severity === 'crítica').length,
    alta: incidents.filter((incident) => incident.severity === 'alta').length,
    media: incidents.filter((incident) => incident.severity === 'media').length,
  };

  return {
    summary: [
      { id: 'critical', label: 'Críticas', value: String(bySeverity.crítica), detail: 'Requieren intervención rápida' },
      { id: 'high', label: 'Altas', value: String(bySeverity.alta), detail: 'No críticas, pero urgentes' },
      { id: 'medium', label: 'Medias', value: String(bySeverity.media), detail: 'Seguimiento operativo' },
      { id: 'total', label: 'Casos abiertos', value: String(incidents.length), detail: 'Cola actual priorizada' },
    ],
    filters: {
      severity: severityFilter || null,
      type: typeFilter || null,
      status: statusFilter || null,
      search: searchFilter || null,
    },
    incidents,
    availability_notes: [
      'La capa de auth/recovery todavía no expone eventos persistidos suficientes para una cola operativa completa.',
    ],
  };
}

async function loadGrowthData() {
  const [profilesRes, householdsRes, transactionsRes, goalsRes, subscriptionEventsRes, activePaidCount] = await Promise.all([
    supabase.from('profiles').select('id, created_at'),
    supabase.from('households').select('id, created_at'),
    supabase.from('transactions').select('household_id, created_at'),
    supabase.from('savings_goals').select('household_id, created_at'),
    supabase.from('subscription_events').select('event_type, created_at'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]) as unknown as [
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { data: JsonRecord[] | null; error: { message?: string } | null },
    { count: number | null; error: { message?: string } | null },
  ];

  if (profilesRes.error) throw profilesRes.error;
  if (householdsRes.error) throw householdsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (subscriptionEventsRes.error) throw subscriptionEventsRes.error;
  if (activePaidCount.error) throw activePaidCount.error;

  const firstTransactions = new Map<string, string>();
  (transactionsRes.data ?? []).forEach((row) => {
    const householdId = typeof row.household_id === 'string' ? row.household_id : null;
    const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
    if (!householdId || !createdAt) return;
    const current = firstTransactions.get(householdId);
    if (!current || createdAt < current) {
      firstTransactions.set(householdId, createdAt);
    }
  });

  const firstGoals = new Map<string, string>();
  (goalsRes.data ?? []).forEach((row) => {
    const householdId = typeof row.household_id === 'string' ? row.household_id : null;
    const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
    if (!householdId || !createdAt) return;
    const current = firstGoals.get(householdId);
    if (!current || createdAt < current) {
      firstGoals.set(householdId, createdAt);
    }
  });

  const totalHouseholds = (householdsRes.data ?? []).length;
  const premiumActive = activePaidCount.count ?? 0;

  return {
    summary: [
      { id: 'signups', label: 'Registros', value: String((profilesRes.data ?? []).length), detail: 'Perfiles creados' },
      { id: 'households', label: 'Hogares creados', value: String(totalHouseholds), detail: 'Hogares con configuración inicial' },
      { id: 'first_transaction', label: 'Primer movimiento', value: String(firstTransactions.size), detail: 'Hogares que registraron movimiento' },
      { id: 'first_goal', label: 'Primera meta', value: String(firstGoals.size), detail: 'Hogares que crearon meta' },
      { id: 'premium', label: 'Premium activo', value: String(premiumActive), detail: 'Suscripciones activas actuales' },
      { id: 'conversion', label: 'Conversión a Premium', value: percent(computeConversionRate(premiumActive, totalHouseholds)) ?? 'No disponible aún', detail: 'Premium activo sobre hogares totales' },
    ],
    activation_funnel: [
      { label: 'Registros', value: (profilesRes.data ?? []).length },
      { label: 'Hogares creados', value: totalHouseholds },
      { label: 'Primer movimiento', value: firstTransactions.size },
      { label: 'Primera meta', value: firstGoals.size },
      { label: 'Premium activo', value: premiumActive },
    ],
    trends: {
      signups: groupCountsByMonth(profilesRes.data ?? [], 'created_at'),
      households: groupCountsByMonth(householdsRes.data ?? [], 'created_at'),
      first_transactions: groupCountsByMonth(Array.from(firstTransactions.entries()).map(([householdId, createdAt]) => ({ household_id: householdId, created_at: createdAt })), 'created_at'),
      checkouts: groupCountsByMonth((subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'checkout_started'), 'created_at'),
      activations: groupCountsByMonth((subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'webhook_active'), 'created_at'),
      cancellations: groupCountsByMonth((subscriptionEventsRes.data ?? []).filter((event) => event.event_type === 'subscription_cancelled'), 'created_at'),
    },
    friction_points: [
      {
        label: 'Intentos de funciones premium',
        status: 'No disponible aún',
        detail: 'La app todavía no persiste un evento robusto para `feature_blocked` en backend.',
      },
      {
        label: 'Recovery completado',
        status: 'No disponible aún',
        detail: 'El flujo existe, pero no hay evento persistido confiable para growth.',
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({})) as JsonRecord;
    const module = (typeof body.module === 'string' ? body.module : 'executive') as ControlModuleKey;
    const viewer = await getControlViewer(supabase, req.headers.get('Authorization'));
    assertControlModuleAccess(viewer, module);

    let payload: JsonRecord;

    switch (module) {
      case 'executive':
        payload = await loadExecutiveData();
        break;
      case 'billing':
        payload = await loadBillingData();
        break;
      case 'customers':
        payload = await loadCustomer360Data(typeof body.search === 'string' ? body.search : null);
        break;
      case 'operations':
        payload = await loadOperationsData(body);
        break;
      case 'risk':
        payload = await loadRiskData();
        break;
      case 'growth':
        payload = await loadGrowthData();
        break;
      default:
        throw new Error('Unknown module');
    }

    return new Response(JSON.stringify({
      viewer,
      module,
      data: payload,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400;

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status,
    });
  }
});

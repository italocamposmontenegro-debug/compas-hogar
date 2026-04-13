import { useCallback, useEffect, useMemo, useState } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, Button, PlanBadge, UpgradePromptCard } from '../../components/ui';
import { trackEvent, trackOnce } from '../../lib/analytics';
import {
  APP_NAME,
  COMMERCIAL_PLAN_INFO,
  COMMERCIAL_PLAN_ORDER,
  PREMIUM_TRIAL_ENABLED,
  SUBSCRIPTION_STATUS_LABELS,
  getFeatureUpgradeCopy,
  mapBillingPlanCodeToTier,
  type BillingPlanCode,
  type CommercialPlanTier,
  type FeatureKey,
  type PlanTier,
} from '../../lib/constants';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { supabase } from '../../lib/supabase';
import { ArrowRight, CheckCircle } from 'lucide-react';

export function SubscriptionPage() {
  const { subscription, household, currentMember, refetch } = useHousehold();
  const { status, billingCycle, planTier, isActivePaidPlan } = useSubscription();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [autoSyncedSubscriptionId, setAutoSyncedSubscriptionId] = useState<string | null>(null);
  const isOwner = currentMember?.role === 'owner';
  const currentCommercialPlan: CommercialPlanTier = planTier === 'free' ? 'free' : 'premium';
  const currentPlanInfo = COMMERCIAL_PLAN_INFO[currentCommercialPlan];
  const currentPlanName = currentPlanInfo.name;
  const currentCycleLabel = billingCycle === 'monthly' ? 'Mensual' : billingCycle === 'yearly' ? 'Anual' : '—';
  const currentPlanPromise = currentPlanInfo.promise;
  const currentPlanHighlights = currentPlanInfo.featureHighlights;
  const visiblePlanState = getVisiblePlanState(status, isActivePaidPlan);
  const featureUpgrade = useMemo(() => {
    const feature = searchParams.get('feature') as FeatureKey | null;
    return feature ? getFeatureUpgradeCopy(feature) : null;
  }, [searchParams]);
  const requestedPlan = searchParams.get('plan');

  useEffect(() => {
    if (subscription?.billing_cycle) {
      setAnnual(subscription.billing_cycle === 'yearly');
    }
  }, [subscription?.billing_cycle]);

  useEffect(() => {
    if (!household) return;
    trackOnce(
      `subscription-view:${household.id}`,
      'subscription_page_viewed',
      { household_id: household.id, plan: planTier, status: status || 'free' },
      'session',
    );
    trackOnce(
      `premium-viewed:${household.id}:${planTier}`,
      'premium_viewed',
      { household_id: household.id, current_plan: planTier, status: status || 'free', surface: 'subscription-page' },
      'session',
    );
  }, [household, planTier, status]);

  async function readResponseBody(response: Response) {
    const cloned = response.clone();
    const payload = await cloned.json().catch(() => null) as { error?: string; message?: string } | null;
    if (payload?.error) return payload.error;
    if (payload?.message) return payload.message;

    const text = await response.text().catch(() => '');
    return text || null;
  }

  const resolveSubscriptionError = useCallback(async (error: unknown) => {
    if (error instanceof FunctionsHttpError || (error instanceof Error && error.name === 'FunctionsHttpError')) {
      const response = error instanceof FunctionsHttpError ? error.context as Response : (error as { context?: Response }).context;
      if (response instanceof Response) {
        return (await readResponseBody(response)) ?? error.message;
      }
      return error.message;
    }

    if (error instanceof FunctionsRelayError || (error instanceof Error && error.name === 'FunctionsRelayError')) {
      return 'Supabase relay no pudo completar la invocacion de la Edge Function.';
    }

    if (error instanceof FunctionsFetchError || (error instanceof Error && error.name === 'FunctionsFetchError')) {
      return 'No se pudo contactar la Edge Function desde el navegador.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Error al actualizar la suscripción.';
  }, []);

  async function handleSelectPlan(plan: BillingPlanCode) {
    if (!household || !isOwner) return;
    setLoading(true);
    setSyncMessage(null);
    const targetTier = mapBillingPlanCodeToTier(plan);
    const targetCycle = annual ? 'yearly' : 'monthly';

    trackEvent('upgrade_cta_clicked', {
      context: 'subscription-plan-card',
      household_id: household.id,
      current_plan: planTier,
      target_plan: targetTier,
      billing_cycle: targetCycle,
    });

    try {
      const action = isActivePaidPlan && subscription ? 'update-subscription' : 'create-subscription';
      const { data, error } = await supabase.functions.invoke(action, {
        body: {
          household_id: household.id,
          plan_code: plan,
          billing_cycle: targetCycle,
        },
      });

      if (error) throw error;
      if (data?.init_point) {
        trackEvent('checkout_started', {
          household_id: household.id,
          current_plan: planTier,
          target_plan: targetTier,
          billing_cycle: targetCycle,
        });
        window.location.href = data.init_point;
      } else {
        await refetch();
      }
    } catch (error) {
      alert(await resolveSubscriptionError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDowngradeToFree() {
    if (!household || !isOwner) return;
    setLoading(true);
    setSyncMessage(null);

    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { household_id: household.id },
      });
      if (error) throw error;
      await refetch();
      setSyncMessage('El hogar volvió a la base Free.');
    } catch (error) {
      alert(await resolveSubscriptionError(error));
    } finally {
      setLoading(false);
    }
  }

  const syncSubscriptionStatus = useCallback(async (silent = false) => {
    if (!household) return;
    setSyncing(true);
    if (!silent) setSyncMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-subscription-status', {
        body: { household_id: household.id },
      });

      if (error) throw error;
      await refetch();

      const providerStatus = typeof data?.provider_status === 'string' ? data.provider_status : 'desconocido';
      const localStatus = typeof data?.status === 'string' ? data.status : 'pending';

      if (localStatus === 'active') {
        trackOnce(
          `upgrade-completed:${subscription?.provider_subscription_id || household.id}:${subscription?.plan_code || planTier}`,
          'upgrade_completed',
          {
            household_id: household.id,
            provider_status: providerStatus,
            plan: subscription?.plan_code || planTier,
          },
          'local',
        );
      }

      if (!silent) {
        setSyncMessage(`Estado sincronizado. Mercado Pago: ${providerStatus}. ${APP_NAME}: ${localStatus}.`);
      }
    } catch (error) {
      const message = await resolveSubscriptionError(error);
      if (!silent) setSyncMessage(message);
    } finally {
      setSyncing(false);
    }
  }, [household, planTier, refetch, resolveSubscriptionError, subscription?.plan_code, subscription?.provider_subscription_id]);

  useEffect(() => {
    if (!household || !isOwner || subscription?.status !== 'pending' || !subscription.provider_subscription_id) {
      return;
    }

    if (autoSyncedSubscriptionId === subscription.provider_subscription_id) {
      return;
    }

    setAutoSyncedSubscriptionId(subscription.provider_subscription_id);
    void syncSubscriptionStatus(true);
  }, [autoSyncedSubscriptionId, household, isOwner, subscription?.provider_subscription_id, subscription?.status, syncSubscriptionStatus]);

  return (
    <div className="app-page max-w-7xl mx-auto">
      <section className="ui-panel overflow-hidden" aria-labelledby="subscription-overview-title">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <div className="border-b border-border-light p-6 lg:p-8 xl:border-b-0 xl:border-r xl:border-border-light">
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge>{currentPlanName}</PlanBadge>
              <span className="text-xs uppercase tracking-[0.18em] text-text-light">
                {status ? SUBSCRIPTION_STATUS_LABELS[status] : 'Free'}
              </span>
            </div>

            <h1 id="subscription-overview-title" className="mt-4 max-w-xl text-[clamp(1.85rem,2.2vw,2.35rem)] font-semibold tracking-[-0.04em] text-text">
              Tu plan para ordenar y hacer crecer el hogar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Desde aquí pueden decidir si quieren seguir con una base simple o activar una capa más completa de orden, anticipación y proyectos compartidos.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <SubscriptionSignal
                label="Plan actual"
                value={currentPlanName}
                description={currentPlanPromise}
              />
              <SubscriptionSignal
                label="Ciclo"
                value={isActivePaidPlan ? currentCycleLabel : '—'}
                description={isActivePaidPlan ? 'La renovación sigue este ciclo.' : 'No hay ciclo de cobro activo.'}
              />
              <SubscriptionSignal
                label="Precio"
                value={subscription?.price_amount_clp ? formatCLP(subscription.price_amount_clp) : 'Gratis'}
                description={subscription?.current_period_end ? `Vigente hasta ${formatDateLong(subscription.current_period_end)}` : 'Empiecen con Free y activen Premium cuando el hogar lo necesite.'}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {isActivePaidPlan && isOwner ? (
                <Button variant="secondary" onClick={handleDowngradeToFree} loading={loading}>
                  Volver a Free
                </Button>
              ) : (
                <Button variant="primary" onClick={() => document.getElementById('planes-disponibles')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  Ver planes
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {subscription?.status === 'pending' && isOwner && (
                <Button variant="secondary" onClick={() => { void syncSubscriptionStatus(); }} loading={syncing}>
                  Sincronizar estado
                </Button>
              )}
            </div>
          </div>

          <div className="bg-bg/55 p-6 lg:p-8">
            <div className="grid gap-4">
              <div className="ui-panel ui-panel-subtle overflow-hidden p-6 shadow-none">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Lectura rápida</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-text">{visiblePlanState.title}</p>
                <p className="mt-3 text-sm leading-7 text-text-muted">{visiblePlanState.description}</p>
                <ul className="mt-4 space-y-3">
                  {currentPlanHighlights.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
                      <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-primary-lighter" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ui-panel ui-panel-subtle overflow-hidden p-6 shadow-none">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Gestión</p>
                <p className="mt-3 text-base font-semibold tracking-tight text-text">{isOwner ? 'Administra el plan del hogar desde aquí' : 'Solo quien administra el hogar puede cambiarlo'}</p>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  {isOwner
                    ? `Puedes activar Premium, volver a Free o sincronizar el estado sin salir de ${APP_NAME}.`
                    : 'Puedes revisar el estado del plan y su valor actual, pero el cambio lo hace quien administra el hogar.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!isOwner && (
        <AlertBanner type="info" message="Solo quien administra el hogar puede cambiar el plan." />
      )}

      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="subscription-progress-title">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Estado del plan</p>
            <h2 id="subscription-progress-title" className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
              {visiblePlanState.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
              {isActivePaidPlan
                ? 'Premium les da más profundidad para ordenar pagos, aportes y decisiones del mes con mejor anticipación.'
                : 'Free sirve para empezar. Premium suma más claridad para sostener el orden del hogar y avanzar con más tranquilidad.'}
            </p>
          </div>

          <div className="ui-panel ui-panel-subtle overflow-hidden p-6 shadow-none">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Lo que suma Premium</p>
            <p className="mt-3 text-base font-semibold tracking-tight text-text">
              {isActivePaidPlan
                ? 'Mantener el orden del hogar con más profundidad'
                : 'Activar una capa más completa cuando el hogar lo pida'}
            </p>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {isActivePaidPlan
                ? 'Calendario completo, recurrencias, importación y proyección para decidir mejor como pareja.'
                : 'Pagos, aportes y proyección en una sola lectura para que el hogar avance con menos fricción.'}
            </p>
          </div>
        </div>
      </section>

      {featureUpgrade && (
        <UpgradePromptCard
          badge={featureUpgrade.badge}
          title={featureUpgrade.title}
          description={featureUpgrade.description}
          highlights={featureUpgrade.highlights}
          actionLabel={featureUpgrade.actionLabel || 'Ver planes'}
          onAction={() => document.getElementById('planes-disponibles')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          compact
          trackingContext={`subscription-feature-${searchParams.get('feature') || 'unknown'}`}
        />
      )}

      {!featureUpgrade && requestedPlan && (requestedPlan === 'essential' || requestedPlan === 'strategic' || requestedPlan === 'premium') && (
        <AlertBanner
          type="info"
          message="Actualiza a Premium para desbloquear esta función."
        />
      )}

      {syncMessage && (
        <AlertBanner
          type={planTier === 'free' ? 'info' : 'success'}
          message={syncMessage}
          onClose={() => setSyncMessage(null)}
        />
      )}

      {planTier === 'free' && (
        <UpgradePromptCard
          badge="Premium"
          title="Free sirve para empezar. Premium ayuda a sostener el orden del hogar."
          description="Activen Premium cuando necesiten categorías propias, metas múltiples, calendario completo y mejor proyección del mes."
          highlights={['Categorías personalizadas', 'Metas múltiples', 'Calendario completo y proyección']}
          actionLabel="Ver Premium"
          onAction={() => document.getElementById('planes-disponibles')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          trackingContext="subscription-free-upgrade"
        />
      )}

      {subscription?.status === 'pending' && isOwner && (
        <AlertBanner
          type="warning"
          message="La suscripción sigue pendiente. Si ya terminaste el pago en Mercado Pago, sincroniza el estado."
          action={{ label: syncing ? 'Sincronizando...' : 'Sincronizar ahora', onClick: () => { void syncSubscriptionStatus(); } }}
        />
      )}

      <section id="planes-disponibles" className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="subscription-plans-title">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Planes disponibles</p>
            <h2 id="subscription-plans-title" className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
              {isActivePaidPlan ? 'Gestionen su plan con claridad' : 'Elige cómo quieren usar Compás'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
              {PREMIUM_TRIAL_ENABLED
                ? 'Todos los hogares pueden probar Premium durante 30 días. Luego deciden si seguir en Free o activar Premium por $4.990 al mes.'
                : 'Free sirve para empezar. Premium es para sostener el orden del hogar con más claridad, más seguimiento y mejor proyección.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex min-h-12 items-center gap-1 rounded-full border border-border bg-bg/80 px-1 py-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${!annual ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text'}`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${annual ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text'}`}
              >
                Anual
              </button>
            </div>
            <span className="text-xs font-medium text-text-muted">Ahorra al pagar anual</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:gap-8">
          {COMMERCIAL_PLAN_ORDER.map((tier: CommercialPlanTier) => {
            const plan = COMMERCIAL_PLAN_INFO[tier];
            return (
              <PlanOptionCard
                key={tier}
                tier={tier}
                plan={plan}
                annual={annual}
                billingCycle={billingCycle}
                currentPlanTier={planTier}
                isActivePaidPlan={isActivePaidPlan}
                isOwner={isOwner}
                loading={loading}
                onDowngrade={handleDowngradeToFree}
                onSelect={handleSelectPlan}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SubscriptionSignal({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="ui-panel ui-panel-subtle flex h-full flex-col overflow-hidden p-6 shadow-none">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{label}</p>
      <p className="mt-3 text-[1.55rem] font-semibold tracking-[-0.03em] text-text">{value}</p>
      <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p>
    </div>
  );
}

function PlanOptionCard({
  tier,
  plan,
  annual,
  billingCycle,
  currentPlanTier,
  isActivePaidPlan,
  isOwner,
  loading,
  onDowngrade,
  onSelect,
}: {
  tier: CommercialPlanTier;
  plan: (typeof COMMERCIAL_PLAN_INFO)[CommercialPlanTier];
  annual: boolean;
  billingCycle: 'monthly' | 'yearly' | null;
  currentPlanTier: PlanTier;
  isActivePaidPlan: boolean;
  isOwner: boolean;
  loading: boolean;
  onDowngrade: () => Promise<void>;
  onSelect: (plan: BillingPlanCode) => Promise<void>;
}) {
  const price = annual ? plan.prices.yearly : plan.prices.monthly;
  const currentCycle = annual ? 'yearly' : 'monthly';
  const isCurrent =
    tier === 'free'
      ? currentPlanTier === 'free'
      : currentPlanTier !== 'free' && billingCycle === currentCycle;
  const billingPlanCode = plan.billingPlanCode as BillingPlanCode | null;
  const metaLabel = tier === 'free' ? 'Base' : 'Premium';
  const badge =
    isCurrent
      ? 'Actual'
      : tier === 'premium'
        ? 'Recomendado'
        : null;
  const description = plan.description;

  return (
    <div
      className={`ui-panel overflow-hidden ${
        tier === 'premium'
          ? 'border-primary/35 bg-linear-to-br from-primary-bg/28 to-surface shadow-[0_16px_36px_rgba(23,59,69,0.08)]'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex h-full flex-col p-6 lg:p-7">
        <div className="flex min-h-[28px] items-start justify-between gap-3">
          <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-text-light">
            {metaLabel}
          </p>
          <div className="shrink-0 whitespace-nowrap">
            {badge ? <PlanBadge>{badge}</PlanBadge> : <span className="inline-block h-7" />}
          </div>
        </div>

        <div className="mt-3">
          <h3 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-text">{plan.name}</h3>
          <p className="mt-2 text-sm font-medium text-primary">{plan.promise}</p>
        </div>

        <div className="mt-4">
          <p className="max-w-[30ch] text-sm leading-6 text-text-muted">{description}</p>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-end gap-1.5">
            <span className="text-[2.35rem] font-semibold tracking-[-0.04em] text-text">
              {price === null ? 'Gratis' : formatCLP(price)}
            </span>
            {price !== null && (
              <span className="pb-1 text-sm text-text-muted">/{annual ? 'año' : 'mes'}</span>
            )}
          </div>
          {annual && price !== null && (
            <p className="mt-2 text-xs font-medium text-text-muted">
              Ahorras {formatCLP(plan.savings.yearly)} al año
            </p>
          )}
        </div>

        <ul className="mt-5 space-y-3">
          {plan.featureHighlights.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-primary-lighter" />
              <span className="text-sm leading-6 text-text-secondary">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {isCurrent ? (
            <Button variant="secondary" className="w-full" disabled>
              Plan actual
            </Button>
          ) : tier === 'free' ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onDowngrade}
              loading={loading}
              disabled={!isOwner || !isActivePaidPlan}
            >
              Volver a Free
            </Button>
          ) : (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => billingPlanCode && onSelect(billingPlanCode)}
              loading={loading}
              disabled={!isOwner}
            >
              {isActivePaidPlan ? `Gestionar ${plan.name}` : `Elegir ${plan.name}`}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getVisiblePlanState(status: string | null, isActivePaidPlan: boolean) {
  if (status === 'pending') {
    return {
      title: 'La activación está en curso. Apenas se confirme, el hogar quedará con Premium activo.',
      description: 'Si ya terminaron el pago, pueden sincronizar el estado para actualizar la información del plan.',
    };
  }

  if (isActivePaidPlan) {
    return {
      title: 'Hoy el hogar tiene Premium activo para ordenar el mes con más profundidad y anticipación.',
      description: 'Premium ayuda a ordenar pagos, aportes y proyectos compartidos con una lectura más completa del hogar.',
    };
  }

  return {
    title: 'Hoy están usando la base gratuita del hogar.',
    description: 'Es una base simple para empezar a ordenar el mes y decidir cuándo vale la pena activar Premium.',
  };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, Button, PlanBadge, UpgradePromptCard } from '../../components/ui';
import { trackEvent, trackOnce } from '../../lib/analytics';
import {
  APP_NAME,
  PUBLIC_PLAN_INFO,
  SUBSCRIPTION_STATUS_LABELS,
  getFeatureUpgradeCopy,
  mapBillingPlanCodeToTier,
  getPlanName,
  getPlanPromise,
  type BillingPlanCode,
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
  const [annual, setAnnual] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [autoSyncedSubscriptionId, setAutoSyncedSubscriptionId] = useState<string | null>(null);
  const isOwner = currentMember?.role === 'owner';
  const currentPlanName = getPlanName(planTier);
  const currentCycleLabel = billingCycle === 'monthly' ? 'Mensual' : billingCycle === 'yearly' ? 'Anual' : '—';
  const currentPlanPromise = getPlanPromise(planTier);
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
      setSyncMessage('Tu hogar volvió al plan Free.');
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
                {status ? SUBSCRIPTION_STATUS_LABELS[status] : 'Plan Free'}
              </span>
            </div>

            <h1 id="subscription-overview-title" className="mt-4 max-w-xl text-[clamp(1.85rem,2.2vw,2.35rem)] font-semibold tracking-[-0.04em] text-text">
              Plan y dirección del hogar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              {currentPlanPromise} Desde aquí ves en qué etapa está el hogar y qué nivel de seguimiento conviene activar para el mes.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <SubscriptionSignal
                label="Plan actual"
                value={currentPlanName}
                description={planTier === 'free' ? 'Visibilidad básica y hábito inicial.' : PUBLIC_PLAN_INFO[planTier].promise}
              />
              <SubscriptionSignal
                label="Ciclo"
                value={isActivePaidPlan ? currentCycleLabel : '—'}
                description={isActivePaidPlan ? 'La renovación sigue este ciclo.' : 'No hay ciclo de cobro activo.'}
              />
              <SubscriptionSignal
                label="Precio"
                value={subscription?.price_amount_clp ? formatCLP(subscription.price_amount_clp) : 'Gratis'}
                description={subscription?.current_period_end ? `Vigente hasta ${formatDateLong(subscription.current_period_end)}` : 'Puedes empezar gratis y subir después.'}
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
                <p className="mt-3 text-lg font-semibold tracking-tight text-text">{currentPlanPromise}</p>
                <ul className="mt-4 space-y-3">
                  {PUBLIC_PLAN_INFO[planTier].featureHighlights.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
                      <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-primary-lighter" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ui-panel ui-panel-subtle overflow-hidden p-6 shadow-none">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Gestión</p>
                <p className="mt-3 text-base font-semibold tracking-tight text-text">{isOwner ? 'Administra tu plan desde aquí' : 'Solo el owner puede cambiarlo'}</p>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  {isOwner
                    ? `Puedes subir, bajar o sincronizar la suscripción de ${APP_NAME} sin salir del flujo del hogar.`
                    : 'Puedes revisar el estado del plan y su valor actual, pero el cambio de suscripción lo hace el owner del hogar.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!isOwner && (
        <AlertBanner type="info" message="Solo el owner puede cambiar la suscripción." />
      )}

      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="subscription-progress-title">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Progresión del hogar</p>
            <h2 id="subscription-progress-title" className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
              {planTier === 'free'
                ? 'El hogar ya empezó con una lectura básica.'
                : planTier === 'essential'
                  ? 'El hogar ya tiene orden operativo real.'
                  : 'El hogar ya está en la etapa más alta disponible.'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
              {planTier === 'free'
                ? 'El siguiente salto natural es Esencial cuando el hogar ya necesita categorías propias, seguimiento más claro y más de una meta para sostener el mes.'
                : planTier === 'essential'
                  ? 'El siguiente salto natural es Estratégico cuando ya no basta con registrar: conviene anticiparse, comparar y decidir con más contexto.'
                  : 'Ahora el foco no está en subir de plan, sino en aprovechar mejor la proyección, las alertas y las recomendaciones para conducir el hogar con continuidad.'}
            </p>
          </div>

          <div className="ui-panel ui-panel-subtle overflow-hidden p-6 shadow-none">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Siguiente paso útil</p>
            <p className="mt-3 text-base font-semibold tracking-tight text-text">
              {planTier === 'free'
                ? 'Subir a Esencial cuando el mes ya pide más seguimiento.'
                : planTier === 'essential'
                  ? 'Subir a Estratégico cuando el hogar necesita anticiparse.'
                  : 'Mantener continuidad y usar mejor las señales del mes.'}
            </p>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {planTier === 'strategic'
                ? 'Revisa con frecuencia las alertas, la proyección y la comparación mensual para convertir continuidad en criterio.'
                : 'La suscripción no es solo un cobro. Es la etapa desde la que el hogar puede ordenar mejor o decidir mejor.'}
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

      {!featureUpgrade && requestedPlan && (requestedPlan === 'essential' || requestedPlan === 'strategic') && (
        <AlertBanner
          type="info"
          message={`Actualiza a ${getPlanName(requestedPlan as PlanTier)} para desbloquear esta función.`}
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
          badge="Disponible al subir de plan"
          title="Free sirve para partir. El siguiente salto es ordenar el mes."
          description="Sube a Esencial si ya necesitas categorías propias, reparto y múltiples metas. Sube a Estratégico si además quieres comparación, proyección y alertas."
          highlights={['Categorías personalizadas', 'Calendario completo', 'Comparación y proyección']}
          actionLabel="Ver planes"
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
              {isActivePaidPlan ? 'Cambia tu plan' : 'Elige un plan para comenzar'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
              Free sirve para empezar con claridad. Esencial ordena el funcionamiento cotidiano del hogar. Estratégico añade anticipación, alertas y mejor criterio para decidir.
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

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
          {(['free', 'essential', 'strategic'] as const).map((tier: PlanTier) => {
            const plan = PUBLIC_PLAN_INFO[tier];
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
  tier: PlanTier;
  plan: (typeof PUBLIC_PLAN_INFO)[PlanTier];
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
  const isCurrent = tier === currentPlanTier && (tier === 'free' || billingCycle === currentCycle);
  const billingPlanCode = plan.billingPlanCode as BillingPlanCode | null;
  const metaLabel =
    tier === 'free' ? 'Primer paso' : tier === 'essential' ? 'Orden operativo' : 'Más visión';
  const badge =
    isCurrent
      ? 'Actual'
      : tier === 'essential'
        ? 'Más razonable'
        : tier === 'strategic'
          ? 'Premium'
          : null;
  const description =
    tier === 'free'
      ? 'Empieza con una vista simple del mes, una meta visible y los movimientos esenciales.'
      : tier === 'essential'
        ? 'Suma categorías propias, seguimiento más claro y una operación mensual mejor conducida.'
        : 'Añade comparación, alertas y proyección para decidir con más anticipación.';

  return (
    <div
      className={`ui-panel overflow-hidden ${
        tier === 'essential'
          ? 'border-primary/35 bg-linear-to-br from-primary-bg/28 to-surface shadow-[0_16px_36px_rgba(23,59,69,0.08)]'
          : tier === 'strategic'
            ? 'border-border bg-linear-to-br from-bg to-surface'
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
              variant={tier === 'strategic' ? 'primary' : 'secondary'}
              className="w-full"
              onClick={() => billingPlanCode && onSelect(billingPlanCode)}
              loading={loading}
              disabled={!isOwner}
            >
              {isActivePaidPlan ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

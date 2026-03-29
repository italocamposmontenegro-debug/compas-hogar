import { useCallback, useEffect, useMemo, useState } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, Button, Card, PlanBadge, UpgradePromptCard } from '../../components/ui';
import { trackEvent, trackOnce } from '../../lib/analytics';
import {
  APP_NAME,
  PUBLIC_PLAN_INFO,
  getFeatureUpgradeCopy,
  mapBillingPlanCodeToTier,
  getPlanName,
  getPlanPromise,
  type BillingPlanCode,
  type FeatureKey,
  type PlanTier,
} from '../../lib/constants';
import { formatCLP } from '../../utils/format-clp';
import { supabase } from '../../lib/supabase';
import { CheckCircle } from 'lucide-react';

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
      setSyncMessage('Tu hogar volvio al plan Free.');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-12 lg:space-y-16 animate-in fade-in duration-700">
      <header className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">Suscripción</p>
        <h1 className="display-heading text-4xl lg:text-5xl text-text">Planes</h1>
        <p className="max-w-2xl text-base leading-relaxed text-text-muted">
          Elige el nivel de seguimiento que necesita tu hogar.
        </p>
      </header>

      <section className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-10">
          <div className="grid gap-4 md:grid-cols-3">
            <SubscriptionSignal
              label="Plan actual"
              value={currentPlanName}
              description="Tu nivel activo."
            />
            <SubscriptionSignal
              label="Ciclo"
              value={isActivePaidPlan ? currentCycleLabel : "—"}
              description="Renovación actual."
            />
            <SubscriptionSignal
              label="Precio"
              value={subscription?.price_amount_clp ? formatCLP(subscription.price_amount_clp) : "Gratis"}
              description="Monto vigente."
            />
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            {subscription?.status === 'pending' && isOwner && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => { void syncSubscriptionStatus(); }} 
                loading={syncing}
                className="opacity-80 hover:opacity-100"
              >
                Sincronizar estado
              </Button>
            )}
            {!isOwner && (
              <p className="text-xs font-bold text-text-light/60 uppercase tracking-widest">
                Solo el dueño puede modificar el plan
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border-light bg-surface/40 p-12 lg:p-14 space-y-8 backdrop-blur-sm">
          <header className="px-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-light/60">Resumen</p>
          </header>
          
          <div className="space-y-6 px-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-light/50 mb-2">Etapa actual</p>
              <p className="text-base font-bold text-text leading-tight">{currentPlanPromise}</p>
            </div>
            
            <div className="h-px bg-border-light/50 w-full" />
            
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-light/50 mb-2">Gestión</p>
              <p className="text-sm font-bold text-text-secondary">
                {isOwner ? "Administra tu plan" : "Solo lectura"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {syncMessage && (
        <AlertBanner
          type={planTier === 'free' ? 'info' : 'success'}
          message={syncMessage}
          onClose={() => setSyncMessage(null)}
        />
      )}

      <section className="space-y-8">
        <header className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-light/60 px-1">Estado del plan</p>
          <h2 className="display-heading mt-4 text-2xl lg:text-3xl text-text px-1">
            {planTier === 'free'
              ? 'Base activa'
              : planTier === 'essential'
                ? 'Seguimiento ampliado'
                : 'Nivel más completo'}
          </h2>
          <p className="mt-3 text-sm text-text-muted leading-relaxed px-1">
            {planTier === 'free'
              ? 'Estructura inicial del hogar para registrar ingresos y gastos básicos.'
              : planTier === 'essential'
                ? 'Control operativo diario con categorías personalizadas y múltiples metas.'
                : 'Visión estratégica total con proyecciones y alertas preventivas.'}
          </p>
        </header>

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
      </section>

      <section id="planes-disponibles" className="space-y-10 lg:space-y-16 pt-8 border-t border-border-light">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 px-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">Compara planes</p>
            <h2 className="display-heading text-3xl lg:text-4xl text-text">Elige tu plan</h2>
            <p className="text-base text-text-muted max-w-lg">
              Empieza simple o activa más control.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 p-1 bg-surface-low rounded-2xl border border-border-light self-start">
            <button
              onClick={() => setAnnual(false)}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!annual ? 'bg-surface-lowest text-text shadow-sm' : 'text-text-light/50 hover:text-text'}`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${annual ? 'bg-surface-lowest text-text shadow-sm' : 'text-text-light/50 hover:text-text'}`}
            >
              Anual
              <span className="text-[9px] px-1.5 py-0.5 bg-success/10 text-success rounded-md font-black">Ahorra</span>
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {(['free', 'essential', 'strategic'] as const).map((tier: PlanTier) => {
            const plan = PUBLIC_PLAN_INFO[tier];
            const price = annual ? plan.prices.yearly : plan.prices.monthly;
            const isCurrent = tier === planTier && (tier === 'free' || (isActivePaidPlan && billingCycle === (annual ? 'yearly' : 'monthly')));
            
            const labels = { free: "Inicio", essential: "Recomendado", strategic: "Más completo" };
            const phrases = { 
              free: "Orden básico del mes", 
              essential: "Más control cotidiano", 
              strategic: "Seguimiento y anticipación" 
            };
            const descriptions = {
              free: "Para registrar y entender lo esencial.",
              essential: "Categorías, reparto y metas con más claridad.",
              strategic: "Comparación, proyección y alertas para decidir mejor."
            };

            return (
              <Card 
                key={tier} 
                className={`flex flex-col overflow-hidden border-border-light/40 hover:shadow-2xl transition-all duration-500 rounded-3xl ${isCurrent ? 'ring-2 ring-primary/20' : ''}`}
              >
                <div className="p-10 lg:p-12 space-y-10 flex-1">
                  <header className="space-y-6">
                    <div className="flex items-center justify-between px-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">{labels[tier]}</p>
                      {isCurrent && <PlanBadge>Actual</PlanBadge>}
                      {!isCurrent && tier === 'essential' && <PlanBadge>Recomendado</PlanBadge>}
                    </div>
                    <h3 className="display-heading text-3xl text-text px-6">{plan.name}</h3>
                  </header>

                  <div className="space-y-3 px-6">
                    <p className="text-sm font-bold text-text leading-snug">{phrases[tier]}</p>
                    <p className="text-sm text-text-muted leading-relaxed line-clamp-2">
                      {descriptions[tier]}
                    </p>
                  </div>

                  <div className="py-6 border-y border-border-light/30 mx-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tight text-text">
                        {price === null ? 'Gratis' : formatCLP(price)}
                      </span>
                      {price !== null && (
                        <span className="text-sm font-bold text-text-light/50">
                          /{annual ? 'año' : 'mes'}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-4 pt-2 px-6">
                    {plan.featureHighlights.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <CheckCircle className="h-4 w-4 shrink-0 text-text-light/40 mt-0.5" />
                        <span className="text-sm font-medium text-text-secondary leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-10 lg:p-12 pt-0">
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full opacity-60" disabled>
                      Plan actual
                    </Button>
                  ) : tier === 'free' ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={handleDowngradeToFree}
                      loading={loading}
                      disabled={!isOwner || !isActivePaidPlan}
                    >
                      Volver a Free
                    </Button>
                  ) : (
                    <Button
                      variant={tier === 'strategic' ? 'primary' : 'secondary'}
                      className="w-full"
                      onClick={() => plan.billingPlanCode && handleSelectPlan(plan.billingPlanCode as BillingPlanCode)}
                      loading={loading}
                      disabled={!isOwner}
                    >
                      {isActivePaidPlan ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {subscription?.status === 'pending' && isOwner && (
        <AlertBanner
          type="warning"
          message="La suscripción sigue pendiente. Si ya terminaste el pago en Mercado Pago, sincroniza el estado."
          action={{ label: syncing ? 'Sincronizando...' : 'Sincronizar ahora', onClick: () => { void syncSubscriptionStatus(); } }}
        />
      )}
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
    <div className="rounded-3xl border border-border-light bg-surface/30 p-10 lg:p-12 space-y-6 backdrop-blur-xs">
      <div className="px-4">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-light/50">{label}</p>
      </div>
      <div className="space-y-3 px-4">
        <p className="text-xl font-black text-text tracking-tight">{value}</p>
        <p className="text-xs text-text-muted leading-tight">{description}</p>
      </div>
    </div>
  );
}

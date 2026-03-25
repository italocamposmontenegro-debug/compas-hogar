// Casa Clara — Subscription Page
import { useCallback, useEffect, useState } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, AlertBanner } from '../../components/ui';
import { PLANS, SUBSCRIPTION_STATUS_LABELS } from '../../lib/constants';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { supabase } from '../../lib/supabase';
import { CreditCard, CheckCircle, ArrowRight } from 'lucide-react';

export function SubscriptionPage() {
  const { subscription, household, currentMember, refetch } = useHousehold();
  const { status, planCode, billingCycle, isActive } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [autoSyncedSubscriptionId, setAutoSyncedSubscriptionId] = useState<string | null>(null);
  const isOwner = currentMember?.role === 'owner';
  const currentPlanName = planCode && planCode in PLANS ? PLANS[planCode as 'base' | 'plus'].name : '—';
  const currentCycleLabel = billingCycle === 'monthly' ? 'Mensual' : billingCycle === 'yearly' ? 'Anual' : '—';

  useEffect(() => {
    if (subscription?.billing_cycle) {
      setAnnual(subscription.billing_cycle === 'yearly');
    }
  }, [subscription?.billing_cycle]);

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

    return 'Error al crear suscripción';
  }, []);

  async function handleSelectPlan(plan: 'base' | 'plus') {
    if (!household || !isOwner) return;
    setLoading(true);
    setSyncMessage(null);
    try {
      const action = isActive && subscription ? 'update-subscription' : 'create-subscription';
      const { data, error } = await supabase.functions.invoke(action, {
        body: { household_id: household.id, plan_code: plan, billing_cycle: annual ? 'yearly' : 'monthly' },
      });
      if (error) throw error;
      if (data?.init_point) { window.location.href = data.init_point; }
      else { await refetch(); }
    } catch (error: unknown) {
      alert(await resolveSubscriptionError(error));
    }
    setLoading(false);
  }

  const syncSubscriptionStatus = useCallback(async (silent = false) => {
    if (!household) return;
    setSyncing(true);
    if (!silent) {
      setSyncMessage(null);
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-subscription-status', {
        body: { household_id: household.id },
      });

      if (error) throw error;

      await refetch();

      if (!silent) {
        const providerStatus = typeof data?.provider_status === 'string' ? data.provider_status : 'desconocido';
        const localStatus = typeof data?.status === 'string' ? data.status : 'pending';
        setSyncMessage(`Estado sincronizado. Mercado Pago: ${providerStatus}. Casa Clara: ${localStatus}.`);
      }
    } catch (error: unknown) {
      const message = await resolveSubscriptionError(error);
      if (!silent) {
        setSyncMessage(message);
      }
    } finally {
      setSyncing(false);
    }
  }, [household, refetch, resolveSubscriptionError]);

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
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Suscripción</h1>
      {!isOwner && (
        <AlertBanner
          type="info"
          message="Solo el owner puede cambiar la suscripción."
        />
      )}

      {syncMessage && (
        <div className="mb-6">
          <AlertBanner
            type={subscription?.status === 'active' ? 'success' : 'info'}
            message={syncMessage}
            onClose={() => setSyncMessage(null)}
          />
        </div>
      )}

      {/* Current subscription */}
      {subscription && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4"><CreditCard className="h-5 w-5 text-primary" /><h3 className="font-semibold text-text">Plan actual</h3></div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-text-muted">Plan</p><p className="font-medium text-text">{currentPlanName}</p></div>
            <div><p className="text-text-muted">Estado</p><p className="font-medium text-text">{status ? SUBSCRIPTION_STATUS_LABELS[status] : '—'}</p></div>
            <div><p className="text-text-muted">Ciclo</p><p className="font-medium text-text">{currentCycleLabel}</p></div>
            <div><p className="text-text-muted">Precio</p><p className="font-medium text-text">{subscription.price_amount_clp > 0 ? formatCLP(subscription.price_amount_clp) : '—'}</p></div>
            {subscription.current_period_end && (
              <div className="col-span-2"><p className="text-text-muted">Período actual termina</p><p className="font-medium text-text">{formatDateLong(subscription.current_period_end)}</p></div>
            )}
          </div>
          {subscription.status === 'pending' && isOwner && (
            <div className="mt-4">
              <AlertBanner
                type="warning"
                message="La suscripción sigue pendiente. Si ya terminaste el pago en Mercado Pago, sincroniza el estado."
                action={{ label: syncing ? 'Sincronizando...' : 'Sincronizar ahora', onClick: () => { void syncSubscriptionStatus(); } }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Plans */}
      <h2 className="text-lg font-semibold text-text mb-4">
        {subscription ? 'Cambia tu plan' : 'Elige un plan para comenzar'}
      </h2>

      <div className="flex items-center gap-3 mb-6">
        <span className={`text-sm ${!annual ? 'font-semibold text-text' : 'text-text-muted'}`}>Mensual</span>
        <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${annual ? 'bg-primary' : 'bg-border'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm ${annual ? 'font-semibold text-text' : 'text-text-muted'}`}>Anual <span className="text-xs text-success">Mejor precio</span></span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {(['base', 'plus'] as const).map(planKey => {
          const plan = PLANS[planKey];
          const price = annual ? plan.prices.yearly : plan.prices.monthly;
          const isPlus = planKey === 'plus';
          const currentCycle = annual ? 'yearly' : 'monthly';
          const isCurrent = isActive && planCode === planKey && billingCycle === currentCycle;
          return (
            <Card key={planKey} className={isPlus ? 'border-primary border-2' : ''}>
              <h3 className="text-xl font-bold text-text mb-1">{plan.name}</h3>
              <p className="text-sm text-text-muted mb-4">{plan.description}</p>
              <p className="text-3xl font-bold text-text mb-1">{formatCLP(price)}<span className="text-sm font-normal text-text-muted">/{annual ? 'año' : 'mes'}</span></p>
              {annual && <p className="text-xs text-success mb-4">Ahorras {formatCLP(plan.savings.yearly)} al año</p>}
              <ul className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="secondary" className="w-full" disabled>Plan actual</Button>
              ) : (
                <Button variant={isPlus ? 'primary' : 'secondary'} className="w-full" onClick={() => handleSelectPlan(planKey)} loading={loading} disabled={!isOwner}>
                  {isActive ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`} <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

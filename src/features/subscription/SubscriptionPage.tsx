// Casa Clara — Subscription Page
import { useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button } from '../../components/ui';
import { PLANS, SUBSCRIPTION_STATUS_LABELS } from '../../lib/constants';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { supabase } from '../../lib/supabase';
import { CreditCard, CheckCircle, ArrowRight } from 'lucide-react';

export function SubscriptionPage() {
  const { subscription, household, refetch } = useHousehold();
  const { status, planCode, billingCycle, isActive } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [annual, setAnnual] = useState(true);

  async function handleSelectPlan(plan: 'base' | 'plus') {
    if (!household) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { household_id: household.id, plan_code: plan, billing_cycle: annual ? 'yearly' : 'monthly' },
      });
      if (error) throw error;
      if (data?.init_point) { window.location.href = data.init_point; }
      else { await refetch(); }
    } catch (err: any) {
      alert(err.message || 'Error al crear suscripción');
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Suscripción</h1>

      {/* Current subscription */}
      {subscription && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4"><CreditCard className="h-5 w-5 text-primary" /><h3 className="font-semibold text-text">Plan actual</h3></div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-text-muted">Plan</p><p className="font-medium text-text capitalize">{planCode || '—'}</p></div>
            <div><p className="text-text-muted">Estado</p><p className="font-medium text-text">{status ? SUBSCRIPTION_STATUS_LABELS[status] : '—'}</p></div>
            <div><p className="text-text-muted">Ciclo</p><p className="font-medium text-text capitalize">{billingCycle || '—'}</p></div>
            <div><p className="text-text-muted">Precio</p><p className="font-medium text-text">{subscription.price_amount_clp > 0 ? formatCLP(subscription.price_amount_clp) : '—'}</p></div>
            {subscription.current_period_end && (
              <div className="col-span-2"><p className="text-text-muted">Período actual termina</p><p className="font-medium text-text">{formatDateLong(subscription.current_period_end)}</p></div>
            )}
          </div>
        </Card>
      )}

      {/* Plans */}
      {(!isActive || !subscription) && (
        <>
          <h2 className="text-lg font-semibold text-text mb-4">
            {subscription ? 'Cambia tu plan' : 'Elige un plan para comenzar'}
          </h2>

          <div className="flex items-center gap-3 mb-6">
            <span className={`text-sm ${!annual ? 'font-semibold text-text' : 'text-text-muted'}`}>Mensual</span>
            <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${annual ? 'bg-primary' : 'bg-border'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${annual ? 'font-semibold text-text' : 'text-text-muted'}`}>Anual <span className="text-xs text-success">Ahorra más</span></span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {(['base', 'plus'] as const).map(planKey => {
              const plan = PLANS[planKey];
              const price = annual ? plan.prices.yearly : plan.prices.monthly;
              const isPlus = planKey === 'plus';
              const isCurrent = planCode === planKey && isActive;
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
                    <Button variant={isPlus ? 'primary' : 'secondary'} className="w-full" onClick={() => handleSelectPlan(planKey)} loading={loading}>
                      Elegir {plan.name} <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

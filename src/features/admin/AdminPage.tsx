import { useCallback, useEffect, useState } from 'react';
import { AlertBanner, Button, Card, EmptyState, LoadingPage } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { Activity, CreditCard, House, Shield, Users } from 'lucide-react';

type AdminSummary = {
  profiles: number;
  households: number;
  active_subscriptions: number;
  pending_subscriptions: number;
  failed_subscriptions: number;
};

type AdminHouseholdRow = {
  household_id: string;
  household_name: string;
  created_at: string;
  updated_at: string;
  members_count: number;
  owner_name: string;
  owner_email: string;
  plan_code: string;
  billing_cycle: string;
  subscription_status: string;
  price_amount_clp: number;
  provider_subscription_id: string;
};

type AdminWebhookEvent = {
  id: string;
  event_type: string;
  resource_id: string | null;
  processing_status: string;
  processing_error: string | null;
  received_at: string;
};

type AdminSubscriptionEvent = {
  id: string;
  event_type: string;
  provider_event_id: string;
  created_at: string;
  household_name: string;
  subscription_status: string;
  plan_code: string;
};

type AdminOverviewResponse = {
  summary: AdminSummary;
  households: AdminHouseholdRow[];
  webhook_events: AdminWebhookEvent[];
  subscription_events: AdminSubscriptionEvent[];
};

function AdminStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-bg text-primary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function formatPlan(planCode: string) {
  if (planCode === 'plus') return 'Estratégico';
  if (planCode === 'base') return 'Esencial';
  if (planCode === 'admin') return 'Admin';
  return 'Free';
}

export function AdminPage() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('admin-overview', {
        body: {},
      });

      if (error) throw error;
      setData(data as AdminOverviewResponse);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No pudimos cargar el panel admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPage />;

  return (
    <div className="app-page max-w-7xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Operación</p>
            <h1 className="mt-2 text-[clamp(1.9rem,2.8vw,2.7rem)] font-semibold tracking-[-0.04em] text-text">
              Panel de administración
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
              Lectura operativa de usuarios, hogares, suscripciones y eventos recientes.
            </p>
          </div>
          <Button variant="secondary" onClick={() => window.location.assign('/app/control/ejecutivo')}>
            Abrir sistema de control
          </Button>
        </div>
      </section>

      {error ? (
        <AlertBanner type="danger" message={error} action={{ label: 'Reintentar', onClick: () => { void load(); } }} />
      ) : null}

      {!data ? (
        <EmptyState
          icon={<Shield className="h-8 w-8" />}
          title="No hay datos admin para mostrar"
          description="Cuando la función admin responda, aquí verás hogares, suscripciones y eventos recientes."
          action={{ label: 'Reintentar', onClick: () => { void load(); } }}
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <AdminStat label="Usuarios" value={String(data.summary.profiles)} icon={<Users className="h-5 w-5" />} />
            <AdminStat label="Hogares" value={String(data.summary.households)} icon={<House className="h-5 w-5" />} />
            <AdminStat label="Suscripciones activas" value={String(data.summary.active_subscriptions)} icon={<CreditCard className="h-5 w-5" />} />
            <AdminStat label="Pendientes" value={String(data.summary.pending_subscriptions)} icon={<Activity className="h-5 w-5" />} />
            <AdminStat label="Cobros fallidos" value={String(data.summary.failed_subscriptions)} icon={<Shield className="h-5 w-5" />} />
          </section>

          <section className="ui-panel overflow-hidden p-6 lg:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Hogares</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">Estado actual</h2>
              </div>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-light text-text-light">
                    <th className="px-3 py-3 font-medium">Hogar</th>
                    <th className="px-3 py-3 font-medium">Owner</th>
                    <th className="px-3 py-3 font-medium">Miembros</th>
                    <th className="px-3 py-3 font-medium">Plan</th>
                    <th className="px-3 py-3 font-medium">Estado</th>
                    <th className="px-3 py-3 font-medium">Precio</th>
                    <th className="px-3 py-3 font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.households.map((row) => (
                    <tr key={row.household_id} className="border-b border-border-light/70 align-top text-text-secondary">
                      <td className="px-3 py-4">
                        <p className="font-medium text-text">{row.household_name}</p>
                        <p className="mt-1 text-xs text-text-light">{row.household_id}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p>{row.owner_name}</p>
                        <p className="mt-1 text-xs text-text-light">{row.owner_email}</p>
                      </td>
                      <td className="px-3 py-4">{row.members_count}</td>
                      <td className="px-3 py-4">
                        <p>{formatPlan(row.plan_code)}</p>
                        <p className="mt-1 text-xs text-text-light">{row.billing_cycle}</p>
                      </td>
                      <td className="px-3 py-4">{row.subscription_status}</td>
                      <td className="px-3 py-4">{row.price_amount_clp > 0 ? formatCLP(row.price_amount_clp) : 'Gratis'}</td>
                      <td className="px-3 py-4">{formatDateLong(row.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Webhook events</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">Mercado Pago</h2>
              <div className="mt-5 space-y-3">
                {data.webhook_events.length === 0 ? (
                  <p className="text-sm leading-6 text-text-muted">Todavía no hay eventos recientes.</p>
                ) : data.webhook_events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-surface-low px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-text">{event.event_type}</p>
                      <span className="text-xs uppercase tracking-[0.14em] text-text-light">{event.processing_status}</span>
                    </div>
                    <p className="mt-2 text-xs text-text-light">{event.received_at}</p>
                    {event.resource_id ? <p className="mt-2 text-sm text-text-secondary">Recurso: {event.resource_id}</p> : null}
                    {event.processing_error ? <p className="mt-2 text-sm text-danger">{event.processing_error}</p> : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Subscription events</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">Lifecycle reciente</h2>
              <div className="mt-5 space-y-3">
                {data.subscription_events.length === 0 ? (
                  <p className="text-sm leading-6 text-text-muted">Todavía no hay eventos recientes de suscripción.</p>
                ) : data.subscription_events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-surface-low px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-text">{event.event_type}</p>
                      <span className="text-xs uppercase tracking-[0.14em] text-text-light">{event.plan_code} · {event.subscription_status}</span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">{event.household_name}</p>
                    <p className="mt-2 text-xs text-text-light">{event.created_at}</p>
                    {event.provider_event_id && event.provider_event_id !== '—' ? (
                      <p className="mt-2 text-xs text-text-light">Provider event: {event.provider_event_id}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

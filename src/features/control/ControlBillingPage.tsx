import { AlertBanner, Card, LoadingPage } from '../../components/ui';
import { AvailabilityNotes, ControlModuleIntro, ControlSection, ControlStatGrid, EmptyControlState, TonePill } from './components';
import { useControlModule } from './useControlModule';
import type { BillingData } from './types';

export function ControlBillingPage() {
  const { data, loading, error, reload } = useControlModule<BillingData>('billing');

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Cobros y suscripciones"
        title="Estado comercial real del parque de suscripciones"
        description="Aquí se concentra la lectura segura del billing actual: estados, planes visibles e internos, provider ids, últimos movimientos y anomalías."
      />

      {error ? <AlertBanner type="danger" message={error} action={{ label: 'Reintentar', onClick: () => { void reload(); } }} /> : null}

      {!data ? (
        <EmptyControlState
          title="No pudimos cargar Billing Room"
          description="Cuando el backend responda, aquí verás suscripciones, estados, movimientos y anomalías comerciales."
        />
      ) : (
        <>
          <ControlStatGrid items={data.summary} />
          <AvailabilityNotes notes={[]} />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <ControlSection
              eyebrow="Distribución"
              title="Estado del parque"
              description="Resumen de suscripciones por estado visible en la base actual."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {data.distribution.map((item) => (
                  <Card key={item.label} className="overflow-hidden">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-text">{item.value}</p>
                  </Card>
                ))}
              </div>
            </ControlSection>

            <ControlSection
              eyebrow="Anomalías"
              title="Señales que requieren revisión"
              description="Indicadores de fricción o riesgo que hoy ya se pueden detectar sin tocar billing."
            >
              <div className="space-y-3">
                {data.anomalies.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-text">{item.label}</p>
                      <TonePill tone={item.value > 0 ? 'warning' : 'success'}>{item.value}</TonePill>
                    </div>
                  </Card>
                ))}
              </div>
            </ControlSection>
          </section>

          <ControlSection
            eyebrow="Tabla operativa"
            title="Suscripciones"
            description="Lectura operativa por hogar con plan visible, plan interno, ciclo, provider id y estado actual."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-light text-text-light">
                    <th className="px-3 py-3 font-medium">Hogar</th>
                    <th className="px-3 py-3 font-medium">Owner</th>
                    <th className="px-3 py-3 font-medium">Visible</th>
                    <th className="px-3 py-3 font-medium">Interno</th>
                    <th className="px-3 py-3 font-medium">Estado</th>
                    <th className="px-3 py-3 font-medium">Cobro</th>
                    <th className="px-3 py-3 font-medium">Provider id</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((row) => (
                    <tr key={String(row.subscription_id)} className="border-b border-border-light/70 align-top text-text-secondary">
                      <td className="px-3 py-4">
                        <p className="font-medium text-text">{String(row.household_name)}</p>
                        <p className="mt-1 text-xs text-text-light">{String(row.household_id)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p>{String(row.owner_name)}</p>
                        <p className="mt-1 text-xs text-text-light">{String(row.owner_email)}</p>
                      </td>
                      <td className="px-3 py-4">{String(row.visible_plan)}</td>
                      <td className="px-3 py-4">{String(row.internal_plan)}</td>
                      <td className="px-3 py-4">
                        <p>{String(row.status_label)}</p>
                        <p className="mt-1 text-xs text-text-light">{String(row.billing_cycle)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p>{String(row.last_payment_status)}</p>
                        <p className="mt-1 text-xs text-text-light">{String(row.price_label)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="break-all text-xs text-text-light">{String(row.provider_subscription_id)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ControlSection>

          <section className="grid gap-6 xl:grid-cols-2">
            <ControlSection
              eyebrow="Lifecycle"
              title="Movimientos recientes"
              description="Eventos de suscripción que hoy sí quedan trazados en el sistema."
            >
              <div className="space-y-3">
                {data.recent_movements.length === 0 ? (
                  <EmptyControlState
                    title="Aún no hay movimientos recientes"
                    description="Cuando existan eventos de suscripción, aparecerán aquí."
                  />
                ) : data.recent_movements.map((event) => (
                  <Card key={String(event.id)} className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-text">{String(event.event_type)}</p>
                      <TonePill tone="neutral">{String(event.plan)}</TonePill>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">{String(event.household_name)}</p>
                    <p className="mt-2 text-xs text-text-light">{String(event.created_at)}</p>
                  </Card>
                ))}
              </div>
            </ControlSection>

            <ControlSection
              eyebrow="Webhook"
              title="Eventos externos recientes"
              description="Últimos webhooks que afectan o explican el estado comercial."
            >
              <div className="space-y-3">
                {data.recent_webhooks.length === 0 ? (
                  <EmptyControlState
                    title="No hay webhooks recientes"
                    description="Cuando Mercado Pago u otro proveedor emita eventos, aparecerán aquí."
                  />
                ) : data.recent_webhooks.map((event) => (
                  <Card key={String(event.id)} className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-text">{String(event.event_type)}</p>
                      <TonePill tone={String(event.processing_status) === 'failed' ? 'danger' : 'neutral'}>
                        {String(event.processing_status)}
                      </TonePill>
                    </div>
                    {event.processing_error ? (
                      <p className="mt-3 text-sm text-danger">{String(event.processing_error)}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-text-light">{String(event.received_at)}</p>
                  </Card>
                ))}
              </div>
            </ControlSection>
          </section>
        </>
      )}
    </div>
  );
}

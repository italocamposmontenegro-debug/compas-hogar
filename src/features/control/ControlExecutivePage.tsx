import { AlertBanner, Card, LoadingPage } from '../../components/ui';
import { ControlModuleIntro, ControlSection, ControlStatGrid, AvailabilityNotes, TonePill, EmptyControlState } from './components';
import { useControlModule } from './useControlModule';
import type { ExecutiveData } from './types';

export function ControlExecutivePage() {
  const { data, loading, error, reload } = useControlModule<ExecutiveData>('executive');

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Cockpit ejecutivo"
        title="Lo esencial del negocio, claro y directo"
        description="Este módulo condensa crecimiento, salud comercial y riesgo operativo para responder rápido cómo va Compás Hogar y dónde mirar primero."
      />

      {error ? <AlertBanner type="danger" message={error} action={{ label: 'Reintentar', onClick: () => { void reload(); } }} /> : null}

      {!data ? (
        <EmptyControlState
          title="No pudimos construir el cockpit ejecutivo"
          description="Cuando el backend responda, aquí verás KPIs, embudos, salud de pagos e incidentes críticos."
        />
      ) : (
        <>
          <ControlStatGrid items={data.kpis} />
          <AvailabilityNotes notes={data.availability_notes} />

          <ControlSection
            eyebrow="Activación"
            title="Embudo operativo"
            description="Se muestra solo con datos que hoy ya existen o pueden inferirse desde tablas de dominio."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {data.funnel.map((step) => (
                <Card key={step.id} className="overflow-hidden">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{step.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">{step.value}</p>
                  <p className="mt-3 text-sm leading-6 text-text-muted">{step.note}</p>
                </Card>
              ))}
            </div>
          </ControlSection>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <ControlSection
              eyebrow="Movimiento comercial"
              title="Tendencia reciente"
              description="Lectura mensual de checkouts, activaciones y cancelaciones visibles en el sistema."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.movement.map((row) => (
                  <Card key={row.month} className="overflow-hidden">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{row.label}</p>
                    <div className="mt-4 space-y-3 text-sm text-text-secondary">
                      <div className="flex items-center justify-between gap-3">
                        <span>Checkouts</span>
                        <span className="font-semibold text-text">{row.checkouts}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Activaciones</span>
                        <span className="font-semibold text-text">{row.activations}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Cancelaciones</span>
                        <span className="font-semibold text-text">{row.cancellations}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ControlSection>

            <div className="space-y-6">
              <ControlSection
                eyebrow="Cobro"
                title="Salud de pagos"
                description="Lectura rápida del estado actual del parque de suscripciones."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(data.payment_health).map(([status, value]) => (
                    <Card key={status} className="overflow-hidden">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{status}</p>
                      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-text">{value}</p>
                    </Card>
                  ))}
                </div>
              </ControlSection>

              <ControlSection
                eyebrow="Riesgo"
                title="Incidentes críticos abiertos"
                description="Lo que hoy requiere atención ejecutiva inmediata."
              >
                {data.critical_incidents.length === 0 ? (
                  <EmptyControlState
                    title="No hay incidentes críticos abiertos"
                    description="El sistema no detectó anomalías críticas abiertas con la información disponible."
                  />
                ) : (
                  <div className="space-y-3">
                    {data.critical_incidents.map((incident) => (
                      <Card key={String(incident.id)} className="overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-text">{String(incident.title)}</p>
                          <TonePill tone="danger">Crítica</TonePill>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-text-secondary">{String(incident.description)}</p>
                        {incident.household_name ? (
                          <p className="mt-3 text-xs text-text-light">Hogar: {String(incident.household_name)}</p>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                )}
              </ControlSection>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

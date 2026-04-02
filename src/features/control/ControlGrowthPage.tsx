import { AlertBanner, Card, LoadingPage } from '../../components/ui';
import { ControlModuleIntro, ControlSection, ControlStatGrid, EmptyControlState, TonePill } from './components';
import { useControlModule } from './useControlModule';
import type { GrowthData } from './types';

export function ControlGrowthPage() {
  const { data, loading, error, reload } = useControlModule<GrowthData>('growth');

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Crecimiento"
        title="Activación y conversión con datos honestos"
        description="Este módulo no inventa métricas. Solo muestra lo que hoy ya puede sostenerse con eventos o equivalentes reales del sistema."
      />

      {error ? <AlertBanner type="danger" message={error} action={{ label: 'Reintentar', onClick: () => { void reload(); } }} /> : null}

      {!data ? (
        <EmptyControlState
          title="No pudimos cargar Growth Room"
          description="Cuando el backend responda, aquí verás activación, tendencias y fricciones reales."
        />
      ) : (
        <>
          <ControlStatGrid items={data.summary} />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <ControlSection
              eyebrow="Funnel"
              title="Embudo de activación"
              description="Basado en registros, hogares, primer movimiento, primera meta y premium activo."
            >
              <div className="space-y-3">
                {data.activation_funnel.map((step) => (
                  <Card key={step.label} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-text">{step.label}</p>
                      <p className="text-2xl font-semibold tracking-[-0.03em] text-text">{step.value}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </ControlSection>

            <ControlSection
              eyebrow="Tendencias"
              title="Series recientes"
              description="Lectura breve por mes para activación y conversión visible."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(data.trends).map(([key, series]) => (
                  <Card key={key} className="overflow-hidden">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{key.replaceAll('_', ' ')}</p>
                    <div className="mt-4 space-y-3">
                      {series.map((point) => (
                        <div key={point.month} className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                          <span>{point.label}</span>
                          <span className="font-semibold text-text">{point.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </ControlSection>
          </section>

          <ControlSection
            eyebrow="Fricciones"
            title="Lo que todavía no puede medirse bien"
            description="Deuda explícita que no conviene maquillar con números inventados."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {data.friction_points.length === 0 ? (
                <EmptyControlState
                  title="No hay fricciones documentadas"
                  description="Eso sería inusual; este bloque debería listar al menos las métricas aún no disponibles."
                />
              ) : data.friction_points.map((item) => (
                <Card key={item.label} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-text">{item.label}</p>
                    <TonePill tone="warning">{item.status}</TonePill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{item.detail}</p>
                </Card>
              ))}
            </div>
          </ControlSection>
        </>
      )}
    </div>
  );
}

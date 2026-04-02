import { AlertBanner, Card, LoadingPage } from '../../components/ui';
import { ControlModuleIntro, ControlSection, ControlStatGrid, EmptyControlState, TonePill } from './components';
import { useControlModule } from './useControlModule';
import type { RiskData } from './types';

export function ControlRiskPage() {
  const { data, loading, error, reload } = useControlModule<RiskData>('risk');

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Riesgos y auditoría"
        title="Trazabilidad y salud de la capa operativa"
        description="Aquí se concentran la auditoría disponible, el estado de accesos internos y las fallas de integración que hoy sí podemos observar con evidencia real."
      />

      {error ? <AlertBanner type="danger" message={error} action={{ label: 'Reintentar', onClick: () => { void reload(); } }} /> : null}

      {!data ? (
        <EmptyControlState
          title="No pudimos cargar Risk & Audit"
          description="Cuando el backend responda, aquí verás auditoría, roles activos, fallos de integración y salud operativa."
        />
      ) : (
        <>
          <ControlStatGrid items={data.summary} />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <ControlSection
              eyebrow="Salud"
              title="Estado operativo"
              description="Resumen breve de lo que hoy tensiona la operación."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {data.operational_health.map((item) => (
                  <Card key={item.label} className="overflow-hidden">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-text">{item.value}</p>
                    <div className="mt-3">
                      <TonePill tone={item.tone}>{item.tone}</TonePill>
                    </div>
                  </Card>
                ))}
              </div>
            </ControlSection>

            <ControlSection
              eyebrow="Roles"
              title="Asignaciones internas activas"
              description="La nueva capa RBAC se apoya aquí. `Break Glass` debe permanecer acotado y auditado."
            >
              {data.role_assignments.length === 0 ? (
                <EmptyControlState
                  title="Aún no hay roles internos activos"
                  description="Cuando existan asignaciones RBAC activas, aparecerán aquí."
                />
              ) : (
                <div className="space-y-3">
                  {data.role_assignments.map((assignment) => (
                    <Card key={String(assignment.id)} className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-text">{String(assignment.role)}</p>
                        <TonePill tone={String(assignment.role) === 'BREAK_GLASS' ? 'warning' : 'neutral'}>
                          {String(assignment.is_active) === 'true' ? 'Activo' : 'Inactivo'}
                        </TonePill>
                      </div>
                      {assignment.note ? (
                        <p className="mt-3 text-sm leading-6 text-text-secondary">{String(assignment.note)}</p>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </ControlSection>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ControlSection
              eyebrow="Auditoría"
              title="Feed de acciones sensibles"
              description="Base de trazabilidad actual del sistema."
            >
              {data.audit_feed.length === 0 ? (
                <EmptyControlState
                  title="Aún no hay eventos auditados recientes"
                  description="La tabla existe; cuando haya acciones sensibles registradas, aparecerán aquí."
                />
              ) : (
                <div className="space-y-3">
                  {data.audit_feed.map((entry) => (
                    <Card key={String(entry.id)} className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-text">{String(entry.action)}</p>
                        <TonePill tone="neutral">{String(entry.resource_type)}</TonePill>
                      </div>
                      <p className="mt-3 text-xs text-text-light">{String(entry.created_at)}</p>
                    </Card>
                  ))}
                </div>
              )}
            </ControlSection>

            <ControlSection
              eyebrow="Integración"
              title="Fallos recientes"
              description="Eventos externos que hoy ya quedaron en error y ayudan a explicar incidentes."
            >
              {data.webhook_failures.length === 0 ? (
                <EmptyControlState
                  title="No hay fallos recientes de integración"
                  description="No se detectaron webhooks fallidos en la muestra actual."
                />
              ) : (
                <div className="space-y-3">
                  {data.webhook_failures.map((event) => (
                    <Card key={String(event.id)} className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-text">{String(event.event_type)}</p>
                        <TonePill tone="danger">Fallido</TonePill>
                      </div>
                      {event.processing_error ? (
                        <p className="mt-3 text-sm leading-6 text-danger">{String(event.processing_error)}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-text-light">{String(event.received_at)}</p>
                    </Card>
                  ))}
                </div>
              )}
            </ControlSection>
          </section>
        </>
      )}
    </div>
  );
}

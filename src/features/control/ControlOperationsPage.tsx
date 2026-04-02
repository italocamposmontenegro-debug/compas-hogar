import { useEffect, useState } from 'react';
import { AlertBanner, Button, Card, LoadingPage } from '../../components/ui';
import { AvailabilityNotes, ControlModuleIntro, ControlSection, ControlStatGrid, EmptyControlState, TonePill } from './components';
import { fetchControlModule } from './api';
import type { OperationsData } from './types';

export function ControlOperationsPage() {
  const [filters, setFilters] = useState({ severity: '', type: '', search: '' });
  const [submittedFilters, setSubmittedFilters] = useState(filters);
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchControlModule<OperationsData>('operations', submittedFilters);
        if (active) setData(response.data);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'No pudimos cargar Operations Room.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [submittedFilters]);

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Operaciones"
        title="Qué necesita intervención operativa ahora"
        description="La cola operativa v1 se construye desde anomalías reales detectables en billing, invitaciones y coherencia de households."
      />

      {error ? <AlertBanner type="danger" message={error} /> : null}

      {!data ? (
        <EmptyControlState
          title="No pudimos cargar la cola operativa"
          description="Cuando el backend responda, aquí verás los casos priorizados y su severidad."
        />
      ) : (
        <>
          <ControlStatGrid items={data.summary} />
          <AvailabilityNotes notes={data.availability_notes} />

          <ControlSection
            eyebrow="Filtros"
            title="Refinar la cola"
            description="Puedes acotar por severidad, tipo de incidente o un término de búsqueda."
          >
            <form
              className="grid gap-3 md:grid-cols-[180px_220px_minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmittedFilters(filters);
              }}
            >
              <select
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
                className="min-h-12 rounded-2xl border border-border bg-surface-low px-4 text-sm text-text outline-none"
              >
                <option value="">Todas las severidades</option>
                <option value="crítica">Crítica</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
              </select>
              <select
                value={filters.type}
                onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                className="min-h-12 rounded-2xl border border-border bg-surface-low px-4 text-sm text-text outline-none"
              >
                <option value="">Todos los tipos</option>
                <option value="billing_failed">Cobro fallido</option>
                <option value="billing_pending_stale">Pendiente prolongada</option>
                <option value="webhook_failed">Webhook fallido</option>
                <option value="multiple_households">Múltiples hogares</option>
                <option value="invitation_expired">Invitación vencida</option>
              </select>
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Buscar por hogar, usuario o texto del incidente"
                className="min-h-12 rounded-2xl border border-border bg-surface-low px-4 text-sm text-text outline-none"
              />
              <Button type="submit">Aplicar</Button>
            </form>
          </ControlSection>

          <ControlSection
            eyebrow="Cola"
            title="Casos priorizados"
            description="Incidentes abiertos detectados automáticamente por la capa operativa actual."
          >
            {data.incidents.length === 0 ? (
              <EmptyControlState
                title="No hay incidentes abiertos con esos filtros"
                description="Eso no significa ausencia total de riesgo, solo que no hay casos detectados con ese criterio."
              />
            ) : (
              <div className="space-y-3">
                {data.incidents.map((incident) => (
                  <Card key={String(incident.id)} className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text">{String(incident.title)}</p>
                        <p className="mt-1 text-xs text-text-light">{String(incident.type)}</p>
                      </div>
                      <TonePill tone={String(incident.severity) === 'crítica' ? 'danger' : String(incident.severity) === 'alta' ? 'warning' : 'neutral'}>
                        {String(incident.severity)}
                      </TonePill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">{String(incident.description)}</p>
                    {incident.household_name ? (
                      <p className="mt-3 text-xs text-text-light">Hogar: {String(incident.household_name)}</p>
                    ) : null}
                    {incident.user_id ? (
                      <p className="mt-1 text-xs text-text-light">Usuario: {String(incident.user_id)}</p>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </ControlSection>
        </>
      )}
    </div>
  );
}

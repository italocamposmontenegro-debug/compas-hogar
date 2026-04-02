import { useEffect, useState } from 'react';
import { AlertBanner, Button, Card, LoadingPage } from '../../components/ui';
import { AvailabilityNotes, ControlModuleIntro, ControlSection, EmptyControlState, TonePill } from './components';
import { fetchControlModule } from './api';
import type { Customer360Data } from './types';
import { Search } from 'lucide-react';

export function ControlCustomersPage() {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [data, setData] = useState<Customer360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchControlModule<Customer360Data>('customers', submittedSearch ? { search: submittedSearch } : {});
        if (active) setData(response.data);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'No pudimos cargar Customer 360.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [submittedSearch]);

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <ControlModuleIntro
        eyebrow="Clientes 360"
        title="Entender un usuario o un hogar sin entrar a ciegas a la base"
        description="Este módulo consolida lo necesario para soporte y operación: hogar, membresías, plan, invitaciones, actividad y señales de riesgo."
        aside={(
          <form
            className="flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
            }}
          >
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface-low px-4">
              <Search className="h-4 w-4 text-text-light" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por correo, nombre o hogar"
                className="w-full bg-transparent text-sm text-text outline-none"
              />
            </label>
            <Button type="submit">Buscar</Button>
          </form>
        )}
      />

      {error ? <AlertBanner type="danger" message={error} /> : null}

      {!data ? (
        <EmptyControlState
          title="No hay lectura Customer 360 disponible"
          description="Cuando el backend responda, aquí podrás inspeccionar usuarios y hogares sin entrar manualmente a la base."
        />
      ) : (
        <>
          <AvailabilityNotes notes={data.availability_notes} />

          <section className="grid gap-6 xl:grid-cols-2">
            <ControlSection
              eyebrow="Hogares"
              title="Ficha de hogar"
              description="Plan, owner, membresías, invitaciones y señales de fricción."
            >
              {data.households.length === 0 ? (
                <EmptyControlState
                  title="No encontramos hogares con ese criterio"
                  description="Prueba con un correo, nombre de persona o nombre de hogar distinto."
                />
              ) : (
                <div className="space-y-4">
                  {data.households.map((household) => (
                    <Card key={String(household.household_id)} className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-text">{String(household.household_name)}</p>
                          <p className="mt-1 text-xs text-text-light">{String(household.household_id)}</p>
                        </div>
                        <TonePill tone="neutral">
                          {String((household.subscription as Record<string, unknown> | null)?.visible_plan ?? 'Free')}
                        </TonePill>
                      </div>
                      <p className="mt-3 text-sm text-text-secondary">
                        Owner: {String(household.owner_name)} · {String(household.owner_email)}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-surface-low px-4 py-3 text-sm text-text-secondary">
                          <p className="font-medium text-text">Actividad</p>
                          <p className="mt-2">Movimientos: {String((household.activity as Record<string, unknown>)?.transactions ?? 0)}</p>
                          <p>Metas: {String((household.activity as Record<string, unknown>)?.goals ?? 0)}</p>
                          <p>Recurrencias: {String((household.activity as Record<string, unknown>)?.recurring_rules ?? 0)}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface-low px-4 py-3 text-sm text-text-secondary">
                          <p className="font-medium text-text">Miembros</p>
                          {((household.members as Array<Record<string, unknown>>) ?? []).map((member) => (
                            <p key={String(member.id)} className="mt-2">
                              {String(member.display_name)} · {String(member.role)} · {String(member.invitation_status)}
                            </p>
                          ))}
                        </div>
                      </div>
                      {Array.isArray(household.risks) && household.risks.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {(household.risks as string[]).map((risk) => (
                            <AlertBanner key={risk} type="warning" message={risk} />
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </ControlSection>

            <ControlSection
              eyebrow="Usuarios"
              title="Ficha de usuario"
              description="Roles, memberships, hogar operativo visible y riesgos de inconsistencia."
            >
              {data.users.length === 0 ? (
                <EmptyControlState
                  title="No encontramos usuarios con ese criterio"
                  description="Ajusta la búsqueda para revisar otra cuenta."
                />
              ) : (
                <div className="space-y-4">
                  {data.users.map((user) => (
                    <Card key={String(user.user_id)} className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-text">{String(user.full_name)}</p>
                          <p className="mt-1 text-xs text-text-light">{String(user.email)}</p>
                        </div>
                        {Array.isArray(user.control_roles) && user.control_roles.length > 0 ? (
                          <TonePill tone="warning">{String((user.control_roles as string[]).join(', '))}</TonePill>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-text-secondary">
                        {((user.memberships as Array<Record<string, unknown>>) ?? []).map((membership) => (
                          <div key={`${String(membership.household_id)}:${String(membership.role)}`} className="rounded-2xl border border-border bg-surface-low px-4 py-3">
                            <p className="font-medium text-text">{String(membership.household_name)}</p>
                            <p className="mt-2">
                              {String(membership.role)} · {String(membership.visible_plan)} · {String(membership.subscription_status)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {Array.isArray(user.risks) && user.risks.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {(user.risks as string[]).map((risk) => (
                            <AlertBanner key={risk} type="warning" message={risk} />
                          ))}
                        </div>
                      ) : null}
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

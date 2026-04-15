import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, DollarSign, Home, Link as LinkIcon, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { AlertBanner, Button, Card, InputField } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import type { Database } from '../../types/database';
import { validateEmail, validateHouseholdName } from '../../utils/validators';

const STEPS = [
  { id: 'hogar', label: 'Nombren su hogar', hint: 'Este espacio es para ordenar lo que construyen juntos.', icon: Home },
  { id: 'primer-mes', label: 'Carguen su primer mes', hint: 'En minutos verán cuánto entró, qué pagos vienen y qué falta por cubrir.', icon: DollarSign },
  { id: 'invitar', label: 'Invita a tu pareja', hint: 'Lo ideal es que ambos vean el mismo mes desde el inicio.', icon: Users },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const { refetch } = useHousehold();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [householdName, setHouseholdName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [skipInvite, setSkipInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const currentStep = STEPS[step];
  type CreateHouseholdSetupArgs = Database['public']['Functions']['create_household_setup']['Args'];
  type CreateHouseholdSetupResult = Database['public']['Functions']['create_household_setup']['Returns'];

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccessMessage('Enlace de respaldo copiado. Puedes compartirlo si hace falta.');
    } catch {
      window.prompt('Copia este enlace para compartirlo:', inviteLink);
    }
  }

  async function handleNext() {
    setError('');
    setSuccessMessage('');

    if (step === 0) {
      const householdCheck = validateHouseholdName(householdName);
      if (!householdCheck.valid) return setError(householdCheck.error || 'Revisa el nombre del hogar.');
    }

    if (step === 2 && !skipInvite && memberEmail.trim()) {
      const emailCheck = validateEmail(memberEmail);
      if (!emailCheck.valid) return setError(emailCheck.error || 'Revisa el email.');
    }

    if (step === STEPS.length - 1) {
      await finishOnboarding();
      return;
    }

    setStep((value) => value + 1);
  }

  async function finishOnboarding() {
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      let rpcError: { message?: string } | null = null;
      let invitationTokenId: string | null = null;
      let newHouseholdId: string | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const args: CreateHouseholdSetupArgs = {
          p_name: householdName,
          p_split_rule: 'fifty_fifty',
          p_monthly_income: 0,
          p_goal_name: null,
          p_goal_amount: 0,
          p_goal_date:
            new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
          p_partner_email: !skipInvite && memberEmail ? memberEmail : null,
        };
        const rpcResponse = await supabase.rpc('create_household_setup', args as never);
        const data = rpcResponse.data as CreateHouseholdSetupResult | null;
        const rpcResultError = rpcResponse.error;

        rpcError = rpcResultError;
        invitationTokenId = data?.invitation_token_id ?? null;
        newHouseholdId = data?.household_id ?? null;

        if (!rpcResultError || !rpcResultError.message?.includes('Lock')) break;
        await new Promise((resolve) => window.setTimeout(resolve, 800));
      }

      if (rpcError) throw new Error(rpcError.message || 'No pudimos crear el hogar.');

      await refetch();
      trackEvent('household_created', {
        household_id: newHouseholdId,
        invited_partner: !skipInvite && !!memberEmail,
      });
      trackEvent('onboarding_completed', {
        household_id: newHouseholdId,
        invited_partner: !skipInvite && !!memberEmail,
      });

      if (invitationTokenId) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('invitation_tokens')
          .select('token')
          .eq('id', invitationTokenId)
          .maybeSingle<{ token: string }>();

        if (tokenError || !tokenData) {
          throw new Error('El hogar quedó creado, pero no pudimos preparar el enlace de invitación.');
        }

        trackEvent('partner_invite_sent', {
          household_id: newHouseholdId,
          source: 'onboarding',
        });
        setInviteLink(`${window.location.origin}/invitacion/${tokenData.token}`);
        setSuccessMessage('Hogar listo. La invitación para tu pareja quedó preparada y ya puedes seguir con el primer ingreso del mes.');
        return;
      }

      navigate('/app/ingresos?create=1&welcome=1');
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : 'No pudimos completar la configuración.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:px-6 sm:py-8">
      <div className="page-shell flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Configuración inicial</p>
              <h1 className="section-heading mt-2 text-3xl text-text">Pongan el hogar en marcha de verdad.</h1>
            </div>
            <p className="text-sm text-text-muted">
              Paso {step + 1} de {STEPS.length}
            </p>
          </div>

          <ol className="mb-6 grid gap-3 lg:grid-cols-5" aria-label="Progreso del onboarding">
            {STEPS.map((item, index) => {
              const isCurrent = index === step;
              const isCompleted = index < step;
              return (
                <li key={item.id}>
                  <div
                    className={`ui-panel h-full p-4 ${isCurrent ? 'border-primary/25 bg-primary-bg/45' : 'ui-panel-subtle'} ${
                      isCompleted ? 'border-success/20 bg-success-bg' : ''
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          isCompleted
                            ? 'bg-success text-white'
                            : isCurrent
                              ? 'bg-primary text-white'
                              : 'bg-surface text-text-muted'
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <item.icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text">{item.label}</p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <Card padding="lg">
            <header className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Paso actual</p>
              <h2 className="section-heading mt-2 text-2xl text-text">{currentStep.label}</h2>
              <p className="mt-3 text-sm leading-7 text-text-muted">{currentStep.hint}</p>
            </header>

            <div className="space-y-4">
              {error ? <AlertBanner type="danger" message={error} onClose={() => setError('')} /> : null}
              {successMessage ? (
                <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage('')} />
              ) : null}

              {inviteLink ? (
                <div className="space-y-5">
                  <InputField label="Enlace de invitación" value={inviteLink} onChange={() => {}} readOnly />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => navigate('/app/ingresos?create=1&welcome=1')}>
                      Registrar primer ingreso
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" onClick={copyInviteLink}>
                      <LinkIcon className="h-4 w-4" />
                      Copiar enlace de respaldo
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {step === 0 ? (
                    <InputField
                      label="Nombre del hogar"
                      value={householdName}
                      onChange={(event) => setHouseholdName(event.target.value)}
                      placeholder='Ej: "Hogar Pérez-González"'
                      required
                    />
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-4">
                      <div className="ui-panel ui-panel-subtle p-5">
                        <p className="text-base font-semibold text-text">En 2 minutos Compás te mostrará la base real del hogar.</p>
                        <p className="mt-3 text-sm leading-7 text-text-muted">
                          Primero cargarás cuánto entró este mes. Después dejarás visibles los pagos que no pueden esperar. Con eso ya podrán ver una primera lectura clara del hogar y empezar a decidir mejor.
                        </p>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-border bg-bg/70 px-4 py-4">
                        <p className="text-sm font-semibold text-text">Orden sugerido</p>
                        <ol className="space-y-2 text-sm leading-6 text-text-muted">
                          <li>1. Registrar el ingreso principal del mes.</li>
                          <li>2. Dejar visibles los pagos obligatorios.</li>
                          <li>3. Anotar el primer gasto compartido real.</li>
                          <li>4. Ver cuánto queda por cubrir.</li>
                        </ol>
                      </div>
                      <AlertBanner
                        type="info"
                        message="Más adelante podrás ajustar cómo reparten los gastos del hogar desde Configuración."
                      />
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      {!skipInvite ? (
                        <>
                          <InputField
                            label="Correo de tu pareja"
                            type="email"
                            value={memberEmail}
                            onChange={(event) => setMemberEmail(event.target.value)}
                            placeholder="pareja@email.com"
                          />
                          <button
                            type="button"
                            onClick={() => setSkipInvite(true)}
                            className="text-sm font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
                          >
                            Lo haré después
                          </button>
                        </>
                      ) : (
                        <div className="ui-panel ui-panel-subtle p-5">
                          <p className="text-sm leading-7 text-text-muted">
                            Podrás invitar a tu pareja después, pero el mayor valor aparece cuando ambos ven el mismo mes.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSkipInvite(false)}
                            className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Invitar ahora
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border-light pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setStep((value) => Math.max(0, value - 1))}
                      disabled={step === 0 || loading}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Atrás
                    </Button>
                    <Button onClick={handleNext} loading={loading}>
                      {step === STEPS.length - 1 ? 'Entrar y registrar ingreso' : 'Siguiente'}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

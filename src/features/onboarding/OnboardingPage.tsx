import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, DollarSign, Home, Link as LinkIcon, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { AlertBanner, Button, Card, InputField } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { validateEmail, validateHouseholdName } from '../../utils/validators';

const STEPS = [
  { id: 'hogar', label: 'Crea el hogar', hint: 'Ponle nombre al espacio que comparten.', icon: Home },
  { id: 'primer-mes', label: 'Empieza por este mes', hint: 'Lo primero será registrar ingreso, pagos y gasto real.', icon: DollarSign },
  { id: 'invitar', label: 'Invita a tu pareja', hint: 'Puedes hacerlo ahora o después, sin frenar el arranque.', icon: Users },
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
        const { data, error: rpcResultError } = await supabase.rpc('create_household_setup', {
          p_name: householdName,
          p_split_rule: 'fifty_fifty',
          p_monthly_income: 0,
          p_goal_name: null,
          p_goal_amount: 0,
          p_goal_date:
            new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
          p_partner_email: !skipInvite && memberEmail ? memberEmail : null,
        });

        rpcError = rpcResultError;
        invitationTokenId = data?.invitation_token_id ?? null;
        newHouseholdId = data?.household_id ?? null;

        if (!rpcResultError || !rpcResultError.message?.includes('Lock')) break;
        await new Promise((resolve) => window.setTimeout(resolve, 800));
      }

      if (rpcError) throw new Error(rpcError.message || 'No pudimos crear el hogar.');

      await refetch();
      trackEvent('onboarding_completed', {
        household_id: newHouseholdId,
        invited_partner: !skipInvite && !!memberEmail,
      });

      if (invitationTokenId) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('invitation_tokens')
          .select('token')
          .eq('id', invitationTokenId)
          .maybeSingle();

        if (tokenError || !tokenData) {
          throw new Error('El hogar quedó creado, pero no pudimos preparar el enlace de invitación.');
        }

        setInviteLink(`${window.location.origin}/invitacion/${tokenData.token}`);
        setSuccessMessage('Hogar listo. La invitación quedó preparada y ya puedes seguir con el primer ingreso del mes.');
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
              <h1 className="section-heading mt-2 text-3xl text-text">Pongan el hogar en marcha.</h1>
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
                        <p className="text-base font-semibold text-text">Lo primero será registrar este mes como realmente pasó.</p>
                        <p className="mt-3 text-sm leading-7 text-text-muted">
                          Apenas entres, partirás por anotar cuánto dinero entró. Después podrás sumar pagos obligatorios y el gasto del día a día.
                        </p>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-border bg-bg/70 px-4 py-4">
                        <p className="text-sm font-semibold text-text">Orden sugerido</p>
                        <ol className="space-y-2 text-sm leading-6 text-text-muted">
                          <li>1. Registrar primer ingreso del mes.</li>
                          <li>2. Dejar visibles los pagos que no se pueden pasar.</li>
                          <li>3. Anotar el primer gasto del día a día.</li>
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
                            label="Email del nuevo miembro"
                            type="email"
                            value={memberEmail}
                            onChange={(event) => setMemberEmail(event.target.value)}
                            placeholder="miembro@email.com"
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
                            Podrás invitar al otro miembro desde Configuración cuando el hogar ya esté andando.
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

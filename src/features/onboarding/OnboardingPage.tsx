import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, DollarSign, Home, Link as LinkIcon, Scale, Target, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { AlertBanner, Button, Card, InputField } from '../../components/ui';
import { SPLIT_RULE_DESCRIPTIONS, SPLIT_RULE_LABELS, type SplitRuleType } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { validateAmount, validateEmail, validateHouseholdName } from '../../utils/validators';
import { formatCLP } from '../../utils/format-clp';

const STEPS = [
  { id: 'hogar', label: 'Crea el hogar', hint: 'Ponle nombre al espacio compartido.', icon: Home },
  { id: 'ingresos', label: 'Define el ingreso base', hint: 'Esto da contexto a la lectura del mes.', icon: DollarSign },
  { id: 'reparto', label: 'Deja una regla inicial', hint: 'La base del reparto puede ajustarse después.', icon: Scale },
  { id: 'meta', label: 'Si quieres, suma una meta', hint: 'Una meta visible ayuda a decidir mejor.', icon: Target },
  { id: 'invitar', label: 'Invita a otro miembro', hint: 'Puedes hacerlo ahora o más adelante.', icon: Users },
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
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [splitRule] = useState<SplitRuleType>('fifty_fifty');
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [skipInvite, setSkipInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const currentStep = STEPS[step];

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccessMessage('Enlace copiado. Ya puedes compartirlo.');
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

    if (step === 1) {
      const amountCheck = validateAmount(monthlyIncome);
      if (!amountCheck.valid) return setError(amountCheck.error || 'Revisa el ingreso mensual.');
    }

    if (step === 4 && !skipInvite && memberEmail.trim()) {
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
          p_split_rule: splitRule,
          p_monthly_income: Number.parseInt(monthlyIncome, 10) || 0,
          p_goal_name: goalName || null,
          p_goal_amount: Number.parseInt(goalAmount, 10) || 0,
          p_goal_date:
            goalDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
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
        setSuccessMessage('Hogar listo. Comparte este enlace para sumar al otro miembro.');
        return;
      }

      navigate('/app/dashboard?welcome=1');
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
              <h1 className="section-heading mt-2 text-3xl text-text">Pon el hogar en marcha.</h1>
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
                    <Button onClick={() => navigate('/app/dashboard?welcome=1')}>
                      Ir al panel
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" onClick={copyInviteLink}>
                      <LinkIcon className="h-4 w-4" />
                      Copiar enlace
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
                      <InputField
                        label="Ingreso mensual (CLP)"
                        type="number"
                        value={monthlyIncome}
                        onChange={(event) => setMonthlyIncome(event.target.value)}
                        placeholder="Ej: 1200000"
                        required
                      />
                      {monthlyIncome && Number.parseInt(monthlyIncome, 10) > 0 ? (
                        <p className="text-sm text-text-muted">Base del mes: {formatCLP(Number.parseInt(monthlyIncome, 10))}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      <div className="ui-panel ui-panel-subtle p-5">
                        <p className="text-sm font-medium text-text">{SPLIT_RULE_LABELS[splitRule]}</p>
                        <p className="mt-2 text-sm leading-7 text-text-muted">{SPLIT_RULE_DESCRIPTIONS[splitRule]}</p>
                      </div>
                      <AlertBanner
                        type="info"
                        message="La base inicial queda en 50/50. Si el hogar necesita reglas más flexibles, se habilitan desde un plan superior."
                      />
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InputField
                        label="Nombre de la meta"
                        value={goalName}
                        onChange={(event) => setGoalName(event.target.value)}
                        placeholder='Ej: "Fondo de emergencia"'
                      />
                      <InputField
                        label="Monto objetivo (CLP)"
                        type="number"
                        value={goalAmount}
                        onChange={(event) => setGoalAmount(event.target.value)}
                        placeholder="Ej: 500000"
                      />
                      <div className="sm:col-span-2">
                        <InputField
                          label="Fecha objetivo"
                          type="date"
                          value={goalDate}
                          onChange={(event) => setGoalDate(event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {step === 4 ? (
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
                      {step === STEPS.length - 1 ? 'Entrar al hogar' : 'Siguiente'}
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

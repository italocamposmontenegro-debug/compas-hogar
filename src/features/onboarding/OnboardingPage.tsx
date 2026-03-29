// ============================================
// Casa Clara — Onboarding Page
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { Button, InputField, Card, AlertBanner } from '../../components/ui';
import { SPLIT_RULE_LABELS, SPLIT_RULE_DESCRIPTIONS, type SplitRuleType } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { Home, ArrowRight, ArrowLeft, Users, DollarSign, Scale, Target, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { validateHouseholdName, validateAmount, validateEmail } from '../../utils/validators';
import { formatCLP } from '../../utils/format-clp';

const STEPS = [
  { id: 'hogar', label: 'Crear hogar', icon: Home },
  { id: 'ingresos', label: 'Ingresos', icon: DollarSign },
  { id: 'reparto', label: 'Regla de reparto', icon: Scale },
  { id: 'meta', label: 'Primera meta', icon: Target },
  { id: 'invitar', label: 'Invitar pareja', icon: Users },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const { refetch } = useHousehold();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [householdName, setHouseholdName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [splitRule] = useState<SplitRuleType>('fifty_fifty');
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [skipInvite, setSkipInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const currentStep = STEPS[step];

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteMessage('Enlace copiado. Ya puedes compartirlo con tu pareja.');
    } catch {
      window.prompt('Copia este enlace para invitar a tu pareja:', inviteLink);
    }
  }

  const handleNext = async () => {
    setError('');

    if (step === 0) {
      const check = validateHouseholdName(householdName);
      if (!check.valid) return setError(check.error!);
    }
    if (step === 1) {
      const check = validateAmount(monthlyIncome);
      if (!check.valid) return setError(check.error!);
    }
    if (step === 4 && !skipInvite && partnerEmail.trim()) {
      const check = validateEmail(partnerEmail);
      if (!check.valid) return setError(check.error!);
    }

    if (step === STEPS.length - 1) {
      await finishOnboarding();
      return;
    }

    setStep(s => s + 1);
  };

  const finishOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      let rpcError: { message?: string } | null = null;
      let invitationTokenId: string | null = null;
      let newHouseholdId: string | null = null;

      // Retry logic for Supabase GoTrue "Lock stolen" race conditions
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase.rpc('create_household_setup', {
          p_name: householdName,
          p_split_rule: splitRule,
          p_monthly_income: parseInt(monthlyIncome) || 0,
          p_goal_name: goalName || null,
          p_goal_amount: parseInt(goalAmount) || 0,
          p_goal_date: goalDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
          p_partner_email: (!skipInvite && partnerEmail) ? partnerEmail : null
        });
        
        rpcError = error;
        invitationTokenId = data?.invitation_token_id ?? null;
        newHouseholdId = data?.household_id ?? null;
        
        // If success, or error is NOT a Lock issue, break out of loop
        if (!error || !(error.message && error.message.includes('Lock'))) break;
        
        // Wait 800ms before retrying
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (rpcError) throw new Error(rpcError.message || 'No pudimos crear el hogar');

      await refetch();
      trackEvent('onboarding_completed', {
        household_id: newHouseholdId,
        invited_partner: (!skipInvite && !!partnerEmail) || !!invitationTokenId,
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
        setInviteMessage('Hogar listo. Comparte el enlace para sumar a tu pareja.');
        return;
      }

      navigate('/app/dashboard?welcome=1');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'No pudimos completar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-success text-white' :
                i === step ? 'bg-primary text-white' :
                'bg-border text-text-muted'
              }`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            {currentStep && <currentStep.icon className="h-6 w-6 text-primary" />}
            <h2 className="text-xl font-bold text-text">{currentStep?.label}</h2>
          </div>

          {error && <p className="text-sm text-danger mb-4">{error}</p>}
          {inviteMessage && <div className="mb-4"><AlertBanner type="success" message={inviteMessage} onClose={() => setInviteMessage('')} /></div>}

          {/* Step content */}
          {inviteLink ? (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Hogar listo. Comparte el enlace para sumar a tu pareja.
              </p>
              <InputField label="Enlace de invitación" value={inviteLink} onChange={() => {}} readOnly />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => navigate('/app/dashboard?welcome=1')}>
                  Ir al panel <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="secondary" onClick={copyInviteLink}>
                  <LinkIcon className="h-4 w-4" /> Copiar enlace
                </Button>
                <Button variant="ghost" onClick={() => navigate('/app/suscripcion')}>
                  Ver planes
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                El siguiente paso útil es registrar el primer movimiento o crear una meta. El enlace también quedará disponible en Configuración.
              </p>
            </div>
          ) : (
            <>
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Nombra tu hogar para comenzar el orden compartido.</p>
                  <InputField label="Nombre del hogar" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder='Ej: "Hogar Pérez-González"' />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Define el ingreso mensual para la lectura del mes.</p>
                  <InputField label="Ingreso mensual (CLP)" type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} placeholder="Ej: 1200000" />
                  {monthlyIncome && parseInt(monthlyIncome) > 0 && (
                    <p className="text-xs text-text-muted">= {formatCLP(parseInt(monthlyIncome))}</p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Regla base de reparto para el primer mes.</p>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="font-medium text-text text-sm">{SPLIT_RULE_LABELS[splitRule]}</p>
                    <p className="text-xs text-text-muted mt-1">{SPLIT_RULE_DESCRIPTIONS[splitRule]}</p>
                  </div>
                  <AlertBanner
                    type="info"
                    message="Las reglas flexibles se habilitan desde Esencial. Por ahora tu hogar quedará con 50/50."
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Opcional: Define una meta inicial para el hogar.</p>
                  <InputField label="Nombre de la meta" value={goalName} onChange={e => setGoalName(e.target.value)} placeholder='Ej: "Vacaciones", "Fondo de emergencia"' />
                  <InputField label="Monto objetivo (CLP)" type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="Ej: 500000" />
                  <InputField label="Fecha objetivo" type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Suma a tu pareja para ver el mes con claridad.</p>
                  {!skipInvite ? (
                    <>
                      <InputField label="Email de tu pareja" type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="pareja@email.com" />
                      <button onClick={() => setSkipInvite(true)} className="text-xs text-text-muted hover:text-text cursor-pointer">
                        Omitir por ahora →
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-text-muted mb-2">Podrás invitar a tu pareja después desde Configuración.</p>
                      <button onClick={() => setSkipInvite(false)} className="text-xs text-primary cursor-pointer">
                        ← Quiero invitar ahora
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-8">
                <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
                  <ArrowLeft className="h-4 w-4" /> Atrás
                </Button>
                <Button onClick={handleNext} loading={loading}>
                  {step === STEPS.length - 1 ? 'Entrar al hogar' : 'Siguiente'} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

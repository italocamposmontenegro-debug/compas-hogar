// ============================================
// Casa Clara — Onboarding Page
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { Button, InputField, Card } from '../../components/ui';
import { SPLIT_RULE_LABELS, SPLIT_RULE_DESCRIPTIONS, DEFAULT_CATEGORIES, type SplitRuleType } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { Home, ArrowRight, ArrowLeft, Users, DollarSign, Scale, Target, CheckCircle } from 'lucide-react';
import { validateHouseholdName, validateAmount } from '../../utils/validators';
import { formatCLP } from '../../utils/format-clp';

const STEPS = [
  { id: 'hogar', label: 'Crear hogar', icon: Home },
  { id: 'ingresos', label: 'Ingresos', icon: DollarSign },
  { id: 'reparto', label: 'Regla de reparto', icon: Scale },
  { id: 'meta', label: 'Primera meta', icon: Target },
  { id: 'invitar', label: 'Invitar pareja', icon: Users },
];

export function OnboardingPage() {
  const { user, profile } = useAuth();
  const { refetch } = useHousehold();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [householdName, setHouseholdName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [splitRule, setSplitRule] = useState<SplitRuleType>('50_50');
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [skipInvite, setSkipInvite] = useState(false);

  const currentStep = STEPS[step];

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
      let rpcError: any = null;
      
      // Retry logic for Supabase GoTrue "Lock stolen" race conditions
      for (let i = 0; i < 3; i++) {
        // @ts-ignore: Next gen RPC call not yet synced to types
        const { error } = await supabase.rpc('create_household_setup', {
          p_name: householdName,
          p_split_rule: splitRule === '50_50' ? 'fifty_fifty' : splitRule,
          p_monthly_income: parseInt(monthlyIncome) || 0,
          p_goal_name: goalName || null,
          p_goal_amount: parseInt(goalAmount) || 0,
          p_goal_date: goalDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
          p_partner_email: (!skipInvite && partnerEmail) ? partnerEmail : null
        });
        
        rpcError = error;
        
        // If success, or error is NOT a Lock issue, break out of loop
        if (!error || !(error.message && error.message.includes('Lock'))) break;
        
        // Wait 800ms before retrying
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (rpcError) throw new Error(rpcError.message || 'Error al inicializar el hogar');

      await refetch();
      navigate('/app/suscripcion');
    } catch (err: any) {
      setError(err.message || 'Error durante el onboarding');
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

          {/* Step content */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">Dale un nombre a tu hogar para empezar.</p>
              <InputField label="Nombre del hogar" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder='Ej: "Hogar Pérez-González"' />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">¿Cuál es tu ingreso mensual aproximado? Puedes ajustarlo después.</p>
              <InputField label="Ingreso mensual (CLP)" type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} placeholder="Ej: 1200000" />
              {monthlyIncome && parseInt(monthlyIncome) > 0 && (
                <p className="text-xs text-text-muted">= {formatCLP(parseInt(monthlyIncome))}</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">¿Cómo quieres repartir los gastos compartidos?</p>
              <div className="space-y-3">
                {(Object.entries(SPLIT_RULE_LABELS) as [SplitRuleType, string][]).map(([key, label]) => (
                  <label key={key} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    splitRule === key ? 'border-primary bg-primary-bg/50' : 'border-border hover:border-primary/30'
                  }`}>
                    <input type="radio" name="split" value={key} checked={splitRule === key} onChange={() => setSplitRule(key)} className="mt-1" />
                    <div>
                      <p className="font-medium text-text text-sm">{label}</p>
                      <p className="text-xs text-text-muted">{SPLIT_RULE_DESCRIPTIONS[key]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">Define tu primera meta de ahorro. Es opcional pero te ayudará a enfocarte.</p>
              <InputField label="Nombre de la meta" value={goalName} onChange={e => setGoalName(e.target.value)} placeholder='Ej: "Vacaciones", "Fondo de emergencia"' />
              <InputField label="Monto objetivo (CLP)" type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="Ej: 500000" />
              <InputField label="Fecha objetivo" type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">Si compartes hogar, invita a tu pareja. También puedes hacerlo después.</p>
              {!skipInvite ? (
                <>
                  <InputField label="Email de tu pareja" type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="pareja@email.com" />
                  <button onClick={() => setSkipInvite(true)} className="text-xs text-text-muted hover:text-text cursor-pointer">
                    Omitir por ahora →
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-text-muted mb-2">Podrás invitar a tu pareja después desde la configuración.</p>
                  <button onClick={() => setSkipInvite(false)} className="text-xs text-primary cursor-pointer">
                    ← Quiero invitar ahora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Atrás
            </Button>
            <Button onClick={handleNext} loading={loading}>
              {step === STEPS.length - 1 ? 'Crear mi hogar' : 'Siguiente'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

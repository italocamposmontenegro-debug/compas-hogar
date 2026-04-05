// Casa Clara — Guided Close Page (Plus)
import { useCallback, useEffect, useState } from 'react';
import { Card, Button, LoadingSpinner, StatCard, FeatureGate, AlertBanner } from '../../components/ui';
import { ClipboardCheck, CheckCircle, ArrowRight, Wallet, PieChart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../hooks/useHousehold';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { formatCLP } from '../../utils/format-clp';
import { startOfMonth, endOfMonth } from 'date-fns';

export function GuidedClosePage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { hasFeature } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    try {
      const now = new Date();
      const start = startOfMonth(now).toISOString();
      const end = endOfMonth(now).toISOString();

      const { data: txs } = await supabase.from('transactions')
        .select('amount_clp, type')
        .eq('household_id', household.id!)
        .is('deleted_at', null)
        .gte('occurred_on', start)
        .lte('occurred_on', end);

      const income = (txs || []).filter((t) => t.type === 'income').reduce((acc, curr) => acc + curr.amount_clp, 0);
      const expenses = (txs || []).filter((t) => t.type === 'expense').reduce((acc, curr) => acc + curr.amount_clp, 0);
      
      setTotals({ income, expenses, balance: income - expenses });
    } finally {
      setLoading(false);
    }
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFinish = async () => {
    if (!household || !user) return;
    setSaving(true);
    setMsg('');
    
    const now = new Date();
    const { error } = await supabase.functions.invoke('save-monthly-review', {
      body: {
        householdId: household.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        totalIncome: totals.income,
        totalExpenses: totals.expenses,
        totalSavings: Math.max(0, totals.balance),
        summaryData: { balance: totals.balance },
      },
    });

    if (!error) {
      setFinished(true);
    } else {
      setMsg(error.message || 'No pudimos guardar el cierre de este mes.');
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;


  if (loading) return <LoadingSpinner />;

  if (finished) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="h-20 w-20 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Mes cerrado</h1>
        <p className="text-text-muted mb-8">
          Resumen guardado correctamente.
        </p>
        <Button onClick={() => window.location.href = '/app/resumen'}>Ir al Resumen</Button>
      </div>
    );
  }

  return (
    <FeatureGate feature="monthly_close_simple">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-6">Cierre mensual</h1>
        {msg && <div className="mb-4"><AlertBanner type="danger" message={msg} onClose={() => setMsg('')} /></div>}
        {hasFeature('guided_close_advanced') && (
          <div className="mb-4">
            <AlertBanner
              type="info"
              message="Tu plan Premium incluye cierre guiado avanzado. Usa este cierre para dejar guardada una foto clara del mes."
            />
          </div>
        )}
        
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard label="Ingresos totales" value={formatCLP(totals.income)} icon={<Wallet className="text-success" />} />
              <StatCard label="Gastos totales" value={formatCLP(totals.expenses)} icon={<PieChart className="text-danger" />} />
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold uppercase tracking-widest opacity-60">Balance final</span>
                <span className={`text-xl font-bold ${totals.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCLP(totals.balance)}
                </span>
              </div>
              <p className="text-sm text-text-muted mb-6">
                Monto remanente tras procesar todos los gastos compartidos.
              </p>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <div className="text-center py-6">
                <ClipboardCheck className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">¿Todo en orden?</h2>
                <p className="text-sm text-text-muted mb-8 max-w-sm mx-auto">
                  Al confirmar, se guardará una foto de este mes en el historial.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="secondary" onClick={() => setStep(1)}>Atrás</Button>
                  <Button onClick={handleFinish} loading={saving}>Finalizar cierre</Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

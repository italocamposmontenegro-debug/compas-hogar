import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, Button, Card, ConfirmDialog, EmptyState, PlanBadge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import { DashboardCharts } from './DashboardCharts';
import {
  buildHouseholdMonthSnapshot,
  calculateHouseholdBalance,
  getTransactionFlowType,
  isDayToDayExpenseFlow,
  type HouseholdBalanceSummary,
  type HouseholdMonthSnapshot,
} from '../../lib/household-finance';
import type { Category, PaymentCalendarItem, SavingsGoal, Transaction } from '../../types/database';
import { buildFinancialInsights } from '../../utils/financial-insights';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const { household, members, currentMember } = useHousehold();
  const { planName, hasFeature, getUpgradeCopy } = useSubscription();
  const { year, month } = getCurrentMonthYear();
  const { start, end } = getMonthRange(year, month);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentCalendarItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'danger'>('success');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!household) return;
    const householdId = household.id;
    setLoading(true);

    const [transactionsResult, previousTransactionsResult, paymentsResult, categoriesResult, goalsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('household_id', householdId)
          .gte('occurred_on', start)
          .lte('occurred_on', end)
          .is('deleted_at', null),
        supabase
          .from('transactions')
          .select('*')
          .eq('household_id', householdId)
          .gte('occurred_on', prevStart)
          .lte('occurred_on', prevEnd)
          .is('deleted_at', null),
        supabase
          .from('payment_calendar_items')
          .select('*')
          .eq('household_id', householdId)
          .gte('due_date', start)
          .lte('due_date', end)
          .order('due_date'),
        supabase
          .from('categories')
          .select('*')
          .eq('household_id', householdId)
          .is('deleted_at', null)
          .order('sort_order'),
        supabase
          .from('savings_goals')
          .select('*')
          .eq('household_id', householdId)
          .order('is_primary', { ascending: false }),
    ]);

    setTransactions((transactionsResult.data || []) as Transaction[]);
    setPreviousTransactions((previousTransactionsResult.data || []) as Transaction[]);
    setPayments((paymentsResult.data || []) as PaymentCalendarItem[]);
    setCategories((categoriesResult.data || []) as Category[]);
    setGoals((goalsResult.data || []) as SavingsGoal[]);
    setLoading(false);
  }, [end, household, prevEnd, prevStart, start]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const snapshot = useMemo<HouseholdMonthSnapshot>(() => buildHouseholdMonthSnapshot({
    transactions,
    payments,
    goals,
    categories,
  }), [categories, goals, payments, transactions]);

  const balanceSummary = useMemo<HouseholdBalanceSummary>(() => calculateHouseholdBalance({
    household,
    members,
    transactions,
    categories,
  }), [categories, household, members, transactions]);

  const insights = useMemo(() => buildFinancialInsights({
    currentTransactions: transactions,
    previousTransactions,
    upcomingPayments: payments,
    primaryGoal: snapshot.primaryGoal,
    categories,
    currentYear: year,
    currentMonth: month,
  }), [categories, month, payments, previousTransactions, snapshot.primaryGoal, transactions, year]);

  const firstAlert = useMemo(() => {
    if (snapshot.totalIncome === 0) {
      return 'Todavía no hay ingresos registrados. Parte por anotar cuánto dinero entró al hogar.';
    }
    if (payments.some((payment) => payment.status === 'overdue')) {
      return 'Hay pagos vencidos. Conviene ponerlos al día antes de seguir cargando gasto variable.';
    }
    if (snapshot.availableReal < 0) {
      return 'El disponible real ya está negativo. Conviene frenar gasto variable y revisar qué pago del hogar presionó más.';
    }
    return insights.alerts[0]?.message ?? 'El mes está legible. Lo importante ahora es sostener el orden y cerrar sin sorpresas.';
  }, [insights.alerts, payments, snapshot.availableReal, snapshot.totalIncome]);

  const firstLearning = useMemo(() => {
    const topDayToDay = transactions
      .filter((transaction) => isDayToDayExpenseFlow(getTransactionFlowType(transaction, categories)))
      .sort((left, right) => right.amount_clp - left.amount_clp)[0];

    if (insights.recommendations[0]) return insights.recommendations[0].message;
    if (topDayToDay) {
      return `${topDayToDay.description} fue de los registros más pesados del mes. Vale la pena mirar si se repetirá el próximo.`;
    }
    return 'A medida que registren más meses, aquí aparecerán aprendizajes simples para decidir mejor el siguiente.';
  }, [categories, insights.recommendations, transactions]);

  const checklist = [
    {
      done: snapshot.totalIncome > 0,
      title: 'Registrar primer ingreso',
      description: 'Empieza por dejar claro cuánto dinero entró.',
      actionLabel: snapshot.totalIncome > 0 ? 'Ver ingresos' : 'Registrar ingreso',
      onAction: () => navigate(snapshot.totalIncome > 0 ? '/app/ingresos' : '/app/ingresos?create=1'),
    },
    {
      done: payments.length > 0,
      title: 'Registrar primer pago obligatorio',
      description: 'Deja visibles las cuentas que no se pueden pasar.',
      actionLabel: payments.length > 0 ? 'Ver pagos' : 'Registrar pago',
      onAction: () => navigate(payments.length > 0 ? '/app/pagos' : '/app/pagos?create=1'),
    },
    {
      done: snapshot.totalDayToDayExpenses > 0,
      title: 'Registrar primer gasto variable',
      description: 'Así empieza a verse cuánto queda de verdad.',
      actionLabel: snapshot.totalDayToDayExpenses > 0 ? 'Ver gastos' : 'Registrar gasto',
      onAction: () => navigate(snapshot.totalDayToDayExpenses > 0 ? '/app/gastos' : '/app/gastos?create=1'),
    },
    {
      done: snapshot.totalSavings > 0,
      title: 'Registrar ahorro opcional',
      description: 'Aunque sea pequeño, te ayuda a ordenar el mes.',
      actionLabel: snapshot.totalSavings > 0 ? 'Ver ahorro' : 'Registrar ahorro',
      onAction: () => navigate(snapshot.totalSavings > 0 ? '/app/ahorro' : '/app/ahorro?create=1'),
    },
    {
      done: balanceSummary.origins.length > 0,
      title: 'Entender Saldo Hogar',
      description: 'Mira si alguno adelantó más de lo que correspondía.',
      actionLabel: 'Abrir Saldo Hogar',
      onAction: () => navigate('/app/saldo-hogar'),
    },
  ];

  const premiumUpgrade = getUpgradeCopy('monthly_comparison');
  const isOwner = currentMember?.role === 'owner';

  async function handleResetHouseholdData() {
    setResettingData(true);
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('reset-household-data', {
        body: {},
      });

      if (error) throw error;

      await loadDashboardData();
      setResetDialogOpen(false);
      setMessageType('success');
      setMessage(
        `Reiniciamos el hogar y dejamos limpio el historial operativo. Borramos ${data?.counts?.transactions ?? 0} movimientos, ${data?.counts?.payment_calendar_items ?? 0} pagos programados y ${data?.counts?.savings_goals ?? 0} metas.`
      );
    } catch (error) {
      setMessageType('danger');
      setMessage(error instanceof Error ? error.message : 'No pudimos reiniciar el hogar.');
    } finally {
      setResettingData(false);
    }
  }

  return (
    <div className="app-page max-w-7xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge>{planName}</PlanBadge>
              <span className="text-xs uppercase tracking-[0.18em] text-text-light">
                {formatMonthYear(year, month)}
              </span>
            </div>
            <h1 className="mt-4 text-[clamp(2rem,2.8vw,2.9rem)] font-semibold tracking-[-0.04em] text-text">
              Radiografía del hogar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Una lectura clara del mes: cuánto entró, qué pagos pesan, cuánto queda y cómo va el equilibrio entre ustedes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/app/gastos?create=1')}>Registrar gasto</Button>
            <Button variant="secondary" onClick={() => navigate('/app/pagos?create=1')}>Registrar pago</Button>
          </div>
        </div>
      </section>

      {message ? <AlertBanner type={messageType} message={message} onClose={() => setMessage('')} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Ingresó este mes"
          value={formatCLP(snapshot.totalIncome)}
          note="Todo lo que entró al hogar o a uno de ustedes."
          icon={<TrendingUp className="h-4 w-4" />}
          onClick={() => navigate('/app/ingresos')}
        />
        <SummaryCard
          label="Pagos obligatorios"
          value={formatCLP(snapshot.totalRequiredPaymentsCommitted)}
          note={snapshot.totalRequiredPaymentsPending > 0
            ? `${formatCLP(snapshot.totalRequiredPaymentsPending)} siguen pendientes este mes.`
            : 'Lo comprometido del mes ya quedó registrado.'}
          icon={<CalendarClock className="h-4 w-4" />}
          onClick={() => navigate('/app/pagos')}
        />
        <SummaryCard
          label="Gastos del día a día"
          value={formatCLP(snapshot.totalDayToDayExpenses)}
          note="Lo que se fue en funcionamiento cotidiano."
          icon={<TrendingDown className="h-4 w-4" />}
          onClick={() => navigate('/app/gastos')}
        />
        <SummaryCard
          label="Disponible real"
          value={formatCLP(snapshot.availableReal)}
          note="Ingresos menos pagos obligatorios, gasto del día a día y ahorro."
          icon={<Wallet className="h-4 w-4" />}
          tone={snapshot.availableReal >= 0 ? 'success' : 'danger'}
          onClick={() => navigate('/app/resumen')}
        />
        <SummaryCard
          label="Ahorro"
          value={formatCLP(snapshot.totalSavings)}
          note={snapshot.primaryGoal
            ? `${snapshot.primaryGoal.name} lleva ${snapshot.primaryGoalProgress}% de avance.`
            : 'Puedes dejarlo libre o asociarlo a una meta.'}
          icon={<PiggyBank className="h-4 w-4" />}
          onClick={() => navigate('/app/ahorro')}
        />
        <SummaryCard
          label="Saldo Hogar"
          value={balanceSummary.status === 'Puesta al dia' ? 'Puesta al día' : formatCLP(balanceSummary.netAmount)}
          note={balanceSummary.status === 'Puesta al dia'
            ? 'No hay desbalance pendiente entre ustedes.'
            : `${balanceSummary.pendingMemberName} debe ponerse al día con ${balanceSummary.favoredMemberName}.`}
          icon={<HandCoins className="h-4 w-4" />}
          onClick={() => navigate('/app/saldo-hogar')}
        />
      </section>

      {loading ? (
        <div className="ui-panel p-6 text-sm text-text-muted">Cargando la lectura del mes...</div>
      ) : null}

      {!loading && checklist.some((step) => !step.done) ? (
        <section className="ui-panel overflow-hidden p-6 lg:p-7">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Primeros pasos</p>
            <h2 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-text">Cómo ordenar el mes sin perderse</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Sigue esta secuencia. En pocos minutos el hogar ya empieza a explicarse solo.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {checklist.map((step) => (
              <ChecklistStep
                key={step.title}
                done={step.done}
                title={step.title}
                description={step.description}
                actionLabel={step.actionLabel}
                onAction={step.onAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && transactions.length > 0 ? (
        <DashboardCharts
          balanceSummary={balanceSummary}
          categories={categories}
          household={household}
          members={members}
          month={month}
          transactions={transactions}
          year={year}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <Card padding="lg">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Lectura rápida</p>
          <h2 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-text">Lo importante del mes</h2>
          <div className="mt-6 space-y-3">
            <MetricRow
              label="Presión de pagos"
              value={snapshot.totalIncome > 0 ? `${Math.round(snapshot.paymentPressure * 100)}%` : '—'}
              onClick={() => navigate('/app/pagos')}
            />
            <MetricRow
              label="Próximo pago importante"
              value={snapshot.nextImportantPayment ? `${snapshot.nextImportantPayment.description} · ${formatCLP(snapshot.nextImportantPayment.amount_clp)}` : 'Nada urgente por ahora'}
              onClick={() => navigate('/app/pagos')}
            />
            <MetricRow
              label="Saldo pendiente entre ustedes"
              value={balanceSummary.status === 'Puesta al dia' ? 'Sin saldo pendiente' : `${balanceSummary.pendingMemberName} debe ${formatCLP(balanceSummary.netAmount)}`}
              onClick={() => navigate('/app/saldo-hogar')}
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card padding="lg">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Alerta simple del mes</p>
            <h2 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.03em] text-text">Qué conviene mirar ahora</h2>
            <p className="mt-4 text-sm leading-7 text-text-muted">{firstAlert}</p>
          </Card>

          <Card padding="lg">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Aprendizaje simple</p>
            <h2 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.03em] text-text">Qué puede ayudar el próximo mes</h2>
            <p className="mt-4 text-sm leading-7 text-text-muted">{firstLearning}</p>
          </Card>
        </div>
      </section>

      {!hasFeature('monthly_comparison') ? (
        <Card padding="lg" className="border-border-light bg-surface-low/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-primary">Premium</p>
              <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-text">Si quieren más memoria del hogar</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                Free deja vivir el valor central. Premium suma comparación entre meses, alertas útiles y más detalle de Saldo Hogar.
              </p>
            </div>
            <div className="shrink-0">
              <Button variant="secondary" onClick={() => navigate(premiumUpgrade.route)}>
                {premiumUpgrade.actionLabel || 'Desbloquear Premium'}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {isOwner ? (
        <Card padding="lg" className="border-danger/20 bg-danger-bg/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-danger">Volver a empezar</p>
              <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-text">Reiniciar los datos del hogar</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                Úsalo si quieres limpiar montos viejos o empezar de nuevo sin borrar tu cuenta, el hogar, los integrantes ni la suscripción.
              </p>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                Se borran movimientos, pagos programados, recurrencias, metas, revisiones mensuales, imports e invitaciones pendientes.
              </p>
            </div>
            <div className="shrink-0">
              <Button
                variant="danger"
                onClick={() => setResetDialogOpen(true)}
              >
                Empezar de cero
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && transactions.length === 0 ? (
        <EmptyState
          eyebrow="Resumen"
          title="No han registrado movimientos este mes"
          description="Comienza por anotar cuánto dinero entró al hogar."
          action={{ label: 'Registrar ingreso', onClick: () => navigate('/app/ingresos?create=1') }}
        />
      ) : null}

      <ConfirmDialog
        open={resetDialogOpen}
        onClose={() => !resettingData && setResetDialogOpen(false)}
        onConfirm={handleResetHouseholdData}
        title="Empezar de cero en este hogar"
        message="Esto borrará la historia operativa del hogar: movimientos, pagos programados, recurrencias, metas, revisiones mensuales, imports e invitaciones pendientes. No borra tu cuenta, el hogar, los integrantes, las categorías ni la suscripción."
        confirmLabel="Sí, limpiar todo"
        loading={resettingData}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
  onClick: () => void;
}) {
  const valueClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text';

  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-interactive overflow-hidden p-6 text-left w-full cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className={`mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] ${valueClass}`}>{value}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{note}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </button>
  );
}

function MetricRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-subtle ui-panel-interactive flex w-full flex-col items-start justify-between gap-2 overflow-hidden p-5 text-left cursor-pointer sm:flex-row sm:items-center"
    >
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </button>
  );
}

function ChecklistStep({
  done,
  title,
  description,
  actionLabel,
  onAction,
}: {
  done: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="ui-panel ui-panel-subtle overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-text">{title}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{description}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${done ? 'bg-success-bg text-success' : 'bg-bg text-text-light'}`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
      </div>
      <div className="mt-5">
        <Button size="sm" variant={done ? 'secondary' : 'primary'} onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

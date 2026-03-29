import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Button, PlanBadge, UpgradePromptCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import { calculateTrafficLight, type TrafficLightResult } from '../../utils/traffic-light';
import { buildFinancialInsights, type FinancialInsightsResult, type InsightAction } from '../../utils/financial-insights';
import type { Category, PaymentCalendarItem, SavingsGoal, Transaction } from '../../types/database';
import { getFeatureUpgradeCopy } from '../../lib/constants';
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  PiggyBank,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export function DashboardPage() {
  const { household, members } = useHousehold();
  const { hasFeature, planTier, planName } = useSubscription();
  const navigate = useNavigate();
  const { year, month } = getCurrentMonthYear();
  const { start, end } = getMonthRange(year, month);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentCalendarItem[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<SavingsGoal | null>(null);
  const [light, setLight] = useState<TrafficLightResult | null>(null);
  const [insights, setInsights] = useState<FinancialInsightsResult>({ alerts: [], recommendations: [] });

  const showDashboardFull = hasFeature('dashboard_full');
  const showMonthlyProjection = hasFeature('monthly_projection');
  const showFinancialHealth = hasFeature('insights_financial_health');
  const showSmartAlerts = hasFeature('smart_alerts');
  const showRecommendations = hasFeature('recommendations');
  const showSplitSummary = hasFeature('split_manual') && showDashboardFull;
  const canManageCalendar = hasFeature('calendar_full');
  const canSyncRecurring = hasFeature('recurring_transactions');

  useEffect(() => {
    if (!household) return;
    let cancelled = false;

    const loadDashboardData = async () => {
      if (canSyncRecurring) {
        await syncRecurringItems(household.id).catch(() => null);
      }

      const [txRes, prevTxRes, catRes, payRes, goalRes] = await Promise.all([
        supabase.from('transactions').select('*')
          .eq('household_id', household.id)
          .gte('occurred_on', start).lte('occurred_on', end)
          .is('deleted_at', null),
        supabase.from('transactions').select('*')
          .eq('household_id', household.id)
          .gte('occurred_on', prevStart).lte('occurred_on', prevEnd)
          .is('deleted_at', null),
        supabase.from('categories').select('*')
          .eq('household_id', household.id)
          .is('deleted_at', null),
        supabase.from('payment_calendar_items').select('*')
          .eq('household_id', household.id)
          .gte('due_date', start).lte('due_date', end),
        supabase.from('savings_goals').select('*')
          .eq('household_id', household.id)
          .eq('is_primary', true)
          .eq('status', 'active')
          .limit(1)
          .single(),
      ]);

      if (cancelled) return;

      const txs = (txRes.data || []) as Transaction[];
      const prevTxs = (prevTxRes.data || []) as Transaction[];
      const cats = (catRes.data || []) as Category[];
      const pays = (payRes.data || []) as PaymentCalendarItem[];
      const goal = goalRes.data as SavingsGoal | null;

      setTransactions(txs);
      setPayments(pays);
      setPrimaryGoal(goal);

      const totalIncomeAmount = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount_clp, 0);
      const totalExpenseAmount = txs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_clp, 0);

      setLight(calculateTrafficLight(totalIncomeAmount, totalExpenseAmount, pays, goal, month));
      setInsights(buildFinancialInsights({
        currentTransactions: txs,
        previousTransactions: prevTxs,
        upcomingPayments: pays,
        primaryGoal: goal,
        categories: cats,
        currentYear: year,
        currentMonth: month,
      }));
    };

    void loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [canSyncRecurring, household, month, prevEnd, prevStart, start, end, year]);

  useEffect(() => {
    if (!household) return;
    trackOnce(
      `first-session:${household.id}`,
      'first_session_started',
      { household_id: household.id, plan: planTier },
      'session',
    );
  }, [household, planTier]);

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount_clp, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_clp, 0);
  const balance = totalIncome - totalExpenses;
  const pendingPayments = payments.filter((p) => p.status === 'pending' || p.status === 'overdue');
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount_clp, 0);
  const projectedClose = balance - totalPendingAmount;
  const currentMonthParam = `${year}-${String(month).padStart(2, '0')}`;
  const hasTransactions = transactions.length > 0;
  const primaryGoalProgress = primaryGoal && primaryGoal.target_amount_clp > 0
    ? Math.round((primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)
    : 0;

  const urgentAlerts = showSmartAlerts
    ? insights.alerts.filter((a) => a.severity === 'danger' || a.severity === 'warning').slice(0, 3)
    : [];
  const firstRecommendation = showRecommendations ? insights.recommendations[0] : null;
  const dashboardUpgrade = getFeatureUpgradeCopy('dashboard_full');
  const strategicUpgrade = getFeatureUpgradeCopy('monthly_projection');
  const compactUpgrade = !showDashboardFull ? dashboardUpgrade : !showMonthlyProjection ? strategicUpgrade : null;

  const memberContributions = members.map((member) => {
    const sharedTx = transactions.filter(
      (t) => t.type === 'expense' && t.scope === 'shared' && t.paid_by_member_id === member.id,
    );
    return { name: member.display_name, total: sharedTx.reduce((sum, t) => sum + t.amount_clp, 0) };
  });
  const sharedTotal = memberContributions.reduce((sum, c) => sum + c.total, 0);
  const splitSummary = showSplitSummary && sharedTotal > 0
    ? memberContributions.map((m) => `${m.name}: ${formatCLP(m.total)}`).join(' · ')
    : null;

  function openInsightAction(action?: InsightAction) {
    if (!action) return;
    if (action.target === 'calendar') {
      const params = new URLSearchParams();
      if (action.status) params.set('status', action.status);
      navigate(`/app/calendario${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }
    if (action.target === 'transactions') {
      const params = new URLSearchParams();
      params.set('month', currentMonthParam);
      if (action.type) params.set('type', action.type);
      if (action.categoryId) params.set('category', action.categoryId);
      navigate(`/app/movimientos?${params.toString()}`);
      return;
    }
    if (action.target === 'comparison') {
      navigate('/app/comparacion');
      return;
    }
    if (action.target === 'goals') {
      navigate('/app/metas');
    }
  }

  return (
    <div className="app-page max-w-7xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge>{planName}</PlanBadge>
              <span className="text-xs uppercase tracking-[0.18em] text-text-light">
                {formatMonthYear(year, month)}
              </span>
            </div>
            <h1 className="mt-4 max-w-2xl text-[clamp(1.95rem,2.7vw,2.8rem)] font-semibold tracking-[-0.04em] text-text">
              Control del hogar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Una lectura clara del mes para saber cómo está el hogar, qué requiere atención y dónde conviene actuar ahora.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/app/movimientos?create=expense')}>
              Registrar movimiento
            </Button>
            <Button variant="secondary" onClick={() => navigate('/app/calendario')}>
              Ver calendario
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardSummaryCard
          label="Saldo del mes"
          value={formatCLP(balance)}
          note={balance >= 0 ? 'Disponible después de gastos registrados' : 'El gasto ya superó el ingreso registrado'}
          tone={balance >= 0 ? 'success' : 'danger'}
          icon={balance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}`)}
        />
        <DashboardSummaryCard
          label="Pagos por cubrir"
          value={formatCLP(totalPendingAmount)}
          note={pendingPayments.length > 0 ? `${pendingPayments.length} pago(s) por revisar` : 'Sin pagos pendientes este mes'}
          tone={pendingPayments.length > 0 ? 'warning' : 'neutral'}
          icon={<CalendarClock className="h-4 w-4" />}
          onClick={() => navigate(`/app/calendario${pendingPayments.length > 0 ? '?status=pending' : ''}`)}
        />
        <DashboardSummaryCard
          label={showMonthlyProjection ? 'Cierre estimado' : 'Gasto del mes'}
          value={formatCLP(showMonthlyProjection ? projectedClose : totalExpenses)}
          note={showMonthlyProjection ? 'Saldo proyectado al cierre con pagos pendientes' : 'Total de gastos registrados hasta hoy'}
          tone={showMonthlyProjection && projectedClose < 0 ? 'danger' : showMonthlyProjection ? 'success' : 'neutral'}
          icon={showMonthlyProjection ? <PiggyBank className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
          onClick={() => navigate(showMonthlyProjection ? '/app/comparacion' : `/app/movimientos?month=${currentMonthParam}&type=expense`)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <div className="ui-panel overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Atención inmediata</p>
              <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
                Qué requiere atención hoy
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
                Lo urgente aparece primero para que el hogar actúe antes de que el mes se desordene.
              </p>
            </div>
            {showFinancialHealth && light && (
              <span className={getTrafficLightClass(light.status)}>
                {light.label}
              </span>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {pendingPayments.length > 0 ? (
              pendingPayments.slice(0, 3).map((payment) => (
                <AttentionRow
                  key={payment.id}
                  title={payment.description}
                  detail={`${payment.status === 'overdue' ? 'Vencido' : 'Pendiente'} · ${payment.due_date}`}
                  value={formatCLP(payment.amount_clp)}
                  tone={payment.status === 'overdue' ? 'danger' : 'warning'}
                  onClick={() => navigate(canManageCalendar ? `/app/calendario?itemId=${payment.id}&mode=edit` : '/app/calendario')}
                />
              ))
            ) : urgentAlerts.length > 0 ? (
              urgentAlerts.map((alert) => (
                <AttentionRow
                  key={alert.id}
                  title={alert.title}
                  detail={alert.message}
                  value={alert.severity === 'danger' ? 'Alta' : 'Media'}
                  tone={alert.severity === 'danger' ? 'danger' : 'warning'}
                  onClick={() => openInsightAction(alert.action)}
                />
              ))
            ) : firstRecommendation ? (
              <AttentionRow
                title={firstRecommendation.title}
                detail={firstRecommendation.message}
                value="Sugerencia"
                tone="neutral"
                onClick={() => openInsightAction(firstRecommendation.action)}
              />
            ) : !hasTransactions ? (
              <DashboardEmptyBlock
                title="Todavía no hay lectura del mes"
                description="Registra el primer ingreso o gasto para convertir el hogar en una referencia útil."
                actionLabel="Registrar movimiento"
                onAction={() => navigate('/app/movimientos?create=expense')}
              />
            ) : !primaryGoal ? (
              <DashboardEmptyBlock
                title="Todavía no hay una meta principal"
                description="Define una dirección para que el margen del mes no quede sin criterio."
                actionLabel="Crear meta"
                onAction={() => navigate('/app/metas?create=1')}
              />
            ) : (
              <DashboardEmptyBlock
                title="Todo está al día"
                description="No hay alertas urgentes. Este es un buen momento para revisar metas o cerrar mejor el mes."
                actionLabel="Ver resumen"
                onAction={() => navigate('/app/resumen')}
              />
            )}
          </div>
        </div>

        <div className="ui-panel overflow-hidden p-6 lg:p-7">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Panorama del mes</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
              Cómo va el hogar
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Ingresos, gastos y señales clave del mes en una sola lectura.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <MetricRow
              label="Ingresos registrados"
              value={formatCLP(totalIncome)}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=income`)}
            />
            <MetricRow
              label="Gastos registrados"
              value={formatCLP(totalExpenses)}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=expense`)}
            />
            <MetricRow
              label="Resultado actual"
              value={formatCLP(balance)}
              valueTone={balance >= 0 ? 'success' : 'danger'}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}`)}
            />
            <MetricRow
              label={showMonthlyProjection ? 'Cierre estimado' : 'Resumen detallado'}
              value={showMonthlyProjection ? formatCLP(projectedClose) : 'Abrir vista'}
              valueTone={showMonthlyProjection && projectedClose < 0 ? 'danger' : showMonthlyProjection ? 'success' : 'neutral'}
              onClick={() => navigate(showMonthlyProjection ? '/app/comparacion' : '/app/resumen')}
            />
          </div>

          {showFinancialHealth && light && (
            <div className="mt-5 rounded-2xl border border-border bg-bg/75 px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Salud del mes</p>
              <p className="mt-2 text-base font-semibold tracking-tight text-text">{light.label}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {light.reasons[0]}
              </p>
            </div>
          )}

          {splitSummary && (
            <button
              type="button"
              onClick={() => navigate('/app/reparto')}
              className="mt-5 w-full rounded-2xl border border-border bg-bg/75 px-5 py-4 text-left transition-colors hover:bg-surface-hover cursor-pointer"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Reparto del hogar</p>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{splitSummary}</p>
            </button>
          )}
        </div>
      </section>

      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">
              {primaryGoal ? 'Meta principal' : 'Dirección del ahorro'}
            </p>
            <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-text">
              {primaryGoal ? primaryGoal.name : 'Todavía no hay una meta principal'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {primaryGoal
                ? `Lleva ${formatCLP(primaryGoal.current_amount_clp)} de ${formatCLP(primaryGoal.target_amount_clp)}.`
                : 'Definir una meta ayuda a convertir el excedente del mes en una decisión concreta.'}
            </p>

            {primaryGoal ? (
              <div className="mt-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[2rem] font-semibold tracking-[-0.04em] text-text">
                    {primaryGoalProgress}%
                  </span>
                  <span className="text-sm text-text-muted">completado</span>
                </div>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-border-light">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, primaryGoalProgress)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="secondary" onClick={() => navigate('/app/metas')}>
              {primaryGoal ? 'Administrar metas' : 'Crear meta'}
            </Button>
            {primaryGoal && (
              <Button variant="ghost" onClick={() => navigate('/app/resumen')}>
                Ver resumen del mes
              </Button>
            )}
          </div>
        </div>
      </section>

      {compactUpgrade && (
        <UpgradePromptCard
          badge={compactUpgrade.badge}
          title={compactUpgrade.title}
          description={compactUpgrade.description}
          highlights={compactUpgrade.highlights}
          actionLabel={compactUpgrade.actionLabel || 'Explorar plan'}
          onAction={() => navigate(compactUpgrade.route)}
          compact
          trackingContext="dashboard-upgrade"
        />
      )}

      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Acciones rápidas</p>
            <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-text">
              Qué conviene hacer ahora
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionCard
            label="Registrar gasto o ingreso"
            hint="Actualizar el mes"
            icon={<CircleDollarSign className="h-4 w-4" />}
            onClick={() => navigate('/app/movimientos?create=expense')}
          />
          <QuickActionCard
            label="Abrir calendario"
            hint="Revisar vencimientos"
            icon={<CalendarClock className="h-4 w-4" />}
            onClick={() => navigate('/app/calendario')}
          />
          <QuickActionCard
            label="Ver metas"
            hint="Seguir el ahorro"
            icon={<Target className="h-4 w-4" />}
            onClick={() => navigate('/app/metas')}
          />
          <QuickActionCard
            label={showMonthlyProjection ? 'Comparar el mes' : 'Abrir resumen'}
            hint={showMonthlyProjection ? 'Leer proyección y cambios' : 'Revisar cierre actual'}
            icon={<TrendingUp className="h-4 w-4" />}
            onClick={() => navigate(showMonthlyProjection ? '/app/comparacion' : '/app/resumen')}
          />
        </div>
      </section>
    </div>
  );
}

function DashboardSummaryCard({
  label,
  value,
  note,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-interactive overflow-hidden p-6 text-left w-full cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className={`metric-value ${getValueToneClass(tone)}`}>{value}</p>
          <p className="metric-subvalue">{note}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </button>
  );
}

function AttentionRow({
  title,
  detail,
  value,
  tone,
  onClick,
}: {
  title: string;
  detail: string;
  value: string;
  tone: 'danger' | 'warning' | 'neutral';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-subtle ui-panel-interactive flex w-full items-start gap-4 overflow-hidden p-5 text-left cursor-pointer"
    >
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getToneSoftClass(tone)}`}>
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold tracking-tight text-text">{title}</p>
        <p className="mt-1 text-sm leading-6 text-text-muted">{detail}</p>
      </div>
      <div className={`shrink-0 text-right text-sm font-semibold ${getValueToneClass(tone)}`}>
        {value}
      </div>
    </button>
  );
}

function MetricRow({
  label,
  value,
  valueTone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  valueTone?: 'success' | 'warning' | 'danger' | 'neutral';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-subtle ui-panel-interactive flex w-full items-center justify-between gap-4 overflow-hidden p-5 text-left cursor-pointer"
    >
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className={`text-lg font-semibold tracking-tight ${getValueToneClass(valueTone)}`}>{value}</span>
    </button>
  );
}

function DashboardEmptyBlock({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="ui-panel ui-panel-subtle overflow-hidden p-6">
      <p className="text-base font-semibold tracking-tight text-text">{title}</p>
      <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p>
      <div className="mt-5">
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function QuickActionCard({
  label,
  hint,
  icon,
  onClick,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-panel ui-panel-subtle ui-panel-interactive flex w-full items-start justify-between gap-4 overflow-hidden p-5 text-left cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight text-text">{label}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-light">{hint}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
        {icon}
      </div>
    </button>
  );
}

function getTrafficLightClass(status: TrafficLightResult['status']) {
  if (status === 'order') return 'traffic-light traffic-light-order';
  if (status === 'tension') return 'traffic-light traffic-light-tension';
  return 'traffic-light traffic-light-risk';
}

function getValueToneClass(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return 'text-success';
  if (tone === 'warning') return 'text-warning';
  if (tone === 'danger') return 'text-danger';
  return 'text-text';
}

function getToneSoftClass(tone: 'danger' | 'warning' | 'neutral') {
  if (tone === 'danger') return 'bg-danger-bg text-danger';
  if (tone === 'warning') return 'bg-warning-bg text-warning';
  return 'bg-info-bg text-info';
}

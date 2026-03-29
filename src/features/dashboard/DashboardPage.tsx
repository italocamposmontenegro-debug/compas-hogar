// ============================================
// Casa Clara — Dashboard Page — Stitch M3 Edition
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Button, PlanBadge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import { calculateTrafficLight, type TrafficLightResult } from '../../utils/traffic-light';
import { buildFinancialInsights, type FinancialInsightsResult, type InsightAction } from '../../utils/financial-insights';
import type { Category, PaymentCalendarItem, SavingsGoal, Transaction } from '../../types/database';
import { getFeatureUpgradeCopy } from '../../lib/constants';
import { ArrowRight, TrendingUp, TrendingDown, CalendarClock, Sparkles } from 'lucide-react';

// ─── M3 CSS variable aliases ────────────────────────────────────────────────
const C = {
  surface:              'var(--color-s-surface-lowest)',
  surfaceLow:           'var(--color-s-bg)',
  surfaceHigh:          'var(--color-s-surface-container)',
  surfaceHighest:       'var(--color-s-surface-low)',
  outline:              'var(--color-s-border)',
  onSurface:            'var(--color-s-text)',
  onSurfaceVariant:     'var(--color-s-text-muted)',
  primary:              'var(--color-s-primary)',
  onPrimary:            'var(--color-s-on-primary)',
  primaryContainer:     'var(--color-s-surface-container)',
  onPrimaryContainer:   'var(--color-s-text)',
  secondaryContainer:   'var(--color-s-surface-low)',
  onSecondaryContainer: 'var(--color-s-primary)',
  error:                'var(--color-s-danger)',
  errorContainer:       'var(--color-s-danger-bg)',
  onErrorContainer:     'var(--color-s-danger)',
  fontHeadline:         'var(--font-headline)',
  fontSans:             'var(--font-body)',
};

export function DashboardPage() {
  const { household, members } = useHousehold();
  const { hasFeature, planTier, planName } = useSubscription();
  const navigate = useNavigate();
  const { year, month } = getCurrentMonthYear();
  const { start, end } = getMonthRange(year, month);
  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments,     setPayments]     = useState<PaymentCalendarItem[]>([]);
  const [primaryGoal,  setPrimaryGoal]  = useState<SavingsGoal | null>(null);
  const [light,        setLight]        = useState<TrafficLightResult | null>(null);
  const [insights,     setInsights]     = useState<FinancialInsightsResult>({ alerts: [], recommendations: [] });

  const showDashboardFull    = hasFeature('dashboard_full');
  const showMonthlyProjection = hasFeature('monthly_projection');
  const showFinancialHealth  = hasFeature('insights_financial_health');
  const showSmartAlerts      = hasFeature('smart_alerts');
  const showRecommendations  = hasFeature('recommendations');
  const showSplitSummary     = hasFeature('split_manual') && showDashboardFull;
  const canManageCalendar    = hasFeature('calendar_full');
  const canSyncRecurring     = hasFeature('recurring_transactions');

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

      const txs  = (txRes.data  || []) as Transaction[];
      const prevTxs = (prevTxRes.data || []) as Transaction[];
      const cats = (catRes.data || []) as Category[];
      const pays = (payRes.data || []) as PaymentCalendarItem[];
      const goal = goalRes.data as SavingsGoal | null;

      setTransactions(txs);
      setPayments(pays);
      setPrimaryGoal(goal);

      const totalIncomeAmount  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
      const totalExpenseAmount = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);

      setLight(calculateTrafficLight(totalIncomeAmount, totalExpenseAmount, pays, goal, month));
      setInsights(buildFinancialInsights({
        currentTransactions:  txs,
        previousTransactions: prevTxs,
        upcomingPayments:     pays,
        primaryGoal:          goal,
        categories:           cats,
        currentYear:          year,
        currentMonth:         month,
      }));
    };

    void loadDashboardData();
    return () => { cancelled = true; };
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

  // ─── Derived values ──────────────────────────────────────
  const totalIncome    = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
  const balance        = totalIncome - totalExpenses;
  const pendingPayments    = payments.filter(p => p.status === 'pending' || p.status === 'overdue');
  const totalPendingAmount = pendingPayments.reduce((s, p) => s + p.amount_clp, 0);
  const projectedClose = balance - totalPendingAmount;
  const currentMonthParam = `${year}-${String(month).padStart(2, '0')}`;
  const hasTransactions = transactions.length > 0;
  const primaryGoalProgress = primaryGoal && primaryGoal.target_amount_clp > 0
    ? Math.round((primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)
    : 0;

  const urgentAlerts      = showSmartAlerts
    ? insights.alerts.filter(a => a.severity === 'danger' || a.severity === 'warning').slice(0, 3)
    : [];
  const firstRecommendation = showRecommendations ? insights.recommendations[0] : null;
  const dashboardUpgrade    = getFeatureUpgradeCopy('dashboard_full');
  const strategicUpgrade    = getFeatureUpgradeCopy('monthly_projection');
  const compactUpgrade      = !showDashboardFull ? dashboardUpgrade : !showMonthlyProjection ? strategicUpgrade : null;

  const memberContributions = members.map(member => {
    const sharedTx = transactions.filter(t => t.type === 'expense' && t.scope === 'shared' && t.paid_by_member_id === member.id);
    return { name: member.display_name, total: sharedTx.reduce((s, t) => s + t.amount_clp, 0) };
  });
  const sharedTotal    = memberContributions.reduce((s, c) => s + c.total, 0);
  const splitSummary   = showSplitSummary && sharedTotal > 0
    ? memberContributions.map(m => `${m.name}: ${formatCLP(m.total)}`).join(' · ')
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
    if (action.target === 'comparison') { navigate('/app/comparacion'); return; }
    if (action.target === 'goals')       { navigate('/app/metas'); }
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-8 lg:space-y-12 animate-in fade-in duration-700">

      {/* ── Page header ──────────────────────────────────── */}
      <header className="flex flex-col items-center justify-center text-center gap-8 py-10">
        <div>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <PlanBadge>{planName}</PlanBadge>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.onSurfaceVariant }}>
              {formatMonthYear(year, month)}
            </span>
          </div>
          <h1
            className="text-5xl lg:text-7xl font-bold tracking-tight mb-6"
            style={{ fontFamily: C.fontHeadline, color: C.onSurface, lineHeight: 1.05 }}
          >
            Resumen del hogar
          </h1>
          <p className="text-base max-w-2xl mx-auto leading-relaxed opacity-60" style={{ color: C.onSurfaceVariant }}>
            Una lectura simple del mes para saber qué mirar primero y dónde conviene actuar.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/app/movimientos?create=expense')}>
          Registrar movimiento
        </Button>
      </header>

      {/* ── Top summary cards (3-up) ─────────────────────── */}
      <section className="grid gap-4 md:grid-cols-3">
        <M3SummaryCard
          label="Saldo actual"
          value={formatCLP(balance)}
          note={balance >= 0 ? 'Mes en terreno positivo' : 'Mes en terreno negativo'}
          tone={balance >= 0 ? 'success' : 'danger'}
          icon={balance >= 0 ? TrendingUp : TrendingDown}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}`)}
        />
        <M3SummaryCard
          label="Pagos abiertos"
          value={formatCLP(totalPendingAmount)}
          note={pendingPayments.length > 0 ? `${pendingPayments.length} por revisar` : 'Sin pagos pendientes'}
          tone={pendingPayments.length > 0 ? 'warning' : 'neutral'}
          icon={CalendarClock}
          onClick={() => navigate(`/app/calendario${pendingPayments.length > 0 ? '?status=pending' : ''}`)}
        />
        <M3SummaryCard
          label="Gasto del mes"
          value={formatCLP(totalExpenses)}
          note="Abrir movimientos"
          tone="neutral"
          icon={TrendingDown}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=expense`)}
        />
      </section>

      {/* ── Main 2-col section ───────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

        {/* Atención hoy */}
        <M3Card>
          <div className="flex flex-col items-center justify-center text-center gap-3 mb-12">
            {pendingPayments.length > 0 && (
              <span
                className="inline-flex items-center justify-center text-xs font-bold w-10 h-10 rounded-full shadow-ambient animate-bounce mb-2"
                style={{ background: C.error, color: C.onPrimary }}
              >
                {pendingPayments.length}
              </span>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60" style={{ color: C.onSurfaceVariant }}>
                Atención inmediata
              </p>
              <h2 className="mt-1 text-3xl font-bold" style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
                Qué requiere atención hoy
              </h2>
            </div>
          </div>

          <div className="space-y-1">
            {pendingPayments.length > 0 ? (
              pendingPayments.slice(0, 3).map(payment => (
                <M3ActionRow
                  key={payment.id}
                  label={payment.description}
                  detail={`${payment.status === 'overdue' ? 'Vencido' : 'Pendiente'} · ${payment.due_date}`}
                  value={formatCLP(payment.amount_clp)}
                  tone={payment.status === 'overdue' ? 'danger' : 'neutral'}
                  onClick={() => navigate(canManageCalendar ? `/app/calendario?itemId=${payment.id}&mode=edit` : '/app/calendario')}
                />
              ))
            ) : urgentAlerts.length > 0 ? (
              urgentAlerts.map(alert => (
                <M3ActionRow
                  key={alert.id}
                  label={alert.title}
                  detail={alert.message}
                  value={alert.severity === 'danger' ? 'Alta' : 'Media'}
                  tone={alert.severity === 'danger' ? 'danger' : 'warning'}
                  onClick={() => openInsightAction(alert.action)}
                />
              ))
            ) : firstRecommendation ? (
              <M3ActionRow
                label={firstRecommendation.title}
                detail={firstRecommendation.message}
                value="Sugerencia"
                tone="neutral"
                onClick={() => openInsightAction(firstRecommendation.action)}
              />
            ) : !hasTransactions ? (
              <M3EmptyState
                title="Todavía no hay lectura del mes"
                description="Registra el primer movimiento para que el panel empiece a mostrar contexto útil."
                actionLabel="Registrar movimiento"
                onAction={() => navigate('/app/movimientos?create=expense')}
              />
            ) : !primaryGoal ? (
              <M3EmptyState
                title="El mes ya tiene datos. Falta una dirección."
                description="Una meta visible ayuda a decidir mejor qué hacer con el margen disponible."
                actionLabel="Crear meta"
                onAction={() => navigate('/app/metas?create=1')}
              />
            ) : (
              <M3EmptyState
                title="Hoy no hay nada urgente"
                description="El hogar está al día. Puedes revisar el resumen o seguir registrando el mes."
                actionLabel="Ver resumen"
                onAction={() => navigate('/app/resumen')}
              />
            )}
          </div>
        </M3Card>

        {/* Panorama del mes */}
        <M3Card>
          <div className="flex flex-col items-center justify-center text-center gap-3 mb-12">
            {showFinancialHealth && light && (
              <span className={`traffic-light traffic-light-${light.status === 'order' ? 'order' : light.status === 'tension' ? 'tension' : 'risk'} mb-2`}>
                {light.label}
              </span>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60" style={{ color: C.onSurfaceVariant }}>
                Panorama mensual
              </p>
              <h2 className="mt-1 text-3xl font-bold" style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
                Estado del mes
              </h2>
            </div>
          </div>

          <div className="space-y-1">
            <M3MetricRow
              label="Ingresos registrados"
              value={formatCLP(totalIncome)}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=income`)}
            />
            <M3MetricRow
              label="Gastos registrados"
              value={formatCLP(totalExpenses)}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=expense`)}
            />
            <M3MetricRow
              label="Resultado actual"
              value={formatCLP(balance)}
              emphasis={balance >= 0}
              onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}`)}
            />
            {showMonthlyProjection ? (
              <M3MetricRow
                label="Cierre estimado"
                value={formatCLP(projectedClose)}
                emphasis={true}
                onClick={() => navigate('/app/comparacion')}
              />
            ) : (
              <M3MetricRow
                label="Análisis del mes"
                value="Ver resumen"
                onClick={() => navigate('/app/resumen')}
              />
            )}
          </div>

          {splitSummary && (
            <button
              type="button"
              onClick={() => navigate('/app/reparto')}
              className="mt-12 block w-full rounded-[2rem] p-8 text-center transition-all cursor-pointer hover:bg-black/5"
              style={{ background: C.surfaceHigh }}
            >
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold opacity-60 mb-3" style={{ color: C.onSurfaceVariant }}>
                Reparto del hogar
              </p>
              <p className="text-base leading-relaxed font-medium" style={{ color: C.onSurface }}>{splitSummary}</p>
            </button>
          )}

          {compactUpgrade && (
            <div
              className="mt-8 rounded-2xl p-6 transition-all hover:shadow-ambient"
              style={{ background: 'var(--color-s-surface-low)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.onSecondaryContainer }}>{compactUpgrade.badge}</p>
              <p className="text-sm leading-relaxed mb-4 opacity-80" style={{ color: C.onSecondaryContainer }}>{compactUpgrade.description}</p>
              <button
                type="button"
                onClick={() => navigate(compactUpgrade.route)}
                className="inline-flex items-center gap-2 text-sm font-bold cursor-pointer group"
                style={{ color: C.primary }}
              >
                {compactUpgrade.actionLabel || 'Explorar planes'} 
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}
        </M3Card>
      </section>

      {/* ── Primary goal card ────────────────────────────── */}
      <div className="rounded-[2rem] p-8 lg:p-12 transition-all hover:shadow-ambient" style={{ background: C.surface }}>
        <div className="flex justify-between items-start mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60" style={{ color: 'var(--color-s-text-muted)' }}>
            {primaryGoal ? 'Objetivo Central' : 'Sin metas activas'}
          </p>
          {primaryGoal && (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(20, 69, 74, 0.08)', color: C.primary }}>
              {primaryGoalProgress}% completado
            </span>
          )}
        </div>
        
        {primaryGoal ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-center text-center gap-6">
               <div className="min-w-0">
                  <h2 className="text-lg font-bold mb-4 opacity-70" style={{ color: C.onSurface }}>
                    {primaryGoal.name}
                  </h2>
                  <span className="text-5xl lg:text-7xl font-bold tracking-tighter block mb-6 px-12" style={{ color: C.primary, fontFamily: C.fontHeadline }}>
                    {formatCLP(primaryGoal.current_amount_clp)}
                  </span>
               </div>
               <Button variant="secondary" onClick={() => navigate('/app/metas')}>Administrar metas</Button>
            </div>
            
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-s-surface-low)' }}>
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(100, (primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)}%`,
                  background: C.primary,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-6">
            <p className="text-lg max-w-sm leading-relaxed" style={{ color: C.onSurfaceVariant }}>
              Una meta simple basta para empezar. No hace falta definir todo el futuro del hogar de una vez.
            </p>
            <Button onClick={() => navigate('/app/metas?create=1')}>Crear meta</Button>
          </div>
        )}
      </div>

      {/* ── Quick actions ─────────────────────────────────── */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 mb-6" style={{ color: C.onSurfaceVariant }}>
          Acciones rápidas
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <M3QuickAction label="Registrar gasto o ingreso" onClick={() => navigate('/app/movimientos?create=expense')} />
          <M3QuickAction label="Calendario de pagos" onClick={() => navigate('/app/calendario')} />
          <M3QuickAction label="Ver metas de ahorro" onClick={() => navigate('/app/metas')} />
          <M3QuickAction
            label={showMonthlyProjection ? 'Análisis comparativo' : 'Resumen detallado'}
            onClick={() => navigate(showMonthlyProjection ? '/app/comparacion' : '/app/resumen')}
          />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local UI sub-components (Architectural Editorial design)
// ─────────────────────────────────────────────────────────────────────────────

function M3Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[2rem] p-8 lg:p-10 transition-all hover:shadow-ambient ${className}`}
      style={{
        background: 'var(--color-s-surface-lowest)',
      }}
    >
      {children}
    </div>
  );
}

function M3SummaryCard({
  label, value, note, tone, icon: Icon, onClick,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const toneStyle: Record<string, { bg: string; color: string; badge: string }> = {
    success: { bg: 'var(--color-s-surface-lowest)', color: 'var(--color-s-primary)', badge: 'rgba(20, 69, 74, 0.05)' },
    warning: { bg: 'var(--color-s-surface-low)', color: 'var(--color-s-text)', badge: 'rgba(0,0,0,0.05)' },
    danger:  { bg: 'var(--color-s-surface-lowest)', color: 'var(--color-s-danger)', badge: 'rgba(186, 26, 26, 0.05)' },
    neutral: { bg: 'var(--color-s-surface-low)', color: 'var(--color-s-text)', badge: 'rgba(0,0,0,0.05)' },
  };
  const ts = toneStyle[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-8 py-12 rounded-[2rem] text-center transition-all cursor-pointer group hover:shadow-ambient flex flex-col items-center justify-center"
      style={{ 
        background: ts.bg
      }}
    >
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="p-3 rounded-full transition-colors group-hover:bg-white/50" style={{ color: ts.color, background: ts.badge }}>
          <Icon className="h-5 w-5 shrink-0" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60" style={{ color: 'var(--color-s-text-muted)' }}>
          {label}
        </p>
      </div>
      <p className="text-5xl font-bold tracking-tighter" style={{ color: ts.color, fontFamily: 'var(--font-headline)' }}>
        {value}
      </p>
      <p className="mt-6 text-[11px] font-medium opacity-60" style={{ color: 'var(--color-s-text-muted)' }}>{note}</p>
    </button>
  );
}

function M3MetricRow({
  label, value, emphasis = false, onClick,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-[2rem] text-center transition-all cursor-pointer hover:bg-black/5"
    >
      <span
        className="text-4xl font-bold tracking-tighter"
        style={{ color: emphasis ? 'var(--color-s-primary)' : 'var(--color-s-text)', fontFamily: 'var(--font-headline)' }}
      >
        {value}
      </span>
      <span className="text-xs font-bold uppercase tracking-widest opacity-40 italic" style={{ color: 'var(--color-s-text-muted)' }}>{label}</span>
    </button>
  );
}

function M3ActionRow({
  label, detail, value, tone = 'neutral', onClick,
}: {
  label: string;
  detail: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
  onClick: () => void;
}) {
  const valueColor = tone === 'danger' ? 'var(--color-s-danger)' : tone === 'warning' ? '#92610A' : 'var(--color-s-text)';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 w-full py-8 rounded-[2rem] text-center transition-all cursor-pointer hover:bg-black/5"
    >
      <span className="text-xl font-bold tracking-tight text-right mt-1" style={{ color: valueColor }}>{value}</span>
      <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-s-text)' }}>{label}</span>
      <span className="text-[11px] font-medium opacity-50 uppercase tracking-wider" style={{ color: 'var(--color-s-text-muted)' }}>{detail}</span>
    </button>
  );
}

function M3EmptyState({
  title, description, actionLabel, onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="rounded-3xl p-8 text-center"
      style={{ background: 'var(--color-s-surface-low)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white shadow-ambient flex items-center justify-center">
          <Sparkles className="h-5 w-5" style={{ color: 'var(--color-s-primary)' }} />
        </div>
        <div>
          <p className="text-base font-bold mb-2" style={{ color: 'var(--color-s-text)' }}>{title}</p>
          <p className="text-sm leading-relaxed opacity-60 max-w-xs mx-auto mb-6" style={{ color: 'var(--color-s-text-muted)' }}>{description}</p>
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function M3QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between px-6 py-5 rounded-2xl text-left text-sm font-bold transition-all cursor-pointer group hover:bg-white hover:shadow-ambient"
      style={{
        background: 'var(--color-s-surface-low)',
        color: 'var(--color-s-text)',
      }}
    >
      <span className="tracking-tight">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--color-s-text-muted)' }} />
    </button>
  );
}


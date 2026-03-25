// ============================================
// Casa Clara — Dashboard Page
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, StatCard, Button, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { formatCLP } from '../../utils/format-clp';
import { formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import { calculateTrafficLight, type TrafficLightResult } from '../../utils/traffic-light';
import { buildFinancialInsights, type FinancialInsightsResult, type InsightAction } from '../../utils/financial-insights';
import type { Category, Transaction, PaymentCalendarItem, SavingsGoal } from '../../types/database';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Target, CalendarClock,
  ArrowRight, Plus, BarChart3, AlertTriangle, Lightbulb,
} from 'lucide-react';

export function DashboardPage() {
  const { household, members } = useHousehold();
  const { isRestricted, hasFeature } = useSubscription();
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
  const canSyncRecurring = hasFeature('recurring');

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
          .eq('is_primary', true).eq('status', 'active')
          .limit(1).single(),
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

      const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
      const totalExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
      setLight(calculateTrafficLight(totalIncome, totalExpenses, pays, goal, month));
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
  }, [canSyncRecurring, household, start, end, prevStart, prevEnd, month, year]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
  const balance = totalIncome - totalExpenses;
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue');
  const projectedClose = balance - pendingPayments.reduce((sum, payment) => sum + payment.amount_clp, 0);
  const showFinancialHealth = hasFeature('financial_health');
  const showMonthlyProjection = hasFeature('monthly_projection');
  const showSmartAlerts = hasFeature('smart_alerts');
  const showRecommendations = hasFeature('recommendations');
  const currentMonthParam = `${year}-${String(month).padStart(2, '0')}`;

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

  const memberContributions = members.map(m => {
    const shared = transactions.filter(t => t.type === 'expense' && t.scope === 'shared' && t.paid_by_member_id === m.id);
    return { name: m.display_name, total: shared.reduce((s, t) => s + t.amount_clp, 0) };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Panel general</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)}</p>
        </div>
        {showFinancialHealth && light && (
          <div className={`traffic-light traffic-light-${light.status === 'order' ? 'order' : light.status === 'tension' ? 'tension' : 'risk'}`}>
            {light.emoji} {light.label}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Ingresos"
          value={formatCLP(totalIncome)}
          icon={<TrendingUp className="h-5 w-5" />}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=income`)}
        />
        <StatCard
          label="Gastos"
          value={formatCLP(totalExpenses)}
          icon={<TrendingDown className="h-5 w-5" />}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}&type=expense`)}
        />
        <StatCard
          label="Saldo"
          value={formatCLP(balance)}
          trend={balance >= 0 ? 'up' : 'down'}
          icon={<Wallet className="h-5 w-5" />}
          onClick={() => navigate(`/app/movimientos?month=${currentMonthParam}`)}
        />
        <StatCard
          label="Ahorro posible"
          value={formatCLP(Math.max(0, balance))}
          icon={<PiggyBank className="h-5 w-5" />}
          onClick={() => navigate('/app/metas')}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Salud financiera */}
        {showFinancialHealth && light && (
          <Card>
            <h3 className="font-semibold text-text mb-3">Salud financiera</h3>
            <div className={`traffic-light traffic-light-${light.status === 'order' ? 'order' : light.status === 'tension' ? 'tension' : 'risk'} mb-3`}>
              {light.emoji} {light.label}
            </div>
            <ul className="space-y-1">
              {light.reasons.map((r, i) => (
                <li key={i} className="text-sm text-text-muted">• {r}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* Proyección de cierre */}
        {showMonthlyProjection && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text">Proyección de cierre</h3>
              <TrendingUp className="h-5 w-5 text-text-light" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Saldo actual</span>
                <span className="font-medium text-text">{formatCLP(balance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Pagos pendientes</span>
                <span className="font-medium text-text">{formatCLP(pendingPayments.reduce((sum, payment) => sum + payment.amount_clp, 0))}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">Cierre estimado</span>
                  <span className={`text-lg font-bold ${projectedClose >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCLP(projectedClose)}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Estimación construida con tu saldo actual y los pagos pendientes que ya registraste.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Meta principal */}
        <Card className={primaryGoal ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Meta principal</h3>
            <Target className="h-5 w-5 text-text-light" />
          </div>
          {primaryGoal ? (
            <button type="button" onClick={() => navigate('/app/metas')} className="block w-full text-left cursor-pointer">
              <p className="text-sm text-text-secondary mb-2">{primaryGoal.name}</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl font-bold text-text">{formatCLP(primaryGoal.current_amount_clp)}</span>
                <span className="text-sm text-text-muted">/ {formatCLP(primaryGoal.target_amount_clp)}</span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1">
                {Math.round((primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)}% completado
              </p>
            </button>
          ) : (
            <EmptyState title="Sin meta" description="Crea tu primera meta de ahorro." action={{ label: 'Crear meta', onClick: () => navigate('/app/metas') }} />
          )}
        </Card>

        {/* Pagos próximos */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Pagos próximos</h3>
            <CalendarClock className="h-5 w-5 text-text-light" />
          </div>
          {pendingPayments.length > 0 ? (
            <ul className="space-y-2">
              {pendingPayments.slice(0, 5).map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-sm rounded-lg px-2 py-2 -mx-2 hover:bg-surface-hover transition-colors cursor-pointer text-left"
                    onClick={() => navigate(`/app/calendario?itemId=${p.id}&mode=edit`)}
                  >
                    <span className="text-text-secondary">{p.description}</span>
                    <div className="text-right">
                      <span className="font-medium text-text">{formatCLP(p.amount_clp)}</span>
                      <span className={`ml-2 text-xs ${p.status === 'overdue' ? 'text-danger' : 'text-text-muted'}`}>
                        {p.status === 'overdue' ? 'Vencido' : p.due_date}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No hay pagos pendientes este mes.</p>
          )}
        </Card>

        {/* Aportes por miembro */}
        <Card className={memberContributions.length > 0 ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Aportes compartidos</h3>
            <BarChart3 className="h-5 w-5 text-text-light" />
          </div>
          {memberContributions.length > 0 ? (
            <button type="button" onClick={() => navigate('/app/reparto')} className="block w-full text-left cursor-pointer">
            <div className="space-y-3">
              {memberContributions.map((mc, i) => {
                const totalShared = memberContributions.reduce((s, m) => s + m.total, 0);
                const pct = totalShared > 0 ? (mc.total / totalShared) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">{mc.name}</span>
                      <span className="font-medium text-text">{formatCLP(mc.total)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-border rounded-full">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            </button>
          ) : (
            <p className="text-sm text-text-muted">Sin datos de aportes aún.</p>
          )}
        </Card>
      </div>

      {(showSmartAlerts || showRecommendations) && (
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {showSmartAlerts && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text">Alertas del hogar</h3>
                <AlertTriangle className="h-5 w-5 text-text-light" />
              </div>
              {insights.alerts.length > 0 ? (
                <div className="space-y-3">
                  {insights.alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => openInsightAction(alert.action)}
                      className={`rounded-xl border border-border p-4 w-full text-left ${alert.action ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold text-text">{alert.title}</p>
                        <span className={`badge ${
                          alert.severity === 'danger'
                            ? 'badge-danger'
                            : alert.severity === 'warning'
                              ? 'badge-warning'
                              : alert.severity === 'success'
                                ? 'badge-success'
                                : 'badge-info'
                        }`}>
                          {alert.severity === 'danger' ? 'Alta' : alert.severity === 'warning' ? 'Media' : 'Info'}
                        </span>
                      </div>
                      <p className="text-sm text-text-muted">{alert.message}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No vemos alertas relevantes este mes.</p>
              )}
            </Card>
          )}

          {showRecommendations && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text">Recomendaciones</h3>
                <Lightbulb className="h-5 w-5 text-text-light" />
              </div>
              {insights.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {insights.recommendations.map((recommendation) => (
                    <button
                      key={recommendation.id}
                      type="button"
                      onClick={() => openInsightAction(recommendation.action)}
                      className={`rounded-xl border border-border p-4 w-full text-left ${recommendation.action ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all' : ''}`}
                    >
                      <p className="text-sm font-semibold text-text mb-1">{recommendation.title}</p>
                      <p className="text-sm text-text-muted">{recommendation.message}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Todavía no hay recomendaciones para este mes.</p>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Quick actions */}
      {!isRestricted && (
        <div className="mt-6">
          <Card>
            <h3 className="font-semibold text-text mb-3">¿Qué hacer ahora?</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="sm" onClick={() => navigate('/app/movimientos')} icon={<Plus className="h-3.5 w-3.5" />}>
                Registrar movimiento
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/app/reparto')} icon={<ArrowRight className="h-3.5 w-3.5" />}>
                Ver reparto
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/app/calendario')} icon={<CalendarClock className="h-3.5 w-3.5" />}>
                Calendario de pagos
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================
// Casa Clara — Dashboard Page
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, StatCard, Button, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import { calculateTrafficLight, type TrafficLightResult } from '../../utils/traffic-light';
import type { Transaction, PaymentCalendarItem, SavingsGoal } from '../../types/database';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Target, CalendarClock,
  ArrowRight, Plus, BarChart3,
} from 'lucide-react';

export function DashboardPage() {
  const { household, members } = useHousehold();
  const { isRestricted } = useSubscription();
  const navigate = useNavigate();
  const { year, month } = getCurrentMonthYear();
  const { start, end } = getMonthRange(year, month);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentCalendarItem[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<SavingsGoal | null>(null);
  const [light, setLight] = useState<TrafficLightResult | null>(null);


  useEffect(() => {
    if (!household) return;
    loadDashboardData();
  }, [household]);

  async function loadDashboardData() {
    if (!household) return;

    const [txRes, payRes, goalRes] = await Promise.all([
      supabase.from('transactions').select('*')
        .eq('household_id', household.id)
        .gte('occurred_on', start).lte('occurred_on', end)
        .is('deleted_at', null),
      supabase.from('payment_calendar_items').select('*')
        .eq('household_id', household.id)
        .gte('due_date', start).lte('due_date', end),
      supabase.from('savings_goals').select('*')
        .eq('household_id', household.id)
        .eq('is_primary', true).eq('status', 'active')
        .limit(1).single(),
    ]);

    const txs = (txRes.data || []) as Transaction[];
    const pays = (payRes.data || []) as PaymentCalendarItem[];
    const goal = goalRes.data as SavingsGoal | null;

    setTransactions(txs);
    setPayments(pays);
    setPrimaryGoal(goal);

    const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
    const totalExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
    setLight(calculateTrafficLight(totalIncome, totalExpenses, pays, goal, month));
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
  const balance = totalIncome - totalExpenses;
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue');

  const memberContributions = members.map(m => {
    const shared = transactions.filter(t => t.type === 'expense' && t.scope === 'shared' && t.paid_by_member_id === m.id);
    return { name: m.display_name, total: shared.reduce((s, t) => s + t.amount_clp, 0) };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)}</p>
        </div>
        {light && (
          <div className={`traffic-light traffic-light-${light.status === 'order' ? 'order' : light.status === 'tension' ? 'tension' : 'risk'}`}>
            {light.emoji} {light.label}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ingresos" value={formatCLP(totalIncome)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Gastos" value={formatCLP(totalExpenses)} icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard label="Saldo" value={formatCLP(balance)} trend={balance >= 0 ? 'up' : 'down'} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Ahorro posible" value={formatCLP(Math.max(0, balance))} icon={<PiggyBank className="h-5 w-5" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Semáforo detail */}
        {light && (
          <Card>
            <h3 className="font-semibold text-text mb-3">Estado del mes</h3>
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

        {/* Meta principal */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Meta principal</h3>
            <Target className="h-5 w-5 text-text-light" />
          </div>
          {primaryGoal ? (
            <div>
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
            </div>
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
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{p.description}</span>
                  <div className="text-right">
                    <span className="font-medium text-text">{formatCLP(p.amount_clp)}</span>
                    <span className={`ml-2 text-xs ${p.status === 'overdue' ? 'text-danger' : 'text-text-muted'}`}>
                      {p.status === 'overdue' ? 'Vencido' : p.due_date}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No hay pagos pendientes este mes.</p>
          )}
        </Card>

        {/* Aportes por miembro */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">Aportes compartidos</h3>
            <BarChart3 className="h-5 w-5 text-text-light" />
          </div>
          {memberContributions.length > 0 ? (
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
          ) : (
            <p className="text-sm text-text-muted">Sin datos de aportes aún.</p>
          )}
        </Card>
      </div>

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

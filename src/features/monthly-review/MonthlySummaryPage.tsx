// Casa Clara — Monthly Summary Page
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { Card, StatCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import type { Transaction, Category } from '../../types/database';
import { BarChart3, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export function MonthlySummaryPage() {
  const { household } = useHousehold();
  const { year, month } = getCurrentMonthYear();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    if (!household) return;
    const { start, end } = getMonthRange(year, month);
    const [txRes, catRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('household_id', household.id)
        .gte('occurred_on', start).lte('occurred_on', end).is('deleted_at', null),
      supabase.from('categories').select('*').eq('household_id', household.id).is('deleted_at', null),
    ]);
    setTransactions((txRes.data || []) as Transaction[]);
    setCategories((catRes.data || []) as Category[]);
  }, [household, year, month]);

  useEffect(() => { void load(); }, [load]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
  const balance = totalIncome - totalExpenses;

  const expensesByCategory = categories.map(c => {
    const total = transactions.filter(t => t.type === 'expense' && t.category_id === c.id).reduce((s, t) => s + t.amount_clp, 0);
    return { ...c, total };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const maxCatTotal = Math.max(...expensesByCategory.map(c => c.total), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Resumen mensual</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)}</p>
        </div>
        <BarChart3 className="h-6 w-6 text-text-light" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Ingresos" value={formatCLP(totalIncome)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Gastos" value={formatCLP(totalExpenses)} icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard label="Saldo" value={formatCLP(balance)} trend={balance >= 0 ? 'up' : 'down'} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Card>
        <h3 className="font-semibold text-text mb-4">Gastos por categoría</h3>
        {expensesByCategory.length === 0 ? (
          <p className="text-sm text-text-muted">Sin gastos registrados este mes.</p>
        ) : (
          <div className="space-y-3">
            {expensesByCategory.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">{c.icon} {c.name}</span>
                  <span className="font-medium text-text">{formatCLP(c.total)}</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(c.total / maxCatTotal) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <Card>
          <h3 className="font-semibold text-text mb-3">Gastos compartidos vs personales</h3>
          {(() => {
            const shared = transactions.filter(t => t.type === 'expense' && t.scope === 'shared').reduce((s, t) => s + t.amount_clp, 0);
            const personal = transactions.filter(t => t.type === 'expense' && t.scope === 'personal').reduce((s, t) => s + t.amount_clp, 0);
            const total = shared + personal;
            return total > 0 ? (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-text-secondary">Compartidos</span><span className="font-medium">{formatCLP(shared)} ({Math.round((shared / total) * 100)}%)</span></div>
                  <div className="w-full h-2 bg-border rounded-full"><div className="h-full bg-primary rounded-full" style={{ width: `${(shared / total) * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-text-secondary">Personales</span><span className="font-medium">{formatCLP(personal)} ({Math.round((personal / total) * 100)}%)</span></div>
                  <div className="w-full h-2 bg-border rounded-full"><div className="h-full bg-accent rounded-full" style={{ width: `${(personal / total) * 100}%` }} /></div>
                </div>
              </div>
            ) : <p className="text-sm text-text-muted">Sin datos.</p>;
          })()}
        </Card>
        <Card>
          <h3 className="font-semibold text-text mb-3">Resumen rápido</h3>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>• {transactions.length} movimientos registrados</li>
            <li>• {transactions.filter(t => t.type === 'expense').length} gastos</li>
            <li>• {transactions.filter(t => t.type === 'income').length} ingresos</li>
            <li>• Tasa de ahorro: {totalIncome > 0 ? `${Math.round((balance / totalIncome) * 100)}%` : '—'}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

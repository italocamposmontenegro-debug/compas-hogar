// ============================================
// Casa Clara — Split / Reparto Page
// ============================================

import { useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { Card, StatCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import { calculateSplit, describeSplitImbalance, type SplitSummary } from '../../utils/split-calculator';
import { SPLIT_RULE_LABELS } from '../../lib/constants';
import type { Transaction } from '../../types/database';
import { Scale, AlertTriangle, CheckCircle } from 'lucide-react';

export function SplitPage() {
  const { household, members } = useHousehold();
  const { year, month } = getCurrentMonthYear();
  const [splitData, setSplitData] = useState<SplitSummary | null>(null);

  useEffect(() => { if (household) loadSplit(); }, [household]);

  async function loadSplit() {
    if (!household) return;
    const { start, end } = getMonthRange(year, month);
    const { data } = await supabase.from('transactions').select('*')
      .eq('household_id', household.id).gte('occurred_on', start).lte('occurred_on', end).is('deleted_at', null);
    const txs = (data || []) as Transaction[];
    setSplitData(calculateSplit(household, members, txs));
  }

  const ruleLabel = household ? SPLIT_RULE_LABELS[household.split_rule_type as keyof typeof SPLIT_RULE_LABELS] || household.split_rule_type : '';
  const imbalanceMsg = splitData ? describeSplitImbalance(splitData.results) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Reparto</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)} · Regla: {ruleLabel}</p>
        </div>
        <Scale className="h-6 w-6 text-text-light" />
      </div>

      {splitData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total compartido" value={formatCLP(splitData.totalSharedExpenses)} />
            {splitData.results.map(r => (
              <StatCard key={r.memberId} label={`Aporte de ${r.memberName}`} value={formatCLP(r.actualPaid)}
                subValue={`Debería: ${formatCLP(r.shouldPay)}`} trend={r.difference >= 0 ? 'up' : 'down'} />
            ))}
          </div>

          {/* Imbalance alert */}
          {splitData.hasImbalance && imbalanceMsg && (
            <Card className="mb-6 border-warning/30 bg-warning-bg/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <p className="text-sm text-warning font-medium">{imbalanceMsg}</p>
              </div>
            </Card>
          )}

          {!splitData.hasImbalance && (
            <Card className="mb-6 border-success/30 bg-success-bg/50">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <p className="text-sm text-success font-medium">Los aportes están balanceados según la regla actual.</p>
              </div>
            </Card>
          )}

          {/* Detail table */}
          <Card padding="sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Miembro</th>
                  <th className="text-right py-3 px-4 font-medium text-text-muted">Debería aportar</th>
                  <th className="text-right py-3 px-4 font-medium text-text-muted">Aportó</th>
                  <th className="text-right py-3 px-4 font-medium text-text-muted">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {splitData.results.map(r => (
                  <tr key={r.memberId} className="border-b border-border-light">
                    <td className="py-3 px-4 font-medium text-text">{r.memberName}</td>
                    <td className="py-3 px-4 text-right text-text-muted">{formatCLP(r.shouldPay)}</td>
                    <td className="py-3 px-4 text-right text-text">{formatCLP(r.actualPaid)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${r.difference >= 0 ? 'text-success' : 'text-danger'}`}>
                      {r.difference >= 0 ? '+' : ''}{formatCLP(r.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

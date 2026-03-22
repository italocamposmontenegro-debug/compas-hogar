// Casa Clara — Comparison Page (Plus)
import { useEffect, useState } from 'react';
import { Card, LoadingSpinner, StatCard, FeatureGate } from '../../components/ui';
import { GitCompare, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../hooks/useHousehold';
import { formatCLP } from '../../utils/format-clp';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';

export function ComparisonPage() {
  const { household } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    current: number;
    previous: number;
    diff: number;
    percent: number;
  } | null>(null);

  useEffect(() => {
    if (household) load();
  }, [household]);

  async function load() {
    if (!household) return;
    setLoading(true);

    const now = new Date();
    const curStart = startOfMonth(now).toISOString();
    const curEnd = endOfMonth(now).toISOString();
    const prevStart = startOfMonth(subMonths(now, 1)).toISOString();
    const prevEnd = endOfMonth(subMonths(now, 1)).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase.from('transactions')
        .select('amount')
        .eq('household_id', household.id!)
        .eq('type', 'expense')
        .gte('transaction_date', curStart)
        .lte('transaction_date', curEnd) as any,
      supabase.from('transactions')
        .select('amount')
        .eq('household_id', household.id!)
        .eq('type', 'expense')
        .gte('transaction_date', prevStart)
        .lte('transaction_date', prevEnd) as any,
    ]);

    const current = (curRes.data || []).reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const previous = (prevRes.data || []).reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const diff = current - previous;
    const percent = previous > 0 ? (diff / previous) * 100 : 0;

    setData({ current, previous, diff, percent });
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <FeatureGate feature="comparison">
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Comparación mensual</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            label="Mes actual" 
            value={formatCLP(data?.current || 0)} 
            icon={<ArrowUpRight className="h-4 w-4 text-primary" />} 
          />
          <StatCard 
            label="Mes anterior" 
            value={formatCLP(data?.previous || 0)} 
          />
          <StatCard 
            label="Variación" 
            value={formatCLP(Math.abs(data?.diff || 0))} 
            subValue={`${data?.percent.toFixed(1)}% vs mes pasado`}
            trend={(data?.percent || 0) > 0 ? 'up' : (data?.percent || 0) < 0 ? 'down' : 'neutral'}
          />
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-6">
            <GitCompare className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-text">Desglose por categoría</h3>
          </div>
          <div className="text-center py-12">
            <GitCompare className="h-12 w-12 text-text-light mx-auto mb-4" />
            <h3 className="font-semibold text-text mb-2">Más detalles pronto</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Estamos trabajando en un desglose visual por categorías para que veas dónde aumentó más tu gasto este mes.
            </p>
          </div>
        </Card>
      </div>
    </FeatureGate>
  );
}

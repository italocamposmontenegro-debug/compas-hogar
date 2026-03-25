// Casa Clara — Comparison Page (Plus)
import { useCallback, useEffect, useState } from 'react';
import { Card, LoadingSpinner, StatCard, FeatureGate } from '../../components/ui';
import { GitCompare, ArrowUpRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../hooks/useHousehold';
import { formatCLP } from '../../utils/format-clp';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';
import type { Category } from '../../types/database';

export function ComparisonPage() {
  const { household } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    current: number;
    previous: number;
    diff: number;
    percent: number;
    categories: {
      categoryId: string;
      name: string;
      icon: string;
      current: number;
      previous: number;
      diff: number;
      percent: number;
    }[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    try {
      const now = new Date();
      const curStart = startOfMonth(now).toISOString();
      const curEnd = endOfMonth(now).toISOString();
      const prevStart = startOfMonth(subMonths(now, 1)).toISOString();
      const prevEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const [curRes, prevRes, categoriesRes] = await Promise.all([
        supabase.from('transactions')
          .select('amount_clp, category_id')
          .eq('household_id', household.id!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('occurred_on', curStart)
          .lte('occurred_on', curEnd),
        supabase.from('transactions')
          .select('amount_clp, category_id')
          .eq('household_id', household.id!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('occurred_on', prevStart)
          .lte('occurred_on', prevEnd),
        supabase.from('categories')
          .select('id, name, icon')
          .eq('household_id', household.id!)
          .is('deleted_at', null),
      ]);

      const current = (curRes.data || []).reduce((acc, curr) => acc + curr.amount_clp, 0);
      const previous = (prevRes.data || []).reduce((acc, curr) => acc + curr.amount_clp, 0);
      const diff = current - previous;
      const percent = previous > 0 ? (diff / previous) * 100 : 0;
      const categories = (categoriesRes.data || []) as Category[];

      const currentByCategory = new Map<string, number>();
      for (const row of curRes.data || []) {
        const key = row.category_id || 'uncategorized';
        currentByCategory.set(key, (currentByCategory.get(key) || 0) + row.amount_clp);
      }

      const previousByCategory = new Map<string, number>();
      for (const row of prevRes.data || []) {
        const key = row.category_id || 'uncategorized';
        previousByCategory.set(key, (previousByCategory.get(key) || 0) + row.amount_clp);
      }

      const categoryKeys = new Set([
        ...currentByCategory.keys(),
        ...previousByCategory.keys(),
      ]);

      const categoryRows = Array.from(categoryKeys).map((key) => {
        const category = categories.find((entry) => entry.id === key);
        const currentTotal = currentByCategory.get(key) || 0;
        const previousTotal = previousByCategory.get(key) || 0;
        const categoryDiff = currentTotal - previousTotal;
        return {
          categoryId: key,
          name: category?.name || 'Sin categoría',
          icon: category?.icon || '📦',
          current: currentTotal,
          previous: previousTotal,
          diff: categoryDiff,
          percent: previousTotal > 0 ? (categoryDiff / previousTotal) * 100 : 0,
        };
      }).sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));

      setData({ current, previous, diff, percent, categories: categoryRows });
    } finally {
      setLoading(false);
    }
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

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
          {data?.categories.length ? (
            <div className="space-y-3">
              {data.categories.map((category) => (
                <div key={category.categoryId} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium text-text">{category.name}</span>
                    </div>
                    <span className={`text-sm font-semibold ${
                      category.diff > 0 ? 'text-danger' : category.diff < 0 ? 'text-success' : 'text-text-muted'
                    }`}>
                      {category.diff > 0 ? '+' : ''}{formatCLP(category.diff)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-text-muted">Mes actual</p>
                      <p className="font-medium text-text">{formatCLP(category.current)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Mes anterior</p>
                      <p className="font-medium text-text">{formatCLP(category.previous)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Variación</p>
                      <p className={`font-medium ${
                        category.diff > 0 ? 'text-danger' : category.diff < 0 ? 'text-success' : 'text-text'
                      }`}>
                        {category.previous > 0 ? `${category.percent.toFixed(1)}%` : 'Sin base'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <GitCompare className="h-12 w-12 text-text-light mx-auto mb-4" />
              <h3 className="font-semibold text-text mb-2">Sin comparación disponible</h3>
              <p className="text-sm text-text-muted max-w-sm mx-auto">
                Registra gastos en dos meses consecutivos para ver en qué categorías estás subiendo o bajando.
              </p>
            </div>
          )}
        </Card>
      </div>
    </FeatureGate>
  );
}

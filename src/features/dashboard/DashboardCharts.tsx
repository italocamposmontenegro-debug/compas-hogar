import { useMemo, type ElementType } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PieChart, Scale, TrendingUp } from 'lucide-react';
import { calculateHouseholdBalance, type HouseholdBalanceSummary } from '../../lib/household-finance';
import { formatCLP, formatCLPShort } from '../../utils/format-clp';
import type { Category, Household, HouseholdMember, Transaction } from '../../types/database';

interface DashboardChartsProps {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  transactions: Transaction[];
  balanceSummary: HouseholdBalanceSummary;
  year: number;
  month: number;
}

interface FlowPoint {
  label: string;
  ingresos: number;
  egresos: number;
}

interface CategoryPoint {
  name: string;
  icon: string;
  total: number;
  percent: number;
}

interface BalancePoint {
  label: string;
  saldo: number;
}

function getVisibleDays(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) {
    return daysInMonth;
  }

  return today.getDate();
}

function getDay(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).getDate();
}

function buildFlowSeries(transactions: Transaction[], year: number, month: number): FlowPoint[] {
  const visibleDays = getVisibleDays(year, month);
  const incomeByDay = new Map<number, number>();
  const expenseByDay = new Map<number, number>();

  for (const transaction of transactions) {
    if (transaction.deleted_at) continue;

    const day = getDay(transaction.occurred_on);

    if (transaction.type === 'income') {
      incomeByDay.set(day, (incomeByDay.get(day) ?? 0) + transaction.amount_clp);
      continue;
    }

    expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + transaction.amount_clp);
  }

  const points: FlowPoint[] = [];
  let cumulativeIncome = 0;
  let cumulativeExpense = 0;

  for (let day = 1; day <= visibleDays; day += 1) {
    cumulativeIncome += incomeByDay.get(day) ?? 0;
    cumulativeExpense += expenseByDay.get(day) ?? 0;

    points.push({
      label: String(day),
      ingresos: cumulativeIncome,
      egresos: cumulativeExpense,
    });
  }

  return points;
}

function buildCategorySeries(transactions: Transaction[], categories: Category[]): CategoryPoint[] {
  const totals = new Map<string, number>();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  for (const transaction of transactions) {
    if (transaction.deleted_at || transaction.type !== 'expense') continue;

    const key = transaction.category_id ?? 'sin-categoria';
    totals.set(key, (totals.get(key) ?? 0) + transaction.amount_clp);
  }

  const grandTotal = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  if (grandTotal === 0) return [];

  const sorted = [...totals.entries()].sort((left, right) => right[1] - left[1]);
  const primary = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const points = primary.map(([categoryId, total]) => {
    const category = categoryMap.get(categoryId);

    return {
      name: category?.name ?? 'Sin categoría',
      icon: category?.icon ?? '📦',
      total,
      percent: Math.round((total / grandTotal) * 100),
    };
  });

  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, [, total]) => sum + total, 0);
    points.push({
      name: 'Otros',
      icon: '📦',
      total: restTotal,
      percent: Math.round((restTotal / grandTotal) * 100),
    });
  }

  return points;
}

function buildBalanceSeries({
  household,
  members,
  categories,
  transactions,
  year,
  month,
}: {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  transactions: Transaction[];
  year: number;
  month: number;
}): BalancePoint[] {
  const visibleDays = getVisibleDays(year, month);
  const acceptedMembers = members.filter((member) => member.invitation_status === 'accepted');
  const referenceMemberId = acceptedMembers[0]?.id ?? null;
  const sortedTransactions = [...transactions]
    .filter((transaction) => !transaction.deleted_at)
    .sort((left, right) => {
      const byDate = left.occurred_on.localeCompare(right.occurred_on);
      if (byDate !== 0) return byDate;
      return left.created_at.localeCompare(right.created_at);
    });

  const points: BalancePoint[] = [];
  const cumulativeTransactions: Transaction[] = [];
  let cursor = 0;

  for (let day = 1; day <= visibleDays; day += 1) {
    while (cursor < sortedTransactions.length && getDay(sortedTransactions[cursor].occurred_on) <= day) {
      cumulativeTransactions.push(sortedTransactions[cursor]);
      cursor += 1;
    }

    const summary = calculateHouseholdBalance({
      household,
      members,
      transactions: cumulativeTransactions,
      categories,
    });

    let signedAmount = 0;
    if (summary.status === 'Pendiente' && summary.netAmount > 0) {
      signedAmount = summary.netAmount;

      if (referenceMemberId && summary.favoredMemberId && summary.favoredMemberId !== referenceMemberId) {
        signedAmount = summary.netAmount * -1;
      }
    }

    points.push({
      label: String(day),
      saldo: signedAmount,
    });
  }

  return points;
}

function FlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="ui-panel p-3 text-sm shadow-lg">
      <p className="mb-2 font-medium text-text-muted">Día {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-text">
          {entry.name === 'ingresos' ? '↑ Ingresos' : '↓ Egresos'}: {formatCLP(entry.value)}
        </p>
      ))}
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div className="ui-panel p-3 text-sm shadow-lg">
      <p className="font-medium text-text">
        {item.icon} {item.name}
      </p>
      <p className="mt-1 text-text-muted">
        {formatCLP(item.total)} · {item.percent}% del total
      </p>
    </div>
  );
}

function BalanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const value = Math.abs(payload[0].value);

  return (
    <div className="ui-panel p-3 text-sm shadow-lg">
      <p className="mb-1 text-text-muted">Día {label}</p>
      <p className="font-medium text-text">
        {value === 0 ? 'Puesta al día' : `${formatCLP(value)} de saldo`}
      </p>
    </div>
  );
}

function EmptyChart({
  icon: Icon,
  message,
}: {
  icon: ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Icon className="h-10 w-10 text-text-light" />
      <p className="max-w-xs text-center text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function DashboardCharts({
  household,
  members,
  categories,
  transactions,
  balanceSummary,
  year,
  month,
}: DashboardChartsProps) {
  const flow = useMemo(() => buildFlowSeries(transactions, year, month), [month, transactions, year]);
  const categorySeries = useMemo(() => buildCategorySeries(transactions, categories), [categories, transactions]);
  const balanceSeries = useMemo(
    () => buildBalanceSeries({ household, members, categories, transactions, year, month }),
    [categories, household, members, month, transactions, year],
  );

  const flowInsight = useMemo(() => {
    if (!flow.length) return null;

    const lastPoint = flow[flow.length - 1];
    if (lastPoint.ingresos === 0) {
      return 'Sin ingresos registrados aún este mes.';
    }

    const ratio = lastPoint.egresos / lastPoint.ingresos;
    if (ratio >= 1) {
      return 'Los egresos ya superaron los ingresos del mes.';
    }

    return `Se ha usado el ${Math.round(ratio * 100)}% de los ingresos registrados este mes.`;
  }, [flow]);

  const categoryInsight = useMemo(() => {
    if (!categorySeries.length) return null;

    const topCategory = categorySeries[0];
    const secondCategory = categorySeries[1];

    if (secondCategory) {
      return `${topCategory.icon} ${topCategory.name} y ${secondCategory.icon} ${secondCategory.name} concentran el ${topCategory.percent + secondCategory.percent}% del gasto.`;
    }

    return `${topCategory.icon} ${topCategory.name} representa el ${topCategory.percent}% del gasto del mes.`;
  }, [categorySeries]);

  const balanceInsight = useMemo(() => {
    if (balanceSummary.status === 'Puesta al dia') {
      return 'Por ahora no hay desbalance pendiente entre ustedes.';
    }

    if (balanceSummary.netAmount < 50_000) {
      return `Hay un saldo leve de ${formatCLP(balanceSummary.netAmount)} a favor de ${balanceSummary.favoredMemberName}.`;
    }

    return `${balanceSummary.favoredMemberName} ha adelantado ${formatCLP(balanceSummary.netAmount)} más de lo que correspondía.`;
  }, [balanceSummary]);

  const balanceColor = balanceSummary.status === 'Puesta al dia'
    ? 'var(--color-success)'
    : balanceSummary.netAmount < 50_000
      ? '#d97706'
      : 'var(--color-danger)';

  return (
    <section className="grid gap-6 xl:grid-cols-3" aria-label="Gráficos del resumen mensual">
      <div className="ui-panel overflow-hidden p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Estado del mes</p>
        <h2 className="mt-2 text-[1.15rem] font-semibold tracking-tight text-text">Ingresos vs egresos</h2>

        {flow.length < 2 ? (
          <EmptyChart
            icon={TrendingUp}
            message="Registra tu primer movimiento del mes para ver cómo avanza."
          />
        ) : (
          <>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flow} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboard-chart-income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashboard-chart-expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    interval="preserveStartEnd"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickFormatter={formatCLPShort}
                    tickLine={false}
                  />
                  <Tooltip content={<FlowTooltip />} />
                  <Area
                    dataKey="ingresos"
                    dot={false}
                    fill="url(#dashboard-chart-income)"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Area
                    dataKey="egresos"
                    dot={false}
                    fill="url(#dashboard-chart-expense)"
                    stroke="var(--color-danger)"
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {flowInsight ? (
              <p className="mt-4 text-sm leading-6 text-text-muted">{flowInsight}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="ui-panel overflow-hidden p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Dónde se fue</p>
        <h2 className="mt-2 text-[1.15rem] font-semibold tracking-tight text-text">Gasto por categoría</h2>

        {categorySeries.length === 0 ? (
          <EmptyChart
            icon={PieChart}
            message="Todavía no hay gasto suficiente para dibujar esta lectura."
          />
        ) : (
          <>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categorySeries}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickFormatter={formatCLPShort}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickFormatter={(value: string) => (value.length > 12 ? `${value.slice(0, 12)}…` : value)}
                    tickLine={false}
                    type="category"
                    width={88}
                  />
                  <Tooltip content={<CategoryTooltip />} />
                  <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                    {categorySeries.map((category, index) => (
                      <Cell
                        key={`${category.name}-${index}`}
                        fill="var(--color-primary)"
                        fillOpacity={Math.max(0.45, 1 - index * 0.1)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {categoryInsight ? (
              <p className="mt-4 text-sm leading-6 text-text-muted">{categoryInsight}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="ui-panel overflow-hidden p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Entre ustedes</p>
        <h2 className="mt-2 text-[1.15rem] font-semibold tracking-tight text-text">Evolución de Saldo Hogar</h2>

        {balanceSeries.length < 2 ? (
          <EmptyChart
            icon={Scale}
            message="Cuando haya movimientos compartidos, aquí se verá si el mes se va equilibrando."
          />
        ) : (
          <>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    interval="preserveStartEnd"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickFormatter={(value: number) => formatCLPShort(Math.abs(value))}
                    tickLine={false}
                  />
                  <Tooltip content={<BalanceTooltip />} />
                  <ReferenceLine stroke="var(--color-border)" strokeWidth={1.5} y={0} />
                  <Line
                    activeDot={{ r: 4, fill: balanceColor }}
                    dataKey="saldo"
                    dot={false}
                    stroke={balanceColor}
                    strokeWidth={2}
                    type="stepAfter"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-4 text-sm leading-6 text-text-muted">{balanceInsight}</p>
          </>
        )}
      </div>
    </section>
  );
}

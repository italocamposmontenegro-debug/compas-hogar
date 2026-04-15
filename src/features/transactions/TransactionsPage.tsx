import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import {
  AlertBanner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  InputField,
  Modal,
  SelectField,
} from '../../components/ui';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import type { Category, SavingsGoal, Transaction } from '../../types/database';
import {
  FLOW_TYPE_LABELS,
  getTransactionFlowType,
  isSavingsFlow,
  type MovementFlowType,
} from '../../lib/household-finance';
import {
  ArrowUpDown,
  CalendarDays,
  Edit2,
  HandCoins,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type ModuleMode = 'income' | 'expenses' | 'savings' | 'legacy';

type ModuleConfig = {
  eyebrow: string;
  title: string;
  description: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  createDefaults: {
    type: 'income' | 'expense';
    flowType: MovementFlowType;
    scope: 'personal' | 'shared';
    affectsBalance: boolean;
  };
};

const MODULES: Record<Exclude<ModuleMode, 'legacy'>, ModuleConfig> = {
  income: {
    eyebrow: 'Ingresos',
    title: 'Dinero que entró al hogar',
    description: 'Registra lo que efectivamente entró este mes para leer el resto con contexto real.',
    createLabel: 'Registrar ingreso',
    emptyTitle: 'Todavía no hay ingresos registrados',
    emptyDescription: 'Comienza por anotar cuánto dinero entró al hogar este mes.',
    createDefaults: {
      type: 'income',
      flowType: 'income',
      scope: 'personal',
      affectsBalance: false,
    },
  },
  expenses: {
    eyebrow: 'Gastos',
    title: 'Gastos del día a día',
    description: 'Anota los gastos variables para ver cuánto queda realmente y cuándo una persona adelantó algo que correspondía a ambos.',
    createLabel: 'Registrar gasto',
    emptyTitle: 'Todavía no hay gastos del día a día',
    emptyDescription: 'Anota los gastos del día a día para ver cuánto queda realmente.',
    createDefaults: {
      type: 'expense',
      flowType: 'gasto_variable',
      scope: 'shared',
      affectsBalance: true,
    },
  },
  savings: {
    eyebrow: 'Ahorro',
    title: 'Ahorro visible del mes',
    description: 'Si este mes puedes, separa una parte. No tiene que ser mucho. Lo importante es dejarlo visible.',
    createLabel: 'Registrar ahorro',
    emptyTitle: 'Todavía no hay ahorro registrado',
    emptyDescription: 'Si este mes puedes, separa una parte. No tiene que ser mucho.',
    createDefaults: {
      type: 'expense',
      flowType: 'ahorro',
      scope: 'personal',
      affectsBalance: false,
    },
  },
};

const EXPENSE_FLOW_OPTIONS: Array<{ value: MovementFlowType; label: string }> = [
  { value: 'gasto_variable', label: 'Gasto del día a día' },
  { value: 'ocio', label: 'Ocio o salidas' },
  { value: 'imprevisto', label: 'Imprevisto' },
  { value: 'inversion', label: 'Inversión' },
];

export function TransactionsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
  const { year, month } = getCurrentMonthYear();

  const mode = useMemo<ModuleMode>(() => {
    if (location.pathname.startsWith('/app/ingresos')) return 'income';
    if (location.pathname.startsWith('/app/gastos')) return 'expenses';
    if (location.pathname.startsWith('/app/ahorro')) return 'savings';
    return 'legacy';
  }, [location.pathname]);

  const moduleConfig = MODULES[mode === 'legacy' ? 'expenses' : mode];
  const currentMonth = searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'danger'>('success');
  const [saving, setSaving] = useState(false);

  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formGoalId, setFormGoalId] = useState('');
  const [formPaidBy, setFormPaidBy] = useState('');
  const [formScope, setFormScope] = useState<'personal' | 'shared'>('shared');
  const [formFlowType, setFormFlowType] = useState<MovementFlowType>('gasto_variable');
  const [formAffectsBalance, setFormAffectsBalance] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!household) return;

    setLoading(true);
    const [selectedYear, selectedMonth] = currentMonth.split('-').map(Number);
    const { start, end } = getMonthRange(selectedYear, selectedMonth);

    const [transactionsResult, categoriesResult, goalsResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', household.id)
        .gte('occurred_on', start)
        .lte('occurred_on', end)
        .is('deleted_at', null)
        .order('occurred_on', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
      supabase
        .from('savings_goals')
        .select('*')
        .eq('household_id', household.id)
        .order('is_primary', { ascending: false }),
    ]);

    setTransactions((transactionsResult.data || []) as Transaction[]);
    setCategories((categoriesResult.data || []) as Category[]);
    setGoals((goalsResult.data || []) as SavingsGoal[]);
    setLoading(false);
  }, [currentMonth, household]);

  useEffect(() => {
    if (!currentMember) return;
    setFormPaidBy(currentMember.id);
  }, [currentMember]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    if (mode === 'income') {
      return transactions.filter((transaction) => getTransactionFlowType(transaction, categories) === 'income');
    }

    if (mode === 'expenses' || mode === 'legacy') {
      return transactions.filter((transaction) => {
        const flowType = getTransactionFlowType(transaction, categories);
        return flowType === 'gasto_variable' || flowType === 'ocio' || flowType === 'imprevisto' || flowType === 'inversion';
      });
    }

    return transactions.filter((transaction) => isSavingsFlow(getTransactionFlowType(transaction, categories)));
  }, [categories, mode, transactions]);

  const summary = useMemo(() => {
    if (mode === 'income') {
      const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
      const contributorNames = [...new Set(
        filteredTransactions
          .map((transaction) => members.find((item) => item.id === transaction.paid_by_member_id)?.display_name)
          .filter(Boolean),
      )] as string[];

      return {
        firstLabel: 'Ingresó este mes',
        firstValue: formatCLP(total),
        firstNote: filteredTransactions.length === 1 ? '1 ingreso registrado' : `${filteredTransactions.length} ingresos registrados`,
        secondLabel: 'Quiénes ya registraron ingresos',
        secondValue: contributorNames.length === 0
          ? 'Sin registros'
          : contributorNames.length === 1
            ? contributorNames[0]
            : `${contributorNames.length} personas`,
        secondNote: contributorNames.length <= 1
          ? 'Cada ingreso queda asociado a la persona que lo registró.'
          : 'Los ingresos del mes ya quedaron visibles para ambos.',
      };
    }

    if (mode === 'savings') {
      const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
      const primaryGoal = goals.find((goal) => goal.is_primary && goal.status === 'active') ?? null;
      return {
        firstLabel: 'Ahorro del mes',
        firstValue: formatCLP(total),
        firstNote: filteredTransactions.length === 0 ? 'Sin registros aún' : `${filteredTransactions.length} registro(s) visibles`,
        secondLabel: 'Meta principal',
        secondValue: primaryGoal ? primaryGoal.name : 'Sin definir',
        secondNote: primaryGoal ? `Avance visible: ${formatCLP(primaryGoal.current_amount_clp)}` : 'Puedes dejar el ahorro libre o asociarlo a una meta.',
      };
    }

    const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount_clp, 0);
    const sharedTotal = filteredTransactions
      .filter((transaction) => transaction.scope === 'shared')
      .reduce((sum, transaction) => sum + transaction.amount_clp, 0);
    const balanceRelevant = filteredTransactions
      .filter((transaction) => transaction.affects_household_balance)
      .reduce((sum, transaction) => sum + transaction.amount_clp, 0);

    return {
      firstLabel: 'Gasto visible del mes',
      firstValue: formatCLP(total),
      firstNote: 'Solo gastos del día a día, ocio, imprevistos e inversión.',
      secondLabel: 'Cuenta para Saldo Hogar',
      secondValue: formatCLP(balanceRelevant),
      secondNote: sharedTotal > 0 ? `${formatCLP(sharedTotal)} quedó marcado como gasto entre ambos.` : 'Aún no hay gastos entre ambos registrados.',
    };
  }, [filteredTransactions, goals, members, mode]);

  const openCreateForm = useCallback(() => {
    setEditingTransaction(null);
    setFormDescription('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategoryId('');
    setFormGoalId('');
    setFormPaidBy(currentMember?.id || '');
    setFormScope(moduleConfig.createDefaults.scope);
    setFormFlowType(moduleConfig.createDefaults.flowType);
    setFormAffectsBalance(moduleConfig.createDefaults.affectsBalance);
    setFormNotes('');
    setShowForm(true);
  }, [currentMember?.id, moduleConfig.createDefaults.affectsBalance, moduleConfig.createDefaults.flowType, moduleConfig.createDefaults.scope]);

  useEffect(() => {
    if (!canWrite) return;
    if (!searchParams.get('create')) return;

    openCreateForm();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canWrite, openCreateForm, searchParams, setSearchParams]);

  function openEditForm(transaction: Transaction) {
    const flowType = getTransactionFlowType(transaction, categories);

    setEditingTransaction(transaction);
    setFormDescription(transaction.description);
    setFormAmount(String(transaction.amount_clp));
    setFormDate(transaction.occurred_on);
    setFormCategoryId(transaction.category_id || '');
    setFormGoalId(transaction.goal_id || '');
    setFormPaidBy(transaction.paid_by_member_id);
    setFormScope(transaction.scope);
    setFormFlowType(flowType);
    setFormAffectsBalance(transaction.affects_household_balance);
    setFormNotes(transaction.notes || '');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
  }

  async function handleSave() {
    if (!household || !currentMember) return;

    if (!formDescription.trim() || !formAmount || !formDate || !formPaidBy) {
      setMessageType('danger');
      setMessage('Completa descripción, monto, fecha y quién registra el movimiento.');
      return;
    }

    const type = moduleConfig.createDefaults.type;
    const flowType = type === 'income' ? 'income' : formFlowType;
    const categoryId = type === 'expense' && mode !== 'savings' ? formCategoryId || null : null;
    const goalId = mode === 'savings' ? formGoalId || null : null;
    const affectsHouseholdBalance = mode === 'expenses' ? formAffectsBalance : false;

    setSaving(true);
    setMessage('');

    try {
      if (editingTransaction) {
        const { error } = await supabase.functions.invoke('manage-transaction', {
          body: {
            action: 'update',
            transactionId: editingTransaction.id,
            type,
            flowType,
            description: formDescription,
            amountClp: parseInt(formAmount, 10),
            categoryId,
            goalId,
            occurredOn: formDate,
            paidByMemberId: formPaidBy,
            scope: formScope,
            expenseType: flowType === 'pago_obligatorio' ? 'fixed' : 'variable',
            affectsHouseholdBalance,
            notes: formNotes || null,
          },
        });

        if (error) throw error;
        setMessageType('success');
        setMessage('Movimiento actualizado correctamente.');
      } else {
        const { error } = await supabase.functions.invoke('manage-transaction', {
          body: {
            action: 'create',
            householdId: household.id,
            type,
            flowType,
            description: formDescription,
            amountClp: parseInt(formAmount, 10),
            categoryId,
            goalId,
            occurredOn: formDate,
            paidByMemberId: formPaidBy,
            scope: formScope,
            expenseType: flowType === 'pago_obligatorio' ? 'fixed' : 'variable',
            affectsHouseholdBalance,
            notes: formNotes || null,
          },
        });

        if (error) throw error;
        if (mode === 'income') {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', household.id)
            .eq('type', 'income')
            .is('deleted_at', null);

          if (count === 1) {
            trackEvent('first_income_created', {
              household_id: household.id,
              occurred_on: formDate,
            });
          }
        }

        if ((mode === 'expenses' || mode === 'legacy') && formScope === 'shared') {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', household.id)
            .eq('type', 'expense')
            .eq('scope', 'shared')
            .is('deleted_at', null);

          if (count === 1) {
            trackEvent('first_shared_expense_created', {
              household_id: household.id,
              occurred_on: formDate,
            });
          }
        }

        setMessageType('success');
        setMessage(mode === 'income' ? 'Ingreso registrado correctamente.' : mode === 'savings' ? 'Ahorro registrado correctamente.' : 'Gasto registrado correctamente.');
      }

      setShowForm(false);
      await loadData();
    } catch (error) {
      setMessageType('danger');
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTransactionId) return;

    try {
      const { error } = await supabase.functions.invoke('manage-transaction', {
        body: { action: 'delete', transactionId: deletingTransactionId },
      });

      if (error) throw error;
      setDeletingTransactionId(null);
      setMessageType('success');
      setMessage('Movimiento eliminado correctamente.');
      await loadData();
    } catch (error) {
      setMessageType('danger');
      setMessage(error instanceof Error ? error.message : 'No pudimos eliminar el movimiento.');
    }
  }

  const pageTitle = mode === 'legacy' ? MODULES.expenses.title : moduleConfig.title;
  const pageDescription = mode === 'legacy' ? MODULES.expenses.description : moduleConfig.description;
  const pageEyebrow = mode === 'legacy' ? MODULES.expenses.eyebrow : moduleConfig.eyebrow;
  const createLabel = mode === 'legacy' ? MODULES.expenses.createLabel : moduleConfig.createLabel;
  const monthLabel = (() => {
    const [selectedYear, selectedMonth] = currentMonth.split('-').map(Number);
    return formatMonthYear(selectedYear, selectedMonth);
  })();

  return (
    <div className="app-page max-w-6xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">{pageEyebrow}</p>
            <h1 className="mt-3 text-[clamp(1.85rem,2.5vw,2.45rem)] font-semibold tracking-[-0.04em] text-text">
              {pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{pageDescription}</p>
          </div>

          {canWrite ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateForm}>
              {createLabel}
            </Button>
          ) : null}
        </div>
      </section>

      {message ? <AlertBanner type={messageType} message={message} onClose={() => setMessage('')} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard
          icon={mode === 'income' ? <TrendingUp className="h-4 w-4" /> : mode === 'savings' ? <PiggyBank className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label={summary.firstLabel}
          value={summary.firstValue}
          note={summary.firstNote}
        />
        <MetricCard
          icon={mode === 'income' ? <Wallet className="h-4 w-4" /> : mode === 'savings' ? <HandCoins className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
          label={summary.secondLabel}
          value={summary.secondValue}
          note={summary.secondNote}
        />
      </section>

      <Card padding="lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Mes visible</p>
            <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">{monthLabel}</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Cambia el mes para revisar cómo se comportó esa parte del hogar.
            </p>
          </div>

          <div className="w-full max-w-[240px]">
            <InputField label="Mes" type="month" value={currentMonth} onChange={(event) => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set('month', event.target.value);
              setSearchParams(nextParams, { replace: true });
            }} />
          </div>
        </div>
      </Card>

      <section className="ui-panel overflow-hidden">
        <div className="border-b border-border-light px-6 py-5 lg:px-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Registros del mes</p>
          <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">{monthLabel}</h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            {loading ? 'Cargando lectura del mes...' : filteredTransactions.length === 0 ? 'Todavía no hay registros en esta sección.' : `${filteredTransactions.length} registro(s) visibles.`}
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-text-muted">Cargando movimientos...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="px-5 py-6 sm:px-6 lg:px-7">
            <EmptyState
              icon={mode === 'income' ? <TrendingUp className="h-8 w-8" /> : mode === 'savings' ? <PiggyBank className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
              eyebrow={pageEyebrow}
              title={mode === 'legacy' ? MODULES.expenses.emptyTitle : moduleConfig.emptyTitle}
              description={mode === 'legacy' ? MODULES.expenses.emptyDescription : moduleConfig.emptyDescription}
              action={canWrite ? { label: createLabel, onClick: openCreateForm } : undefined}
            />
          </div>
        ) : (
          <div className="space-y-3 p-4 md:p-6">
            {filteredTransactions.map((transaction) => (
              <MovementCard
                key={transaction.id}
                transaction={transaction}
                flowType={getTransactionFlowType(transaction, categories)}
                categoryName={categories.find((category) => category.id === transaction.category_id)?.name ?? 'Sin categoría'}
                goalName={goals.find((goal) => goal.id === transaction.goal_id)?.name ?? null}
                memberName={members.find((member) => member.id === transaction.paid_by_member_id)?.display_name ?? 'Persona del hogar'}
                onEdit={canWrite ? () => openEditForm(transaction) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingTransaction ? `Editar ${pageEyebrow.toLowerCase()}` : createLabel}
        size="lg"
      >
        <div className="space-y-5">
          <p className="text-sm leading-7 text-text-muted">
            Registra solo lo necesario para que el hogar se entienda rápido.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label={mode === 'income' ? 'Origen o concepto' : mode === 'savings' ? 'Nombre del ahorro' : 'Descripción'}
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              placeholder={mode === 'income' ? 'Ej: Sueldo abril' : mode === 'savings' ? 'Ej: Fondo de emergencia' : 'Ej: Supermercado de la semana'}
            />
            <InputField
              label="Monto (CLP)"
              type="number"
              value={formAmount}
              onChange={(event) => setFormAmount(event.target.value)}
              placeholder="Ej: 45000"
            />
            <InputField label="Fecha" type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} />
            <SelectField
              label={mode === 'income' ? 'Quién registra el ingreso' : 'Pagó'}
              value={formPaidBy}
              onChange={setFormPaidBy}
              options={members.map((member) => ({ value: member.id, label: member.display_name }))}
            />
          </div>

          {mode === 'expenses' || mode === 'legacy' ? (
            <div className="space-y-4">
              <AlertBanner
                type="info"
                message="Si este gasto lo pagó una persona y correspondía a ambos, déjalo como gasto entre ambos y cuenta para Saldo Hogar."
              />
              <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo de gasto"
                value={formFlowType}
                onChange={(value) => setFormFlowType(value as MovementFlowType)}
                options={EXPENSE_FLOW_OPTIONS}
              />
              <SelectField
                label="Categoría"
                value={formCategoryId}
                onChange={setFormCategoryId}
                options={[
                  { value: '', label: 'Sin categoría' },
                  ...categories.map((category) => ({ value: category.id, label: `${category.icon} ${category.name}` })),
                ]}
              />
              <SelectField
                label="Corresponde a"
                value={formScope}
                onChange={(value) => setFormScope(value as 'personal' | 'shared')}
                options={[
                  { value: 'shared', label: 'Entre ambos' },
                  { value: 'personal', label: 'Solo mío' },
                ]}
              />
              <SelectField
                label="¿Debe aparecer en Saldo Hogar?"
                value={formAffectsBalance ? 'yes' : 'no'}
                onChange={(value) => setFormAffectsBalance(value === 'yes')}
                options={[
                  { value: 'yes', label: 'Sí, una persona adelantó algo por ambos' },
                  { value: 'no', label: 'No, no debe contar en el saldo' },
                ]}
              />
              </div>
            </div>
          ) : null}

          {mode === 'income' ? (
            <SelectField
              label="Lectura del ingreso"
              value={formScope}
              onChange={(value) => setFormScope(value as 'personal' | 'shared')}
              options={[
                { value: 'personal', label: 'Ingreso personal' },
                { value: 'shared', label: 'Disponible para el hogar' },
              ]}
            />
          ) : null}

          {mode === 'savings' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Asociar a meta"
                value={formGoalId}
                onChange={setFormGoalId}
                options={[
                  { value: '', label: 'Ahorro libre' },
                  ...goals.filter((goal) => goal.status === 'active').map((goal) => ({ value: goal.id, label: goal.name })),
                ]}
              />
              <SelectField
                label="Lectura"
                value={formScope}
                onChange={(value) => setFormScope(value as 'personal' | 'shared')}
                options={[
                  { value: 'personal', label: 'Ahorro personal' },
                  { value: 'shared', label: 'Meta del hogar' },
                ]}
              />
            </div>
          ) : null}

          <InputField
            label="Nota opcional"
            value={formNotes}
            onChange={(event) => setFormNotes(event.target.value)}
            placeholder={mode === 'savings' ? 'Ej: Lo separamos al recibir el sueldo' : 'Ej: Lo pagué desde la cuenta conjunta'}
          />

          <div className="flex flex-col gap-4 border-t border-border-light pt-5">
            {editingTransaction ? (
              <div className="flex justify-start">
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-danger hover:border-danger/10 hover:bg-danger-bg hover:text-danger"
                  onClick={() => {
                    closeForm();
                    setDeletingTransactionId(editingTransaction.id);
                  }}
                >
                  Eliminar registro
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingTransaction ? 'Guardar cambios' : createLabel}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingTransactionId}
        onClose={() => setDeletingTransactionId(null)}
        onConfirm={handleDelete}
        title="Eliminar registro"
        message="Este movimiento dejará de contar en la lectura del hogar."
        confirmLabel="Eliminar"
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] text-text">{value}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{note}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MovementCard({
  transaction,
  flowType,
  categoryName,
  goalName,
  memberName,
  onEdit,
}: {
  transaction: Transaction;
  flowType: MovementFlowType;
  categoryName: string;
  goalName: string | null;
  memberName: string;
  onEdit?: () => void;
}) {
  return (
    <div className="ui-panel overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-text">{transaction.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <InlineChip tone={transaction.type === 'income' ? 'success' : 'primary'}>
              {FLOW_TYPE_LABELS[flowType]}
            </InlineChip>
            <InlineChip tone="muted">{transaction.scope === 'shared' ? 'Entre ambos' : 'Solo mío'}</InlineChip>
            {transaction.type === 'expense' && transaction.scope === 'shared' ? (
              <InlineChip tone={transaction.affects_household_balance ? 'success' : 'muted'}>
                {transaction.affects_household_balance ? 'Cuenta para el saldo' : 'No cuenta para el saldo'}
              </InlineChip>
            ) : null}
          </div>
        </div>
        {onEdit ? (
          <Button size="sm" variant="ghost" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={onEdit}>
            Editar
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailCard label="Monto" value={`${transaction.type === 'income' ? '+' : '-'}${formatCLP(transaction.amount_clp)}`} />
        <DetailCard label="Fecha" value={formatDate(transaction.occurred_on)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <DetailCard label={goalName ? 'Meta' : 'Categoría'} value={goalName || categoryName} icon={goalName ? <PiggyBank className="h-3.5 w-3.5" /> : <ReceiptText className="h-3.5 w-3.5" />} />
        <DetailCard label="Quién lo registró" value={memberName} icon={<Wallet className="h-3.5 w-3.5" />} />
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg/65 px-4 py-3">
      <p className="text-xs font-medium text-text-light">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {icon ? <span className="text-text-light">{icon}</span> : null}
        <p className="text-sm font-medium leading-6 text-text">{value}</p>
      </div>
    </div>
  );
}

function InlineChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'success' | 'muted';
}) {
  const classes =
    tone === 'primary'
      ? 'bg-primary/8 text-primary'
      : tone === 'success'
        ? 'bg-success-bg text-success'
        : 'bg-surface-low text-text-muted';

  return (
    <span className={`inline-flex min-h-8 items-center rounded-full px-3.5 py-1 text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, SelectField, Modal, EmptyState, FeatureGate, AlertBanner, ConfirmDialog } from '../../components/ui';
import { RegisterPaymentModal } from '../../components/payments/RegisterPaymentModal';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { formatCLP } from '../../utils/format-clp';
import { getCurrentMonthYear, getMonthRange, formatDate } from '../../utils/dates-chile';
import type { Category, PaymentCalendarItem, RecurringTransaction, Transaction } from '../../types/database';
import { CheckCircle, CheckCircle2, Clock, Plus, Repeat, TrendingUp, AlertTriangle } from 'lucide-react';

type RecurringTransactionType = 'expense' | 'income';

function getCurrentChileDay() {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(new Date());
  return Number.parseInt(parts.find((part) => part.type === 'day')?.value || '1', 10);
}

function sortRecurringItems(left: RecurringTransaction, right: RecurringTransaction) {
  const byDay = left.day_of_month - right.day_of_month;
  if (byDay !== 0) return byDay;
  return left.description.localeCompare(right.description, 'es-CL');
}

export function RecurringPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
  const navigate = useNavigate();
  const { year, month } = getCurrentMonthYear();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthPayments, setMonthPayments] = useState<PaymentCalendarItem[]>([]);
  const [monthIncomeTransactions, setMonthIncomeTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [payingItem, setPayingItem] = useState<PaymentCalendarItem | null>(null);
  const [undoingItem, setUndoingItem] = useState<PaymentCalendarItem | null>(null);
  const [toggleItem, setToggleItem] = useState<RecurringTransaction | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringTransaction | null>(null);
  const [transactionType, setTransactionType] = useState<RecurringTransactionType>('expense');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState('');
  const [day, setDay] = useState('1');
  const [scope, setScope] = useState<'shared' | 'personal'>('shared');
  const [paidBy, setPaidBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');

  const currentChileDay = getCurrentChileDay();
  const { end } = getMonthRange(year, month);
  const daysInMonth = Number.parseInt(end.split('-')[2] || '31', 10);

  const load = useCallback(async () => {
    if (!household) return;

    await syncRecurringItems(household.id).catch(() => null);

    const { start, end: monthEnd } = getMonthRange(year, month);
    const [itemsResult, categoriesResult, paymentsResult, incomeTransactionsResult] = await Promise.all([
      supabase
        .from('recurring_transactions')
        .select('*')
        .eq('household_id', household.id),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null),
      supabase
        .from('payment_calendar_items')
        .select('*')
        .eq('household_id', household.id)
        .gte('due_date', start)
        .lte('due_date', monthEnd)
        .not('recurring_source_id', 'is', null),
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', household.id)
        .eq('type', 'income')
        .eq('is_recurring_instance', true)
        .gte('occurred_on', start)
        .lte('occurred_on', monthEnd)
        .not('recurring_source_id', 'is', null)
        .is('deleted_at', null),
    ]);

    setItems((itemsResult.data || []) as RecurringTransaction[]);
    setCategories((categoriesResult.data || []) as Category[]);
    setMonthPayments((paymentsResult.data || []) as PaymentCalendarItem[]);
    setMonthIncomeTransactions((incomeTransactionsResult.data || []) as Transaction[]);
  }, [household, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (currentMember) {
      setPaidBy(currentMember.id);
    }
  }, [currentMember]);

  const incomeItems = useMemo(
    () => items
      .filter((item) => (item.transaction_type ?? 'expense') === 'income')
      .sort(sortRecurringItems),
    [items],
  );

  const expenseItems = useMemo(
    () => items
      .filter((item) => (item.transaction_type ?? 'expense') !== 'income')
      .sort(sortRecurringItems),
    [items],
  );

  function resetForm() {
    setEditingItem(null);
    setTransactionType('expense');
    setDesc('');
    setAmount('');
    setCatId('');
    setDay('1');
    setScope('shared');
    setPaidBy(currentMember?.id || '');
  }

  function openCreateModal() {
    resetForm();
    setShowForm(true);
  }

  function openEditModal(item: RecurringTransaction) {
    const nextTransactionType = item.transaction_type ?? 'expense';

    setEditingItem(item);
    setTransactionType(nextTransactionType);
    setDesc(item.description);
    setAmount(String(item.amount_clp));
    setCatId(item.category_id || '');
    setDay(String(item.day_of_month));
    setScope(nextTransactionType === 'income' ? 'personal' : item.scope);
    setPaidBy(item.paid_by_member_id);
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    resetForm();
  }

  function handleTransactionTypeChange(value: string) {
    const nextTransactionType: RecurringTransactionType = value === 'income' ? 'income' : 'expense';
    setTransactionType(nextTransactionType);

    if (nextTransactionType === 'income') {
      setScope('personal');
      setCatId('');
      return;
    }

    if (!editingItem || (editingItem.transaction_type ?? 'expense') !== 'expense') {
      setScope('shared');
    }
  }

  async function handleSave() {
    if (!household || !currentMember) return;

    if (!desc.trim() || !amount || !day || !paidBy) {
      setMsgType('danger');
      setMsg('Completa descripción, monto, día y la persona a la que pertenece la recurrencia.');
      return;
    }

    setSaving(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-recurring-transaction', {
        body: editingItem
          ? {
              action: 'update',
              recurringId: editingItem.id,
              transactionType,
              description: desc,
              amountClp: parseInt(amount, 10),
              categoryId: transactionType === 'expense' ? catId || null : null,
              dayOfMonth: parseInt(day, 10),
              scope: transactionType === 'income' ? 'personal' : scope,
              paidByMemberId: paidBy,
            }
          : {
              action: 'create',
              householdId: household.id,
              transactionType,
              description: desc,
              amountClp: parseInt(amount, 10),
              categoryId: transactionType === 'expense' ? catId || null : null,
              dayOfMonth: parseInt(day, 10),
              scope: transactionType === 'income' ? 'personal' : scope,
              paidByMemberId: paidBy,
            },
      });

      if (error) throw error;

      await syncRecurringItems(household.id).catch(() => null);
      setMsgType('success');
      if (editingItem) {
        setMsg(transactionType === 'income' ? 'Ingreso fijo actualizado correctamente.' : 'Recurrencia actualizada correctamente.');
      } else {
        setMsg(transactionType === 'income' ? 'Ingreso fijo creado correctamente.' : 'Recurrencia creada correctamente.');
      }
      closeForm();
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos guardar la recurrencia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUndoPayment() {
    if (!undoingItem) return;

    setSaving(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('pay-calendar-item', {
        body: {
          action: 'undo',
          itemId: undoingItem.id,
        },
      });

      if (error) throw error;

      setMsgType('success');
      setMsg('Pago revertido. La recurrencia volvió a quedar pendiente este mes.');
      setUndoingItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos revertir el pago.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleRecurring() {
    if (!toggleItem || !household) return;

    setSaving(true);
    setMsg('');

    try {
      const nextIsActive = !toggleItem.is_active;
      const { error } = await supabase.functions.invoke('manage-recurring-transaction', {
        body: {
          action: 'toggle',
          recurringId: toggleItem.id,
          isActive: nextIsActive,
        },
      });

      if (error) throw error;

      await syncRecurringItems(household.id).catch(() => null);
      setMsgType('success');
      if ((toggleItem.transaction_type ?? 'expense') === 'income') {
        setMsg(nextIsActive
          ? 'Ingreso fijo reactivado. Volverá a registrarse automáticamente cuando corresponda.'
          : 'Ingreso fijo desactivado. No volverá a registrarse en los próximos meses.');
      } else {
        setMsg(nextIsActive
          ? 'Recurrencia reactivada. Volverá a generar pagos automáticamente.'
          : 'Recurrencia desactivada. No generará nuevos pagos en los próximos meses.');
      }
      setToggleItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos cambiar el estado de la recurrencia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecurring() {
    if (!deletingItem || !household) return;

    setSaving(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-recurring-transaction', {
        body: {
          action: 'delete',
          recurringId: deletingItem.id,
        },
      });

      if (error) throw error;

      await syncRecurringItems(household.id).catch(() => null);
      setMsgType('success');
      setMsg((deletingItem.transaction_type ?? 'expense') === 'income'
        ? 'Ingreso fijo eliminado correctamente.'
        : 'Recurrencia eliminada correctamente.');
      setDeletingItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos eliminar la recurrencia.');
    } finally {
      setSaving(false);
    }
  }

  const getCatName = (id: string | null) => categories.find((category) => category.id === id)?.name || '—';
  const getMemberName = (id: string) => members.find((member) => member.id === id)?.display_name || '—';
  const getMonthPayment = (recurringId: string) => monthPayments.find((item) => item.recurring_source_id === recurringId) || null;
  const getMonthIncomeInstance = (recurringId: string) => monthIncomeTransactions.find((transaction) => transaction.recurring_source_id === recurringId) || null;

  const paymentBadge = {
    pending: 'badge-warning',
    paid: 'badge-success',
    overdue: 'badge-danger',
  } as const;
  const paymentIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
    paid: <CheckCircle className="h-3.5 w-3.5 text-success" aria-hidden="true" />,
    overdue: <AlertTriangle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
  } as const;
  const paymentLabel = {
    pending: 'Pendiente',
    paid: 'Pagado',
    overdue: 'Vencido',
  } as const;

  function renderIncomeStatus(item: RecurringTransaction) {
    const monthInstance = getMonthIncomeInstance(item.id);
    const creditDay = Math.min(item.day_of_month, daysInMonth);

    if (monthInstance) {
      return (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 text-text">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            <span className="badge badge-success">Registrado este mes</span>
          </span>
          <span className="text-text-secondary">Acreditado el {formatDate(monthInstance.occurred_on)}</span>
        </div>
      );
    }

    const waitingLabel = currentChileDay < creditDay
      ? `Se registrará el día ${creditDay}`
      : `Pendiente de registro desde el día ${creditDay}`;

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-2 text-text">
          <Clock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
          <span className="badge badge-warning">{waitingLabel}</span>
        </span>
        <span className="text-text-secondary">
          {item.day_of_month > daysInMonth
            ? `Este mes se acreditará el día ${creditDay} porque el mes no tiene ${item.day_of_month}.`
            : 'Se registrará automáticamente cuando llegue la fecha indicada.'}
        </span>
      </div>
    );
  }

  function renderIncomeCard(item: RecurringTransaction) {
    return (
      <Card key={item.id} padding="md" className="overflow-hidden">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-success">Ingreso fijo</span>
                <p className="text-lg font-semibold tracking-tight text-text">{item.description}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Mensual · Día {item.day_of_month} · {getMemberName(item.paid_by_member_id)}
              </p>
              {renderIncomeStatus(item)}
            </div>

            <div className="shrink-0">
              <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                {item.is_active ? 'Activo' : 'Pausado'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1 lg:flex-1">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {canWrite ? (
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => openEditModal(item)}>
                    Editar
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setToggleItem(item)}>
                    {item.is_active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full border-danger/15 text-danger hover:border-danger/20 hover:bg-danger-bg hover:text-danger sm:w-auto"
                    onClick={() => setDeletingItem(item)}
                  >
                    Eliminar regla
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="order-1 rounded-2xl border border-border bg-surface-low px-4 py-3 lg:order-2 lg:min-w-[182px] lg:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Monto mensual fijo</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{formatCLP(item.amount_clp)}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function renderExpenseCard(item: RecurringTransaction) {
    const monthPayment = getMonthPayment(item.id);

    return (
      <Card key={item.id} padding="md" className="overflow-hidden">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold tracking-tight text-text">{item.description}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Mensual · Día {item.day_of_month} · {getCatName(item.category_id)} · {getMemberName(item.paid_by_member_id)}
              </p>
              {monthPayment ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex shrink-0 items-center gap-2 text-text">
                    {paymentIcon[monthPayment.status]}
                    <span className={`badge ${paymentBadge[monthPayment.status]}`}>
                      {paymentLabel[monthPayment.status]}
                    </span>
                  </span>
                  <span className="text-text-secondary">
                    Pago de este mes: {formatDate(monthPayment.due_date)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="shrink-0">
              <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                {item.is_active ? 'Activa' : 'Pausada'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-1 lg:flex-1">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {canWrite ? (
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => openEditModal(item)}>
                    Editar
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setToggleItem(item)}>
                    {item.is_active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full border-danger/15 text-danger hover:border-danger/20 hover:bg-danger-bg hover:text-danger sm:w-auto"
                    onClick={() => setDeletingItem(item)}
                  >
                    Eliminar regla
                  </Button>
                ) : null}
                {item.is_active && monthPayment && monthPayment.status !== 'paid' && canWrite ? (
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => setPayingItem(monthPayment)}>
                    Marcar pagado
                  </Button>
                ) : null}
                {item.is_active && monthPayment?.status === 'paid' && monthPayment.paid_transaction_id && canWrite ? (
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setUndoingItem(monthPayment)}>
                    Deshacer pago
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="order-1 rounded-2xl border border-border bg-surface-low px-4 py-3 lg:order-2 lg:min-w-[182px] lg:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Monto mensual</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{formatCLP(item.amount_clp)}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <FeatureGate feature="recurring_transactions">
      <div className="app-page max-w-6xl">
        <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="recurring-title">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Recurrencias</p>
              <h1 id="recurring-title" className="mt-3 text-[clamp(1.85rem,2.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-text">
                Ingresos fijos y pagos que se repiten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
                Define aquí lo que ocurre todos los meses. Los ingresos fijos se acreditan solos cuando llega la fecha y los pagos recurrentes siguen su flujo actual.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate('/app/resumen')}>
                Ver resumen
              </Button>
              {canWrite ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
                  Nueva recurrencia
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {msg ? (
          <div className="mb-6">
            <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mb-6">
            <AlertBanner
              type="info"
              message="Desactivar pausa la recurrencia y evita nuevos registros futuros. Eliminar regla borra la recurrencia por completo; los movimientos ya generados quedan como historial."
            />
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-8 w-8" />}
            eyebrow="Continuidad del hogar"
            title="Aún no hay recurrencias activas"
            description="Crea aquí lo que se repite cada mes, ya sea un pago fijo o un ingreso que siempre llega en la misma fecha."
            secondaryText="Usa Movimientos para ingresos y gastos puntuales. Aquí solo vive lo que se repite mes a mes."
            action={canWrite ? { label: 'Crear recurrencia', onClick: openCreateModal } : undefined}
          />
        ) : (
          <div className="space-y-8">
            <section className="space-y-3" aria-labelledby="fixed-income-title">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-success" aria-hidden="true" />
                <div>
                  <h2 id="fixed-income-title" className="text-[1.35rem] font-semibold tracking-[-0.03em] text-text">
                    Ingresos fijos
                  </h2>
                  <p className="text-sm leading-6 text-text-muted">
                    Sueldo, arriendo recibido, pensión o cualquier ingreso que entra una vez al mes.
                  </p>
                </div>
              </div>

              {incomeItems.length === 0 ? (
                <Card padding="md">
                  <p className="text-sm leading-7 text-text-muted">
                    Aún no hay ingresos fijos definidos. Si siempre entra un monto en una fecha parecida, créalo aquí y se registrará solo cuando corresponda.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {incomeItems.map(renderIncomeCard)}
                </div>
              )}
            </section>

            <section className="space-y-3" aria-labelledby="expense-recurring-title">
              <div>
                <h2 id="expense-recurring-title" className="text-[1.35rem] font-semibold tracking-[-0.03em] text-text">
                  Gastos y pagos recurrentes
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Cuentas que se repiten y que luego puedes marcar como pagadas cuando corresponda.
                </p>
              </div>

              {expenseItems.length === 0 ? (
                <Card padding="md">
                  <p className="text-sm leading-7 text-text-muted">
                    Aún no hay pagos recurrentes. Aquí conviene dejar visibles las cuentas que no se pueden pasar cada mes.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {expenseItems.map(renderExpenseCard)}
                </div>
              )}
            </section>
          </div>
        )}

        <Modal
          open={showForm}
          onClose={closeForm}
          title={editingItem
            ? transactionType === 'income' ? 'Editar ingreso fijo' : 'Editar recurrencia'
            : transactionType === 'income' ? 'Nuevo ingreso fijo' : 'Nueva recurrencia'}
          size="md"
        >
          <div className="space-y-4">
            <SelectField
              label="¿Qué quieres repetir cada mes?"
              value={transactionType}
              onChange={handleTransactionTypeChange}
              options={[
                { value: 'expense', label: 'Gasto o pago recurrente' },
                { value: 'income', label: 'Ingreso fijo' },
              ]}
            />

            <InputField
              label={transactionType === 'income' ? 'Nombre del ingreso' : 'Descripción'}
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              placeholder={transactionType === 'income' ? 'Ej: Sueldo' : 'Ej: Arriendo'}
            />

            <InputField
              label={transactionType === 'income' ? 'Monto mensual fijo' : 'Monto mensual (CLP)'}
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />

            <InputField
              label={transactionType === 'income' ? 'Día en que se acredita' : 'Día del mes'}
              type="number"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />

            <p className="text-xs leading-6 text-text-muted">
              Si un mes no tiene ese día, usaremos el último día válido del mes.
            </p>

            {transactionType === 'income' ? (
              <AlertBanner
                type="info"
                message="Este ingreso se registrará automáticamente cada mes desde el día indicado."
              />
            ) : (
              <AlertBanner
                type="info"
                message="Los pagos recurrentes siguen apareciendo como cuentas del mes. Desde aquí no se marcan como pagados: eso ocurre cuando registras el pago real."
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {transactionType === 'expense' ? (
                <SelectField
                  label="Categoría"
                  value={catId}
                  onChange={setCatId}
                  options={categories.map((category) => ({ value: category.id, label: `${category.icon} ${category.name}` }))}
                  placeholder="Seleccionar"
                />
              ) : null}

              {(transactionType === 'expense' || members.length > 1) ? (
                <SelectField
                  label={transactionType === 'income' ? '¿A quién pertenece este ingreso?' : 'Pagado por'}
                  value={paidBy}
                  onChange={setPaidBy}
                  options={members.map((member) => ({ value: member.id, label: member.display_name }))}
                />
              ) : null}

              {transactionType === 'expense' ? (
                <SelectField
                  label="Alcance"
                  value={scope}
                  onChange={(value) => setScope(value as 'shared' | 'personal')}
                  options={[
                    { value: 'shared', label: 'Compartido' },
                    { value: 'personal', label: 'Personal' },
                  ]}
                />
              ) : null}
            </div>

            {transactionType === 'expense' ? (
              <p className="text-xs leading-6 text-text-muted">
                Los pagos recurrentes siguen su flujo normal del hogar. Los ingresos fijos nunca aparecen como cuentas por pagar ni afectan Saldo Hogar.
              </p>
            ) : (
              <p className="text-xs leading-6 text-text-muted">
                El ingreso se registra como ingreso personal acreditado. No aparece como deuda, no pasa por pagos y no afecta Saldo Hogar.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>
                {editingItem ? 'Guardar cambios' : transactionType === 'income' ? 'Crear ingreso fijo' : 'Crear recurrencia'}
              </Button>
            </div>
          </div>
        </Modal>

        <RegisterPaymentModal
          open={!!payingItem}
          item={payingItem}
          members={members}
          categories={categories}
          defaultPaidBy={currentMember?.id || members[0]?.id || ''}
          onClose={() => setPayingItem(null)}
          onSaved={async (message) => {
            setMsgType('success');
            setMsg(message);
            await load();
          }}
        />

        <ConfirmDialog
          open={!!undoingItem}
          onClose={() => !saving && setUndoingItem(null)}
          onConfirm={handleUndoPayment}
          title="Deshacer pago"
          message="Esto quitará el gasto generado para esta recurrencia y el pago del mes volverá a quedar abierto."
          confirmLabel="Deshacer pago"
        />

        <ConfirmDialog
          open={!!toggleItem}
          onClose={() => !saving && setToggleItem(null)}
          onConfirm={handleToggleRecurring}
          title={toggleItem?.is_active ? 'Desactivar recurrencia' : 'Reactivar recurrencia'}
          message={toggleItem?.is_active
            ? (toggleItem.transaction_type ?? 'expense') === 'income'
              ? 'La regla seguirá existiendo, pero dejará de registrar este ingreso en los próximos meses.'
              : 'La regla seguirá existiendo, pero dejará de generar nuevos pagos en los próximos meses. El pago ya creado para este mes se mantendrá.'
            : (toggleItem?.transaction_type ?? 'expense') === 'income'
              ? 'El ingreso fijo volverá a registrarse automáticamente cuando llegue la fecha indicada.'
              : 'La recurrencia volverá a generar pagos automáticos. Si corresponde, se recreará el pago del mes actual.'}
          confirmLabel={toggleItem?.is_active ? 'Desactivar' : 'Reactivar'}
        />

        <ConfirmDialog
          open={!!deletingItem}
          onClose={() => !saving && setDeletingItem(null)}
          onConfirm={handleDeleteRecurring}
          title={(deletingItem?.transaction_type ?? 'expense') === 'income' ? 'Eliminar ingreso fijo' : 'Eliminar recurrencia'}
          message={(deletingItem?.transaction_type ?? 'expense') === 'income'
            ? 'La regla se borrará de forma permanente. Los ingresos ya registrados este mes quedarán como historial.'
            : 'La regla se borrará de forma permanente y también se quitará cualquier pago pendiente generado por ella este mes. Los pagos ya registrados quedarán como historial.'}
          confirmLabel="Eliminar regla"
        />
      </div>
    </FeatureGate>
  );
}

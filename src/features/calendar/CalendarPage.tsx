import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  UpgradePromptCard,
} from '../../components/ui';
import { RegisterPaymentModal } from '../../components/payments/RegisterPaymentModal';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import type { Category, PaymentCalendarItem } from '../../types/database';
import { getFeatureUpgradeCopy } from '../../lib/constants';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle,
  Clock,
  PencilLine,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react';

export function CalendarPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite, hasFeature } = useSubscription();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { year, month } = getCurrentMonthYear();
  const statusFilter = searchParams.get('status');
  const [items, setItems] = useState<PaymentCalendarItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentCalendarItem | null>(null);
  const [payingItem, setPayingItem] = useState<PaymentCalendarItem | null>(null);
  const [undoingItem, setUndoingItem] = useState<PaymentCalendarItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<PaymentCalendarItem | null>(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');
  const canManageCalendar = canWrite && hasFeature('calendar_full');
  const canUseCustomCategories = hasFeature('categories_custom');
  const canSyncRecurring = hasFeature('recurring_transactions');
  const calendarUpgrade = getFeatureUpgradeCopy('calendar_full');
  const availableCategories = categories.filter((category) => canUseCustomCategories || category.is_default || category.id === categoryId);

  const load = useCallback(async () => {
    if (!household) return;
    if (canSyncRecurring) {
      await syncRecurringItems(household.id).catch(() => null);
    }
    const { start, end } = getMonthRange(year, month);
    const [itemsRes, categoriesRes] = await Promise.all([
      supabase
        .from('payment_calendar_items')
        .select('*')
        .eq('household_id', household.id)
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date'),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
    ]);

    setItems((itemsRes.data || []) as PaymentCalendarItem[]);
    setCategories((categoriesRes.data || []) as Category[]);
  }, [canSyncRecurring, household, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetCreateForm() {
    setDesc('');
    setAmount('');
    setDueDate('');
    setCategoryId('');
    setEditingItem(null);
  }

  function closeCreateModal() {
    if (saving) return;
    setShowForm(false);
    resetCreateForm();
  }

  function openCreateModal() {
    resetCreateForm();
    setShowForm(true);
  }

  function openEditModal(item: PaymentCalendarItem) {
    setEditingItem(item);
    setDesc(item.description);
    setAmount(String(item.amount_clp));
    setDueDate(item.due_date);
    setCategoryId(item.category_id || '');
    setShowForm(true);
  }

  function openUndoPaymentConfirm(item: PaymentCalendarItem) {
    if (saving) return;
    setShowForm(false);
    setUndoingItem(item);
  }

  function openDeleteItemConfirm(item: PaymentCalendarItem) {
    if (saving) return;
    setShowForm(false);
    setDeletingItem(item);
  }

  function openPayModal(item: PaymentCalendarItem) {
    setPayingItem(item);
  }

  function closePayModal() {
    if (saving) return;
    setPayingItem(null);
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
      setMsg('Pago revertido. El vencimiento volvió a quedar abierto.');
      setUndoingItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos revertir el pago.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem() {
    if (!deletingItem) return;
    setSaving(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-calendar-item', {
        body: {
          action: 'delete',
          itemId: deletingItem.id,
        },
      });

      if (error) throw error;
      setMsgType('success');
      setMsg('Pago programado eliminado correctamente.');
      setDeletingItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos eliminar el pago programado.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    setMsg('');

    try {
      if (editingItem) {
        const { error } = await supabase.functions.invoke('manage-calendar-item', {
          body: {
            action: 'update',
            itemId: editingItem.id,
            description: desc,
            amountClp: parseInt(amount, 10),
            dueDate,
            categoryId: categoryId || null,
          },
        });

        if (error) throw error;
        setMsgType('success');
        setMsg('Pago programado actualizado correctamente.');
      } else {
        const { error } = await supabase.functions.invoke('manage-calendar-item', {
          body: {
            action: 'create',
            householdId: household.id,
            description: desc,
            amountClp: parseInt(amount, 10),
            dueDate,
            categoryId: categoryId || null,
          },
        });
        if (error) throw error;

        setMsgType('success');
        setMsg('Pago programado creado correctamente.');
      }
      closeCreateModal();
      await load();
    } catch {
      setMsgType('danger');
      setMsg(editingItem ? 'No pudimos actualizar el pago programado.' : 'No pudimos crear el pago programado.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const itemId = searchParams.get('itemId');
    const mode = searchParams.get('mode');

    if (!itemId || mode !== 'edit' || !items.length) return;

    const item = items.find((entry) => entry.id === itemId);
    if (!item || !canWrite) return;

    openEditModal(item);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('itemId');
    nextParams.delete('mode');
    setSearchParams(nextParams, { replace: true });
  }, [canWrite, items, searchParams, setSearchParams]);

  const visibleItems =
    statusFilter === 'pending' || statusFilter === 'overdue'
      ? items.filter((item) => item.status === statusFilter)
      : items;

  const openItems = items.filter((item) => item.status === 'pending' || item.status === 'overdue');
  const overdueItems = items.filter((item) => item.status === 'overdue');
  const paidItems = items.filter((item) => item.status === 'paid');
  const openAmount = openItems.reduce((sum, item) => sum + item.amount_clp, 0);
  const overdueAmount = overdueItems.reduce((sum, item) => sum + item.amount_clp, 0);
  const paidAmount = paidItems.reduce((sum, item) => sum + item.amount_clp, 0);

  return (
    <div className="app-page max-w-6xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="calendar-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Calendario</p>
            <h1 id="calendar-title" className="mt-3 text-[clamp(1.85rem,2.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-text">
              Pagos del mes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Reúne vencimientos y pagos registrados para que nada importante quede solo en la memoria.
            </p>
          </div>

          {canManageCalendar ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
              Agregar pago
            </Button>
          ) : null}
        </div>
      </section>

      {!canManageCalendar ? (
        <UpgradePromptCard
          badge={calendarUpgrade.badge}
          title={calendarUpgrade.title}
          description={calendarUpgrade.description}
          highlights={calendarUpgrade.highlights}
          actionLabel={calendarUpgrade.actionLabel || 'Ver planes'}
          onAction={() => window.location.assign(calendarUpgrade.route)}
          compact
        />
      ) : null}

      {msg ? <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} /> : null}

      {statusFilter === 'pending' || statusFilter === 'overdue' ? (
        <AlertBanner
          type="info"
          message={statusFilter === 'overdue' ? 'Estás viendo solo pagos vencidos.' : 'Estás viendo solo pagos pendientes.'}
          action={{
            label: 'Ver todos',
            onClick: () => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('status');
              setSearchParams(nextParams, { replace: true });
            },
          }}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen del calendario">
        <CalendarSignal
          label="Pendientes"
          value={formatCLP(openAmount)}
          detail={openItems.length === 0 ? 'Sin pagos abiertos' : `${openItems.length} pago(s) abiertos`}
          tone="warning"
          icon={<Clock className="h-4 w-4" />}
        />
        <CalendarSignal
          label="Vencidos"
          value={formatCLP(overdueAmount)}
          detail={overdueItems.length === 0 ? 'Sin atrasos este mes' : `${overdueItems.length} pago(s) vencidos`}
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <CalendarSignal
          label="Pagados"
          value={formatCLP(paidAmount)}
          detail={paidItems.length === 0 ? 'Todavía no hay pagos cerrados' : `${paidItems.length} pago(s) registrados`}
          tone="success"
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </section>

      {visibleItems.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          eyebrow="Seguimiento del mes"
          title="Todavía no hay pagos programados en este período"
          description="Cuando registres vencimientos o pagos fijos, esta vista empezará a mostrar qué requiere atención antes de que se te pase."
          secondaryText="El calendario sirve para sacar pagos de la memoria y convertirlos en una referencia visible del mes."
          action={
            canManageCalendar
              ? { label: 'Agregar pago', onClick: openCreateModal }
              : { label: 'Ver planes', onClick: () => navigate('/app/suscripcion?feature=calendar_full') }
          }
        />
      ) : (
        <section className="ui-panel overflow-hidden" aria-labelledby="calendar-items-title">
          <div className="border-b border-border-light px-6 py-5 lg:px-7">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Listado</p>
            <h2 id="calendar-items-title" className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">
              {formatMonthYear(year, month)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              {visibleItems.length} pago(s) visibles para revisar o actualizar.
            </p>
          </div>

          <div className="space-y-3 p-4 sm:p-5 lg:p-6">
            {visibleItems.map((item) => (
              <CalendarItemCard
                key={item.id}
                item={item}
                canWrite={canWrite}
                onEdit={() => openEditModal(item)}
                onPay={() => openPayModal(item)}
              />
            ))}
          </div>
        </section>
      )}

      <Modal open={showForm} onClose={closeCreateModal} title={editingItem ? 'Editar pago programado' : 'Nuevo pago programado'} size="sm">
        <div className="space-y-5">
          <p className="text-sm leading-7 text-text-muted">
            Registra solo lo necesario para que el calendario funcione como una referencia clara del mes.
          </p>

          <InputField label="Descripción" value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="Ej: Arriendo" />
          <InputField label="Monto (CLP)" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <InputField label="Fecha de vencimiento" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <SelectField
            label="Categoría"
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: 'Sin categoría' },
              ...availableCategories.map((category) => ({ value: category.id, label: `${category.icon} ${category.name}` })),
            ]}
          />

          {editingItem?.status === 'paid' && editingItem.paid_transaction_id ? (
            <AlertBanner
              type="info"
              message="Este pago ya tiene un gasto registrado. Si fue un error o quedó duplicado, puedes deshacerlo desde aquí."
            />
          ) : null}

          {editingItem?.recurring_source_id ? (
            <AlertBanner
              type="info"
              message="Este pago viene de una recurrencia. Si quieres dejar de verlo en los próximos meses, gestiona esa recurrencia desde Recurrencias."
            />
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border-light pt-5">
            <div className="flex flex-wrap gap-3">
              {editingItem?.status === 'paid' && editingItem.paid_transaction_id && canManageCalendar ? (
                <Button variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => openUndoPaymentConfirm(editingItem)}>
                  Deshacer pago
                </Button>
              ) : null}
              {editingItem && !editingItem.recurring_source_id && canManageCalendar ? (
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-danger hover:border-danger/10 hover:bg-danger-bg hover:text-danger"
                  onClick={() => openDeleteItemConfirm(editingItem)}
                >
                  Eliminar pago
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeCreateModal}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingItem ? 'Guardar cambios' : 'Crear pago'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <RegisterPaymentModal
        open={!!payingItem}
        item={payingItem}
        members={members}
        categories={categories}
        defaultPaidBy={currentMember?.id || members[0]?.id || ''}
        onClose={closePayModal}
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
        message="Esto reabrirá el pago programado y eliminará el gasto enlazado de tus movimientos. Úsalo solo si quieres revertir ese registro."
        confirmLabel="Deshacer pago"
      />

      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => !saving && setDeletingItem(null)}
        onConfirm={handleDeleteItem}
        title="Eliminar pago programado"
        message={
          deletingItem?.paid_transaction_id
            ? 'Esto eliminará el pago programado y también quitará el gasto enlazado de tus movimientos.'
            : 'Esto eliminará el pago programado de tu calendario.'
        }
        confirmLabel="Eliminar pago"
      />
    </div>
  );
}

function CalendarSignal({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger';
  icon: ReactNode;
}) {
  const valueClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-danger';

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className={`mt-3 text-[1.8rem] font-semibold tracking-[-0.04em] ${valueClass}`}>{value}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function CalendarItemCard({
  item,
  canWrite,
  onEdit,
  onPay,
}: {
  item: PaymentCalendarItem;
  canWrite: boolean;
  onEdit: () => void;
  onPay: () => void;
}) {
  const statusMeta =
    item.status === 'paid'
      ? {
          label: 'Pagado',
          tone: 'success' as const,
          icon: <CheckCircle className="h-4 w-4" />,
        }
      : item.status === 'overdue'
        ? {
            label: 'Vencido',
            tone: 'danger' as const,
            icon: <AlertTriangle className="h-4 w-4" />,
          }
        : {
            label: 'Pendiente',
            tone: 'warning' as const,
            icon: <Clock className="h-4 w-4" />,
          };

  const badgeClass =
    statusMeta.tone === 'success'
      ? 'bg-success-bg text-success'
      : statusMeta.tone === 'danger'
        ? 'bg-danger-bg text-danger'
        : 'bg-warning-bg text-warning';

  return (
    <div className="ui-panel overflow-hidden p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${badgeClass}`}>
              {statusMeta.icon}
              {statusMeta.label}
            </span>
            {item.recurring_source_id ? (
              <span className="inline-flex min-h-8 items-center rounded-full bg-surface-low px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Recurrente
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-[1.25rem] font-semibold tracking-[-0.03em] text-text">{item.description}</h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <CalendarDetail label="Vence" value={formatDate(item.due_date)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
            <CalendarDetail label="Monto" value={formatCLP(item.amount_clp)} icon={<Wallet className="h-3.5 w-3.5" />} valueTone={statusMeta.tone === 'danger' ? 'danger' : 'neutral'} />
            <CalendarDetail label="Estado" value={statusMeta.label} icon={<Receipt className="h-3.5 w-3.5" />} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:w-[180px]">
          {item.status !== 'paid' && canWrite ? (
            <Button onClick={onPay}>Pagar ahora</Button>
          ) : null}
          <Button variant="secondary" icon={<PencilLine className="h-3.5 w-3.5" />} onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}

function CalendarDetail({
  label,
  value,
  icon,
  valueTone = 'neutral',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  valueTone?: 'danger' | 'neutral';
}) {
  const valueClass = valueTone === 'danger' ? 'text-danger' : 'text-text';

  return (
    <div className="rounded-2xl border border-border bg-bg/65 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-light">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-text-light">{icon}</span>
        <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

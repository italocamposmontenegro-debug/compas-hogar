// Casa Clara — Recurring Transactions Page (Plus)
import { useCallback, useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, SelectField, Modal, EmptyState, FeatureGate, AlertBanner, ConfirmDialog } from '../../components/ui';
import { RegisterPaymentModal } from '../../components/payments/RegisterPaymentModal';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { formatCLP } from '../../utils/format-clp';
import { getCurrentMonthYear, getMonthRange, formatDate } from '../../utils/dates-chile';
import type { RecurringTransaction, Category, PaymentCalendarItem } from '../../types/database';
import { Repeat, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export function RecurringPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
  const { year, month } = getCurrentMonthYear();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthPayments, setMonthPayments] = useState<PaymentCalendarItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [payingItem, setPayingItem] = useState<PaymentCalendarItem | null>(null);
  const [undoingItem, setUndoingItem] = useState<PaymentCalendarItem | null>(null);
  const [toggleItem, setToggleItem] = useState<RecurringTransaction | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringTransaction | null>(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState('');
  const [day, setDay] = useState('1');
  const [scope, setScope] = useState<'shared' | 'personal'>('shared');
  const [paidBy, setPaidBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');

  const load = useCallback(async () => {
    if (!household) return;
    await syncRecurringItems(household.id).catch(() => null);
    const { start, end } = getMonthRange(year, month);
    const [itRes, catRes, paymentRes] = await Promise.all([
      supabase.from('recurring_transactions').select('*').eq('household_id', household.id),
      supabase.from('categories').select('*').eq('household_id', household.id).is('deleted_at', null),
      supabase.from('payment_calendar_items').select('*')
        .eq('household_id', household.id)
        .gte('due_date', start)
        .lte('due_date', end)
        .not('recurring_source_id', 'is', null),
    ]);
    setItems((itRes.data || []) as RecurringTransaction[]);
    setCategories((catRes.data || []) as Category[]);
    setMonthPayments((paymentRes.data || []) as PaymentCalendarItem[]);
  }, [household, month, year]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (currentMember) setPaidBy(currentMember.id); }, [currentMember]);

  function resetForm() {
    setEditingItem(null);
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
    setEditingItem(item);
    setDesc(item.description);
    setAmount(String(item.amount_clp));
    setCatId(item.category_id || '');
    setDay(String(item.day_of_month));
    setScope(item.scope);
    setPaidBy(item.paid_by_member_id);
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    resetForm();
  }

  async function handleSave() {
    if (!household || !currentMember) return;

    if (!desc.trim() || !amount || !day || !paidBy) {
      setMsgType('danger');
      setMsg('Completa descripcion, monto, dia y miembro responsable.');
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
              description: desc,
              amountClp: parseInt(amount, 10),
              categoryId: catId || null,
              dayOfMonth: parseInt(day, 10),
              scope,
              paidByMemberId: paidBy,
            }
          : {
              action: 'create',
              householdId: household.id,
              description: desc,
              amountClp: parseInt(amount, 10),
              categoryId: catId || null,
              dayOfMonth: parseInt(day, 10),
              scope,
              paidByMemberId: paidBy,
            },
      });

      if (error) throw error;

      await syncRecurringItems(household.id).catch(() => null);
      setMsgType('success');
      setMsg(editingItem ? 'Recurrencia actualizada correctamente.' : 'Recurrencia creada correctamente.');
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
      setMsg(nextIsActive
        ? 'Recurrencia reactivada. Volverá a generar pagos automáticamente.'
        : 'Recurrencia desactivada. No generará nuevos pagos en los próximos meses.');
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
      setMsg('Recurrencia eliminada correctamente.');
      setDeletingItem(null);
      await load();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos eliminar la recurrencia.');
    } finally {
      setSaving(false);
    }
  }

  const getCatName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';
  const getMemberName = (id: string) => members.find(m => m.id === id)?.display_name || '—';
  const getMonthPayment = (recurringId: string) => monthPayments.find(item => item.recurring_source_id === recurringId) || null;
  const paymentBadge = {
    pending: 'badge-warning',
    paid: 'badge-success',
    overdue: 'badge-danger',
  } as const;
  const paymentIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-warning" />,
    paid: <CheckCircle className="h-3.5 w-3.5 text-success" />,
    overdue: <AlertTriangle className="h-3.5 w-3.5 text-danger" />,
  } as const;

  return (
    <FeatureGate feature="recurring">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text">Gastos recurrentes</h1>
          {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal} size="sm">Nuevo</Button>}
        </div>

        {msg && (
          <div className="mb-6">
            <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-6">
            <AlertBanner
              type="info"
              message="Desactivar pausa la recurrencia y evita nuevos pagos futuros. Eliminar borra la regla por completo y también quita el pago pendiente del mes si aún no estaba registrado."
            />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState icon={<Repeat className="h-8 w-8" />} title="Sin recurrencias" description="Agrega gastos que se repiten cada mes." />
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const monthPayment = getMonthPayment(item.id);
              return (
              <Card key={item.id} padding="sm" className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-text text-sm">{item.description}</p>
                  <p className="text-xs text-text-muted">Día {item.day_of_month} · {getCatName(item.category_id)} · {getMemberName(item.paid_by_member_id)}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {item.is_active
                      ? 'Desactiva si solo quieres pausarla. Elimínala solo si ya no quieres conservar esta regla.'
                      : 'Está pausada. Puedes reactivarla para volver a generar pagos automáticos.'}
                  </p>
                  {monthPayment ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {paymentIcon[monthPayment.status]}
                      <span className={`badge ${paymentBadge[monthPayment.status]}`}>
                        {monthPayment.status === 'paid' ? 'Pagado' : monthPayment.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                      </span>
                      <span className="text-xs text-text-muted">
                        Pago de este mes: {formatDate(monthPayment.due_date)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">
                      Aún no hay pago generado para este mes.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text">{formatCLP(item.amount_clp)}</span>
                  <span className={`badge ${item.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {item.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(item)}>
                      Editar
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setToggleItem(item)}>
                      {item.is_active ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setDeletingItem(item)}>
                      Eliminar regla
                    </Button>
                  )}
                  {item.is_active && monthPayment && monthPayment.status !== 'paid' && canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setPayingItem(monthPayment)}>
                      Marcar pagado
                    </Button>
                  )}
                  {item.is_active && monthPayment?.status === 'paid' && monthPayment.paid_transaction_id && canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setUndoingItem(monthPayment)}>
                      Deshacer pago
                    </Button>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        )}

        <Modal open={showForm} onClose={closeForm} title={editingItem ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'} size="md">
          <div className="space-y-4">
            <InputField label="Descripción" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Arriendo" />
            <InputField label="Monto (CLP)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Categoría" value={catId} onChange={setCatId}
                options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} placeholder="Seleccionar" />
              <InputField label="Día del mes" type="number" value={day} onChange={e => setDay(e.target.value)} />
            </div>
            <p className="text-xs text-text-muted">
              Usa un día entre 1 y 28 para que la recurrencia funcione de forma estable en todos los meses.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Pagado por" value={paidBy} onChange={setPaidBy}
                options={members.map(m => ({ value: m.id, label: m.display_name }))} />
            <SelectField label="Alcance" value={scope} onChange={v => setScope(v as 'shared' | 'personal')}
              options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>{editingItem ? 'Guardar cambios' : 'Crear'}</Button>
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
            ? 'La regla seguirá existiendo, pero dejará de generar nuevos pagos en los próximos meses. El pago ya creado para este mes se mantendrá.'
            : 'La recurrencia volverá a generar pagos automáticos. Si corresponde, se recreará el pago del mes actual.'}
          confirmLabel={toggleItem?.is_active ? 'Desactivar' : 'Reactivar'}
        />

        <ConfirmDialog
          open={!!deletingItem}
          onClose={() => !saving && setDeletingItem(null)}
          onConfirm={handleDeleteRecurring}
          title="Eliminar recurrencia"
          message="La regla se borrará de forma permanente y también se quitará cualquier pago pendiente generado por ella este mes. Los pagos ya registrados quedarán como historial."
          confirmLabel="Eliminar regla"
        />
      </div>
    </FeatureGate>
  );
}

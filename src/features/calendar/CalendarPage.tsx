// ============================================
// Casa Clara — Calendar Page
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, Modal, InputField, EmptyState, SelectField, AlertBanner, ConfirmDialog } from '../../components/ui';
import { RegisterPaymentModal } from '../../components/payments/RegisterPaymentModal';
import { supabase } from '../../lib/supabase';
import { syncRecurringItems } from '../../lib/recurring';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import type { Category, PaymentCalendarItem } from '../../types/database';
import { CalendarClock, Plus, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export function CalendarPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
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

  const load = useCallback(async () => {
    if (!household) return;
    await syncRecurringItems(household.id).catch(() => null);
    const { start, end } = getMonthRange(year, month);
    const [itemsRes, categoriesRes] = await Promise.all([
      supabase.from('payment_calendar_items').select('*')
        .eq('household_id', household.id).gte('due_date', start).lte('due_date', end).order('due_date'),
      supabase.from('categories').select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
    ]);

    setItems((itemsRes.data || []) as PaymentCalendarItem[]);
    setCategories((categoriesRes.data || []) as Category[]);
  }, [household, year, month]);

  useEffect(() => { void load(); }, [load]);

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
        await supabase.from('payment_calendar_items').insert({
          household_id: household.id,
          description: desc,
          amount_clp: parseInt(amount, 10),
          due_date: dueDate,
          status: 'pending',
          category_id: categoryId || null,
          recurring_source_id: null,
          paid_transaction_id: null,
        });

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

  const statusIcons = {
    pending: <Clock className="h-4 w-4 text-warning" />,
    paid: <CheckCircle className="h-4 w-4 text-success" />,
    overdue: <AlertTriangle className="h-4 w-4 text-danger" />,
  };

  const getCategoryName = (id: string | null) => categories.find(category => category.id === id)?.name || 'Sin categoría';
  const visibleItems = statusFilter === 'pending' || statusFilter === 'overdue'
    ? items.filter((item) => item.status === statusFilter)
    : items;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Calendario de pagos</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)}</p>
        </div>
        {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal} size="sm">Agregar</Button>}
      </div>

      {msg && (
        <div className="mb-6">
          <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
        </div>
      )}

      {(statusFilter === 'pending' || statusFilter === 'overdue') && (
        <div className="mb-6">
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
        </div>
      )}

      {visibleItems.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="Sin pagos programados" description="Agrega los pagos que debes hacer este mes." />
      ) : (
        <div className="space-y-3">
          {visibleItems.map(item => (
            <Card key={item.id} padding="sm" className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcons[item.status]}
                <div>
                  <p className="font-medium text-text text-sm">{item.description}</p>
                  <p className="text-xs text-text-muted">
                    Vence: {formatDate(item.due_date)} · {getCategoryName(item.category_id)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-text">{formatCLP(item.amount_clp)}</span>
                {canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>Editar</Button>
                )}
                {item.status !== 'paid' && canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => openPayModal(item)}>Marcar pagado</Button>
                )}
                {item.status === 'paid' && item.paid_transaction_id && (
                  <>
                    <span className="text-xs text-success">Gasto registrado</span>
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => setUndoingItem(item)}>Deshacer pago</Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={closeCreateModal} title={editingItem ? 'Editar pago programado' : 'Nuevo pago programado'} size="sm">
        <div className="space-y-4">
          <InputField label="Descripción" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Arriendo" />
          <InputField label="Monto (CLP)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <InputField label="Fecha de vencimiento" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <SelectField
            label="Categoría"
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: 'Sin categoría' },
              ...categories.map(category => ({ value: category.id, label: `${category.icon} ${category.name}` })),
            ]}
          />
          {editingItem?.status === 'paid' && editingItem.paid_transaction_id && (
            <AlertBanner
              type="info"
              message="Este pago ya tiene un gasto registrado. Si fue un error o quedó duplicado, puedes deshacerlo desde aquí."
            />
          )}
          {editingItem?.recurring_source_id && (
            <AlertBanner
              type="info"
              message="Este pago viene de una recurrencia. Si quieres dejar de verlo en los próximos meses, gestiona esa recurrencia desde la sección Recurrencias."
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {editingItem?.status === 'paid' && editingItem.paid_transaction_id && canWrite && (
                <Button variant="ghost" onClick={() => openUndoPaymentConfirm(editingItem)}>
                  Deshacer pago
                </Button>
              )}
              {editingItem && !editingItem.recurring_source_id && canWrite && (
                <Button variant="ghost" onClick={() => openDeleteItemConfirm(editingItem)}>
                  Eliminar pago
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={closeCreateModal}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>{editingItem ? 'Guardar' : 'Crear'}</Button>
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
        message={deletingItem?.paid_transaction_id
          ? 'Esto eliminará el pago programado y también quitará el gasto enlazado de tus movimientos.'
          : 'Esto eliminará el pago programado de tu calendario.'}
        confirmLabel="Eliminar pago"
      />
    </div>
  );
}

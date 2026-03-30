// Casa Clara — Recurring Transactions Page (Plus)
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    pending: <Clock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
    paid: <CheckCircle className="h-3.5 w-3.5 text-success" aria-hidden="true" />,
    overdue: <AlertTriangle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
  } as const;
  const paymentLabel = {
    pending: 'Pendiente',
    paid: 'Pagado',
    overdue: 'Vencido',
  } as const;

  return (
    <FeatureGate feature="recurring_transactions">
      <div className="app-page max-w-6xl">
        <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="recurring-title">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Recurrencias</p>
              <h1 id="recurring-title" className="mt-3 text-[clamp(1.85rem,2.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-text">
                Pagos recurrentes
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
                Para pagos que se repiten cada mes. Los movimientos puntuales se registran en Movimientos.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate('/app/movimientos')}>
                Ver movimientos
              </Button>
              {canWrite ? <Button icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>Nueva recurrencia</Button> : null}
            </div>
          </div>
        </section>

        {msg && (
          <div className="mb-6">
            <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-6">
            <AlertBanner
              type="info"
              message="Desactivar pausa la recurrencia y evita nuevos pagos futuros. Eliminar regla borra la recurrencia por completo y también quita el pago pendiente del mes si aún no estaba registrado."
            />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-8 w-8" />}
            eyebrow="Continuidad del hogar"
            title="Aún no hay pagos recurrentes"
            description="Crea aquí los pagos que se repiten cada mes."
            secondaryText="Usa Movimientos para gastos puntuales y Recurrencias para arriendo, internet, colegio o suscripciones."
            action={canWrite ? { label: 'Crear recurrencia', onClick: openCreateModal } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {items.map(item => {
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
                          {canWrite && (
                            <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => openEditModal(item)}>
                              Editar
                            </Button>
                          )}
                          {canWrite && (
                            <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setToggleItem(item)}>
                              {item.is_active ? 'Desactivar' : 'Reactivar'}
                            </Button>
                          )}
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full border-danger/15 text-danger hover:border-danger/20 hover:bg-danger-bg hover:text-danger sm:w-auto"
                              onClick={() => setDeletingItem(item)}
                            >
                              Eliminar regla
                            </Button>
                          )}
                          {item.is_active && monthPayment && monthPayment.status !== 'paid' && canWrite && (
                            <Button size="sm" className="w-full sm:w-auto" onClick={() => setPayingItem(monthPayment)}>
                              Marcar pagado
                            </Button>
                          )}
                          {item.is_active && monthPayment?.status === 'paid' && monthPayment.paid_transaction_id && canWrite && (
                            <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => setUndoingItem(monthPayment)}>
                              Deshacer pago
                            </Button>
                          )}
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

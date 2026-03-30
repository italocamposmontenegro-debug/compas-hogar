import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, InputField, SelectField, AlertBanner } from '../ui';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../hooks/useSubscription';
import { formatCLP } from '../../utils/format-clp';
import { formatDate } from '../../utils/dates-chile';
import type { Category, HouseholdMember, PaymentCalendarItem } from '../../types/database';

export function RegisterPaymentModal({
  open,
  item,
  members,
  categories,
  defaultPaidBy,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: PaymentCalendarItem | null;
  members: HouseholdMember[];
  categories: Category[];
  defaultPaidBy: string;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const { hasFeature } = useSubscription();
  const [paidBy, setPaidBy] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [paidScope, setPaidScope] = useState<'shared' | 'personal'>('shared');
  const [expenseType, setExpenseType] = useState<'fixed' | 'variable'>('fixed');
  const [categoryId, setCategoryId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canUseSplitManual = hasFeature('split_manual');
  const canUseCustomCategories = hasFeature('categories_custom');
  const availableCategories = categories.filter((category) => canUseCustomCategories || category.is_default || category.id === categoryId);

  useEffect(() => {
    if (!item) return;

    setPaidBy(defaultPaidBy || members[0]?.id || '');
    setPaidOn(item.due_date);
    setPaidScope('shared');
    setExpenseType(item.recurring_source_id ? 'fixed' : 'variable');
    setCategoryId(item.category_id || '');
    setPaymentNotes('');
    setError('');
  }, [defaultPaidBy, item, members]);

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);

  const getMemberName = (id: string) => members.find(member => member.id === id)?.display_name || 'miembro';

  async function handleSubmit() {
    if (!item || !paidBy || !paidOn) return;

    setSaving(true);
    setError('');

    try {
      const { error: invokeError } = await supabase.functions.invoke('pay-calendar-item', {
        body: {
          itemId: item.id,
          paidByMemberId: paidBy,
          occurredOn: paidOn,
          scope: paidScope,
          expenseType,
          categoryId: categoryId || null,
          notes: paymentNotes || null,
        },
      });

      if (invokeError) throw invokeError;

      await onSaved('Pago registrado. Ya quedó reflejado como gasto del hogar.');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar el pago.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Registrar pago" size="md">
      <div className="space-y-4">
        {error && (
          <AlertBanner
            type="danger"
            message={error}
            onClose={() => setError('')}
          />
        )}

        <p className="text-sm text-text-muted">
          Este pago quedará marcado como pagado y además se creará el gasto real en tus movimientos.
        </p>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-text">{item?.description}</p>
          <p className="text-sm text-text-muted">
            {item ? formatCLP(item.amount_clp) : '—'} · vence {item ? formatDate(item.due_date) : '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {canUseSplitManual ? (
            <SelectField
              label="¿Quién pagó?"
              value={paidBy}
              onChange={setPaidBy}
              options={members.map(member => ({ value: member.id, label: member.display_name }))}
            />
          ) : (
            <InputField label="Registrado por" value={members.find((member) => member.id === paidBy)?.display_name || 'Miembro'} onChange={() => {}} readOnly />
          )}
          <InputField
            label="Fecha de pago"
            type="date"
            value={paidOn}
            onChange={e => setPaidOn(e.target.value)}
          />
        </div>
        {canUseSplitManual ? (
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Alcance"
              value={paidScope}
              onChange={value => setPaidScope(value as 'shared' | 'personal')}
              options={[
                { value: 'shared', label: 'Compartido' },
                { value: 'personal', label: 'Personal' },
              ]}
            />
            <SelectField
              label="Tipo de gasto"
              value={expenseType}
              onChange={value => setExpenseType(value as 'fixed' | 'variable')}
              options={[
                { value: 'fixed', label: 'Fijo' },
                { value: 'variable', label: 'Variable' },
              ]}
            />
          </div>
        ) : (
          <AlertBanner
            type="info"
            message="En Free el pago se registra como gasto compartido del miembro que lo marca."
          />
        )}
        <SelectField
          label="Categoría"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: '', label: 'Sin categoría' },
            ...availableCategories.map(category => ({ value: category.id, label: `${category.icon} ${category.name}` })),
          ]}
        />
        <InputField
          label="Notas (opcional)"
          value={paymentNotes}
          onChange={e => setPaymentNotes(e.target.value)}
          placeholder={`Ej: Pagado por ${paidBy ? getMemberName(paidBy) : 'miembro'} desde cuenta corriente`}
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving}>Registrar pago</Button>
        </div>
      </div>
    </Modal>
  );
}

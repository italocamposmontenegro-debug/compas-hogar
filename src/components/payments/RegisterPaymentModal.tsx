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
  const [affectsBalance, setAffectsBalance] = useState<'yes' | 'no'>('yes');
  const [categoryId, setCategoryId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canUseCustomCategories = hasFeature('categories_custom');
  const availableCategories = categories.filter((category) => canUseCustomCategories || category.is_default || category.id === categoryId);

  useEffect(() => {
    if (!item) return;

    setPaidBy(defaultPaidBy || members[0]?.id || '');
    setPaidOn(item.due_date);
    setPaidScope('shared');
    setExpenseType(item.recurring_source_id ? 'fixed' : 'variable');
    setAffectsBalance('yes');
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
          affectsHouseholdBalance: affectsBalance === 'yes',
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
          Este pago quedará marcado como pagado y además se creará el movimiento real del hogar.
        </p>
        <AlertBanner
          type="info"
          message="Si este pago lo cubrió una sola persona y correspondía a ambos, también puede sumarse a Saldo Hogar."
        />
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-text">{item?.description}</p>
          <p className="text-sm text-text-muted">
            {item ? formatCLP(item.amount_clp) : '—'} · vence {item ? formatDate(item.due_date) : '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="¿Quién pagó?"
            value={paidBy}
            onChange={setPaidBy}
            options={members.map(member => ({ value: member.id, label: member.display_name }))}
          />
          <InputField
            label="Fecha de pago"
            type="date"
            value={paidOn}
            onChange={e => setPaidOn(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Corresponde a"
            value={paidScope}
            onChange={value => setPaidScope(value as 'shared' | 'personal')}
            options={[
              { value: 'shared', label: 'Entre ambos' },
              { value: 'personal', label: 'Solo mío' },
            ]}
          />
          <SelectField
            label="Tipo"
            value={expenseType}
            onChange={value => setExpenseType(value as 'fixed' | 'variable')}
            options={[
              { value: 'fixed', label: 'Pago obligatorio' },
              { value: 'variable', label: 'Gasto variable' },
            ]}
          />
        </div>
        <SelectField
          label="¿Debe aparecer en Saldo Hogar?"
          value={affectsBalance}
          onChange={value => setAffectsBalance(value as 'yes' | 'no')}
          options={[
            { value: 'yes', label: 'Sí, una persona adelantó algo por ambos' },
            { value: 'no', label: 'No, no debe contar en el saldo' },
          ]}
        />
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

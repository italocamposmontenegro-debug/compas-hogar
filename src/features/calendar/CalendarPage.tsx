// ============================================
// Casa Clara — Calendar Page
// ============================================

import { useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, Modal, InputField, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import type { PaymentCalendarItem } from '../../types/database';
import { CalendarClock, Plus, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export function CalendarPage() {
  const { household } = useHousehold();
  const { canWrite } = useSubscription();
  const { year, month } = getCurrentMonthYear();
  const [items, setItems] = useState<PaymentCalendarItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (household) load(); }, [household]);

  async function load() {
    if (!household) return;
    const { start, end } = getMonthRange(year, month);
    const { data } = await supabase.from('payment_calendar_items').select('*')
      .eq('household_id', household.id).gte('due_date', start).lte('due_date', end).order('due_date');
    setItems((data || []) as PaymentCalendarItem[]);
  }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    await supabase.from('payment_calendar_items').insert({
      household_id: household.id, description: desc, amount_clp: parseInt(amount),
      due_date: dueDate, status: 'pending', category_id: null, recurring_source_id: null, paid_transaction_id: null,
    });
    setSaving(false); setShowForm(false); setDesc(''); setAmount(''); setDueDate(''); load();
  }

  async function markPaid(id: string) {
    await supabase.from('payment_calendar_items').update({ status: 'paid' }).eq('id', id);
    load();
  }

  const statusIcons = { pending: <Clock className="h-4 w-4 text-warning" />, paid: <CheckCircle className="h-4 w-4 text-success" />, overdue: <AlertTriangle className="h-4 w-4 text-danger" /> };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Calendario de pagos</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(year, month)}</p>
        </div>
        {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)} size="sm">Agregar</Button>}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="Sin pagos programados" description="Agrega los pagos que debes hacer este mes." />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} padding="sm" className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcons[item.status]}
                <div>
                  <p className="font-medium text-text text-sm">{item.description}</p>
                  <p className="text-xs text-text-muted">Vence: {formatDate(item.due_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-text">{formatCLP(item.amount_clp)}</span>
                {item.status === 'pending' && canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => markPaid(item.id)}>Marcar pagado</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo pago programado" size="sm">
        <div className="space-y-4">
          <InputField label="Descripción" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Arriendo" />
          <InputField label="Monto (CLP)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <InputField label="Fecha de vencimiento" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

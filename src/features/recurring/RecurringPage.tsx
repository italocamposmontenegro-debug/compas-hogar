// Casa Clara — Recurring Transactions Page (Plus)
import { useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, SelectField, Modal, EmptyState, FeatureGate } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import type { RecurringTransaction, Category } from '../../types/database';
import { Repeat, Plus } from 'lucide-react';

export function RecurringPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState('');
  const [day, setDay] = useState('1');
  const [scope, setScope] = useState<'shared' | 'personal'>('shared');
  const [paidBy, setPaidBy] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (household) load(); }, [household]);
  useEffect(() => { if (currentMember) setPaidBy(currentMember.id); }, [currentMember]);

  async function load() {
    if (!household) return;
    const [itRes, catRes] = await Promise.all([
      supabase.from('recurring_transactions').select('*').eq('household_id', household.id),
      supabase.from('categories').select('*').eq('household_id', household.id).is('deleted_at', null),
    ]);
    setItems((itRes.data || []) as RecurringTransaction[]);
    setCategories((catRes.data || []) as Category[]);
  }

  async function handleSave() {
    if (!household || !currentMember) return;
    setSaving(true);
    await supabase.from('recurring_transactions').insert({
      household_id: household.id, created_by: currentMember.user_id!, description: desc,
      amount_clp: parseInt(amount), category_id: catId || null, scope, paid_by_member_id: paidBy,
      assigned_to_member_id: null, day_of_month: parseInt(day), is_active: true,
    });
    setSaving(false); setShowForm(false); setDesc(''); setAmount(''); load();
  }

  const getCatName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';
  const getMemberName = (id: string) => members.find(m => m.id === id)?.display_name || '—';

  return (
    <FeatureGate feature="recurring">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text">Gastos recurrentes</h1>
          {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)} size="sm">Nuevo</Button>}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<Repeat className="h-8 w-8" />} title="Sin recurrencias" description="Agrega gastos que se repiten cada mes." />
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <Card key={item.id} padding="sm" className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text text-sm">{item.description}</p>
                  <p className="text-xs text-text-muted">Día {item.day_of_month} · {getCatName(item.category_id)} · {getMemberName(item.paid_by_member_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text">{formatCLP(item.amount_clp)}</span>
                  <span className={`badge ${item.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {item.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo gasto recurrente" size="md">
          <div className="space-y-4">
            <InputField label="Descripción" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Arriendo" />
            <InputField label="Monto (CLP)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Categoría" value={catId} onChange={setCatId}
                options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} placeholder="Seleccionar" />
              <InputField label="Día del mes" type="number" value={day} onChange={e => setDay(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Pagado por" value={paidBy} onChange={setPaidBy}
                options={members.map(m => ({ value: m.id, label: m.display_name }))} />
              <SelectField label="Alcance" value={scope} onChange={v => setScope(v as any)}
                options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving}>Crear</Button>
            </div>
          </div>
        </Modal>
      </div>
    </FeatureGate>
  );
}

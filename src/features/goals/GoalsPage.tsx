// ============================================
// Casa Clara — Goals Page
// ============================================

import { useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, Modal, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import type { SavingsGoal } from '../../types/database';
import { Target, Plus, Star, Edit2 } from 'lucide-react';

export function GoalsPage() {
  const { household } = useHousehold();
  const { canWrite } = useSubscription();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (household) load(); }, [household]);

  async function load() {
    if (!household) return;
    const { data } = await supabase.from('savings_goals').select('*')
      .eq('household_id', household.id).order('is_primary', { ascending: false });
    setGoals((data || []) as SavingsGoal[]);
  }

  function openCreate() { setEditing(null); setName(''); setTarget(''); setCurrent('0'); setTargetDate(''); setShowForm(true); }
  function openEdit(g: SavingsGoal) { setEditing(g); setName(g.name); setTarget(String(g.target_amount_clp)); setCurrent(String(g.current_amount_clp)); setTargetDate(g.target_date); setShowForm(true); }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    const data = { name, target_amount_clp: parseInt(target), current_amount_clp: parseInt(current) || 0, target_date: targetDate, status: 'active' as const, is_primary: goals.length === 0 };
    if (editing) { await supabase.from('savings_goals').update(data).eq('id', editing.id); }
    else { await supabase.from('savings_goals').insert({ ...data, household_id: household.id }); }
    setSaving(false); setShowForm(false); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Metas de ahorro</h1>
        {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} size="sm">Nueva meta</Button>}
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={<Target className="h-8 w-8" />} title="Sin metas" description="Crea tu primera meta de ahorro para empezar a avanzar." action={canWrite ? { label: 'Crear meta', onClick: openCreate } : undefined} />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {goals.map(g => {
            const pct = g.target_amount_clp > 0 ? Math.min(100, (g.current_amount_clp / g.target_amount_clp) * 100) : 0;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {g.is_primary && <Star className="h-4 w-4 text-warning fill-warning" />}
                    <h3 className="font-semibold text-text">{g.name}</h3>
                  </div>
                  {canWrite && <button onClick={() => openEdit(g)} className="text-text-muted hover:text-primary cursor-pointer"><Edit2 className="h-4 w-4" /></button>}
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-bold text-text">{formatCLP(g.current_amount_clp)}</span>
                  <span className="text-sm text-text-muted">/ {formatCLP(g.target_amount_clp)}</span>
                </div>
                <div className="w-full h-3 bg-border rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{Math.round(pct)}% completado</span>
                  <span>Meta: {formatDateLong(g.target_date)}</span>
                </div>
                <span className={`badge mt-3 ${g.status === 'completed' ? 'badge-success' : g.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`}>
                  {g.status === 'active' ? 'Activa' : g.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar meta' : 'Nueva meta'} size="sm">
        <div className="space-y-4">
          <InputField label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder='Ej: "Vacaciones"' />
          <InputField label="Monto objetivo (CLP)" type="number" value={target} onChange={e => setTarget(e.target.value)} />
          <InputField label="Ahorrado hasta ahora (CLP)" type="number" value={current} onChange={e => setCurrent(e.target.value)} />
          <InputField label="Fecha objetivo" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

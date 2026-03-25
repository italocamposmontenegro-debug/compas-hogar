// ============================================
// Casa Clara — Goals Page
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, Modal, EmptyState, AlertBanner, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { validateAmount, validateDate, validateRequired } from '../../utils/validators';
import type { SavingsGoal } from '../../types/database';
import { Target, Plus, Star, Edit2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export function GoalsPage() {
  const { household } = useHousehold();
  const { canWrite, hasFeature } = useSubscription();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    goal: SavingsGoal;
    nextStatus: SavingsGoal['status'];
  } | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger' | 'info'>('success');
  const allowsMultipleGoals = hasFeature('multiple_goals');
  const activeGoalsCount = goals.filter(goal => goal.status === 'active').length;
  const canCreateGoal = canWrite && (allowsMultipleGoals || activeGoalsCount === 0);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('savings_goals').select('*')
      .eq('household_id', household.id).order('is_primary', { ascending: false });
    setGoals((data || []) as SavingsGoal[]);
  }, [household]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    if (!canCreateGoal) return;
    setEditing(null);
    setName('');
    setTarget('');
    setCurrent('0');
    setTargetDate('');
    setMsg('');
    setShowForm(true);
  }
  function openEdit(g: SavingsGoal) {
    setEditing(g);
    setName(g.name);
    setTarget(String(g.target_amount_clp));
    setCurrent(String(g.current_amount_clp));
    setTargetDate(g.target_date);
    setMsg('');
    setShowForm(true);
  }

  async function setPrimaryGoal(goal: SavingsGoal) {
    if (!household || goal.status !== 'active') {
      setMsgType('danger');
      setMsg('Solo una meta activa puede quedar como principal.');
      return;
    }

    setActionLoadingId(goal.id);
    setMsg('');

    try {
      const { error: clearError } = await supabase
        .from('savings_goals')
        .update({ is_primary: false })
        .eq('household_id', household.id);

      if (clearError) throw clearError;

      const { error: setError } = await supabase
        .from('savings_goals')
        .update({ is_primary: true })
        .eq('id', goal.id);

      if (setError) throw setError;

      setMsgType('success');
      setMsg(`"${goal.name}" ahora es tu meta principal.`);
      await load();
    } catch {
      setMsgType('danger');
      setMsg('No pudimos actualizar la meta principal.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function applyStatusChange() {
    if (!household || !pendingStatusChange) return;

    const { goal, nextStatus } = pendingStatusChange;
    const isReactivating = nextStatus === 'active' && goal.status !== 'active';
    const otherActiveGoals = goals.filter(existing => existing.id !== goal.id && existing.status === 'active');

    if (isReactivating && !allowsMultipleGoals && otherActiveGoals.length >= 1) {
      setPendingStatusChange(null);
      setMsgType('info');
      setMsg('El plan Esencial solo permite una meta activa. Cierra la meta actual o actualiza a Estratégico.');
      return;
    }

    setActionLoadingId(goal.id);
    setMsg('');

    try {
      const nextPrimary = nextStatus === 'active'
        ? (goal.is_primary || !otherActiveGoals.some(existing => existing.is_primary))
        : false;

      const { error: updateError } = await supabase
        .from('savings_goals')
        .update({
          status: nextStatus,
          is_primary: nextPrimary,
        })
        .eq('id', goal.id);

      if (updateError) throw updateError;

      if (nextStatus !== 'active' && goal.is_primary) {
        const fallbackGoal = otherActiveGoals[0] ?? null;
        if (fallbackGoal) {
          const { error: fallbackError } = await supabase
            .from('savings_goals')
            .update({ is_primary: true })
            .eq('id', fallbackGoal.id);

          if (fallbackError) throw fallbackError;
        }
      }

      setMsgType('success');
      setMsg(
        nextStatus === 'completed'
          ? `Marcaste "${goal.name}" como completada.`
          : nextStatus === 'cancelled'
            ? `Cancelaste "${goal.name}".`
            : `Reactivaste "${goal.name}".`,
      );
      setPendingStatusChange(null);
      await load();
    } catch {
      setMsgType('danger');
      setMsg('No pudimos actualizar el estado de la meta.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSave() {
    if (!household) return;
    if (!editing && !allowsMultipleGoals && activeGoalsCount >= 1) {
      setMsgType('info');
      setMsg('El plan Esencial permite una meta activa. Actualiza a Estratégico para agregar otra.');
      setShowForm(false);
      return;
    }

    const nameCheck = validateRequired(name, 'El nombre de la meta');
    if (!nameCheck.valid) {
      setMsgType('danger');
      setMsg(nameCheck.error!);
      return;
    }

    const targetCheck = validateAmount(target);
    if (!targetCheck.valid) {
      setMsgType('danger');
      setMsg(targetCheck.error!);
      return;
    }

    if (current.trim()) {
      const currentCheck = validateAmount(current);
      if (!currentCheck.valid && Number.parseInt(current, 10) !== 0) {
        setMsgType('danger');
        setMsg('El ahorro actual debe ser 0 o un monto válido.');
        return;
      }
    }

    const dateCheck = validateDate(targetDate);
    if (!dateCheck.valid) {
      setMsgType('danger');
      setMsg(dateCheck.error!);
      return;
    }

    setSaving(true);
    setMsg('');
    const data = {
      name: name.trim(),
      target_amount_clp: parseInt(target, 10),
      current_amount_clp: parseInt(current, 10) || 0,
      target_date: targetDate,
      status: editing ? editing.status : 'active' as const,
      is_primary: editing ? editing.is_primary : goals.length === 0,
    };

    try {
      if (editing) {
        const { error } = await supabase.from('savings_goals').update(data).eq('id', editing.id);
        if (error) throw error;
        setMsgType('success');
        setMsg('Meta actualizada correctamente.');
      } else {
        const { error } = await supabase.from('savings_goals').insert({ ...data, household_id: household.id });
        if (error) throw error;
        setMsgType('success');
        setMsg('Meta creada correctamente.');
      }
      setShowForm(false);
      await load();
    } catch {
      setMsgType('danger');
      setMsg('No pudimos guardar la meta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Metas de ahorro</h1>
        {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} size="sm" disabled={!canCreateGoal}>Nueva meta</Button>}
      </div>

      {msg && (
        <div className="mb-6">
          <AlertBanner type={msgType === 'info' ? 'info' : msgType} message={msg} onClose={() => setMsg('')} />
        </div>
      )}

      {!allowsMultipleGoals && activeGoalsCount >= 1 && (
        <div className="mb-6">
          <AlertBanner
            type="info"
            message="El plan Esencial incluye una meta activa. Actualiza a Estratégico para trabajar varias metas al mismo tiempo."
          />
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState icon={<Target className="h-8 w-8" />} title="Sin metas" description="Crea tu primera meta de ahorro para empezar a avanzar." action={canCreateGoal ? { label: 'Crear meta', onClick: openCreate } : undefined} />
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
                  {canWrite && (
                    <button onClick={() => openEdit(g)} className="text-text-muted hover:text-primary cursor-pointer" title="Editar meta">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
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
                {canWrite && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {g.status === 'active' && !g.is_primary && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Star className="h-3.5 w-3.5" />}
                        loading={actionLoadingId === g.id}
                        onClick={() => void setPrimaryGoal(g)}
                      >
                        Hacer principal
                      </Button>
                    )}
                    {g.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === g.id}
                          onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'completed' })}
                        >
                          Completar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<XCircle className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === g.id}
                          onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'cancelled' })}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {g.status !== 'active' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        loading={actionLoadingId === g.id}
                        disabled={!allowsMultipleGoals && activeGoalsCount >= 1}
                        onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'active' })}
                      >
                        Reactivar
                      </Button>
                    )}
                  </div>
                )}
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

      <ConfirmDialog
        open={!!pendingStatusChange}
        onClose={() => !actionLoadingId && setPendingStatusChange(null)}
        onConfirm={applyStatusChange}
        title={
          pendingStatusChange?.nextStatus === 'completed'
            ? 'Completar meta'
            : pendingStatusChange?.nextStatus === 'cancelled'
              ? 'Cancelar meta'
              : 'Reactivar meta'
        }
        message={
          pendingStatusChange?.nextStatus === 'completed'
            ? 'La meta dejará de contarse como activa, pero seguirá visible en tu historial.'
            : pendingStatusChange?.nextStatus === 'cancelled'
              ? 'La meta se detendrá y dejará de contarse como activa. Podrás reactivarla después.'
              : 'La meta volverá a quedar activa para seguir trabajando sobre ella.'
        }
        confirmLabel={
          pendingStatusChange?.nextStatus === 'completed'
            ? 'Completar'
            : pendingStatusChange?.nextStatus === 'cancelled'
              ? 'Cancelar'
              : 'Reactivar'
        }
        loading={!!actionLoadingId}
      />
    </div>
  );
}

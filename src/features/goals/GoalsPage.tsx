// ============================================
// Casa Clara — Goals Page — Stitch M3 Edition
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Button, InputField, Modal, EmptyState, AlertBanner, ConfirmDialog, UpgradePromptCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { validateAmount, validateDate, validateRequired } from '../../utils/validators';
import type { SavingsGoal } from '../../types/database';
import { Target, Plus, Star, Edit2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

// ─── M3 CSS variable aliases ─────────────────────────────────────────────────
const C = {
  surface:              'var(--color-s-surface)',
  surfaceLow:           'var(--color-s-bg)',
  outline:              'var(--color-s-border)',
  onSurface:            'var(--color-s-text)',
  onSurfaceVariant:     'var(--color-s-text-muted)',
  primary:              'var(--color-s-primary)',
  onPrimary:            'var(--color-s-on-primary)',
  primaryContainer:     'var(--color-s-surface)', /* Flat white instead of dark green bubble */
  onPrimaryContainer:   'var(--color-s-text)',
  secondaryContainer:   'var(--color-s-surface-muted)',
  onSecondaryContainer: 'var(--color-s-text)',
  error:                'var(--color-s-danger)',
  fontHeadline:         'var(--font-headline)',
  successBg:            'var(--color-s-surface)',
  successText:          'var(--color-s-success)',
};

export function GoalsPage() {
  const { household }                          = useHousehold();
  const { canWrite, hasFeature, getUpgradeCopy, maxGoals } = useSubscription();
  const navigate                               = useNavigate();
  const [searchParams, setSearchParams]        = useSearchParams();
  const [goals, setGoals]                      = useState<SavingsGoal[]>([]);
  const [showForm, setShowForm]                = useState(false);
  const [editing, setEditing]                  = useState<SavingsGoal | null>(null);
  const [name, setName]                        = useState('');
  const [target, setTarget]                    = useState('');
  const [current, setCurrent]                  = useState('');
  const [targetDate, setTargetDate]            = useState('');
  const [saving, setSaving]                    = useState(false);
  const [actionLoadingId, setActionLoadingId]  = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    goal: SavingsGoal;
    nextStatus: SavingsGoal['status'];
  } | null>(null);
  const [msg, setMsg]         = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger' | 'info'>('success');

  const allowsMultipleGoals = hasFeature('goals_multiple');
  const activeGoalsCount    = goals.filter(g => g.status === 'active').length;
  const canCreateGoal       = canWrite && (maxGoals === null || activeGoalsCount < maxGoals);
  const goalsUpgrade        = getUpgradeCopy('goals_multiple');

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('savings_goals').select('*')
      .eq('household_id', household.id).order('is_primary', { ascending: false });
    setGoals((data || []) as SavingsGoal[]);
  }, [household]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!household || allowsMultipleGoals || activeGoalsCount < 1) return;
    trackOnce(
      `limit-goals:${household.id}`,
      'limit_reached_viewed',
      { household_id: household.id, feature: 'goals_multiple', plan: 'free' },
      'session',
    );
  }, [activeGoalsCount, allowsMultipleGoals, household]);

  const openCreate = useCallback(() => {
    if (!canCreateGoal) return;
    setEditing(null); setName(''); setTarget(''); setCurrent('0'); setTargetDate(''); setMsg('');
    setShowForm(true);
  }, [canCreateGoal]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || !canCreateGoal) return;
    openCreate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateGoal, openCreate, searchParams, setSearchParams]);

  function openEdit(g: SavingsGoal) {
    setEditing(g); setName(g.name); setTarget(String(g.target_amount_clp));
    setCurrent(String(g.current_amount_clp)); setTargetDate(g.target_date); setMsg('');
    setShowForm(true);
  }

  async function setPrimaryGoal(goal: SavingsGoal) {
    if (!household || goal.status !== 'active') {
      setMsgType('danger'); setMsg('Solo una meta activa puede quedar como principal.'); return;
    }
    setActionLoadingId(goal.id); setMsg('');
    try {
      const { error } = await supabase.functions.invoke('manage-goal', { body: { action: 'set-primary', goalId: goal.id } });
      if (error) throw error;
      setMsgType('success'); setMsg(`"${goal.name}" ahora es tu meta principal.`); await load();
    } catch { setMsgType('danger'); setMsg('No pudimos actualizar la meta principal.'); }
    finally { setActionLoadingId(null); }
  }

  async function applyStatusChange() {
    if (!household || !pendingStatusChange) return;
    const { goal, nextStatus } = pendingStatusChange;
    setActionLoadingId(goal.id); setMsg('');
    try {
      const { error } = await supabase.functions.invoke('manage-goal', { body: { action: 'set-status', goalId: goal.id, nextStatus } });
      if (error) throw error;
      setMsgType('success');
      setMsg(nextStatus === 'completed' ? `Marcaste "${goal.name}" como completada.`
        : nextStatus === 'cancelled' ? `Cancelaste "${goal.name}".` : `Reactivaste "${goal.name}".`);
      setPendingStatusChange(null); await load();
    } catch { setMsgType('danger'); setMsg('No pudimos actualizar el estado de la meta.'); }
    finally { setActionLoadingId(null); }
  }

  async function handleSave() {
    if (!household) return;
    if (!editing && !canCreateGoal) {
      setMsgType('info');
      setMsg('Tu plan actual permite solo una meta activa. Actualiza para trabajar varias metas al mismo tiempo.');
      setShowForm(false); return;
    }
    const nameCheck = validateRequired(name, 'El nombre de la meta');
    if (!nameCheck.valid) { setMsgType('danger'); setMsg(nameCheck.error!); return; }
    const targetCheck = validateAmount(target);
    if (!targetCheck.valid) { setMsgType('danger'); setMsg(targetCheck.error!); return; }
    if (current.trim()) {
      const currentCheck = validateAmount(current);
      if (!currentCheck.valid && Number.parseInt(current, 10) !== 0) {
        setMsgType('danger'); setMsg('El ahorro actual debe ser 0 o un monto válido.'); return;
      }
    }
    const dateCheck = validateDate(targetDate);
    if (!dateCheck.valid) { setMsgType('danger'); setMsg(dateCheck.error!); return; }

    setSaving(true); setMsg('');
    const data = {
      name: name.trim(),
      targetAmountClp:  parseInt(target,  10),
      currentAmountClp: parseInt(current, 10) || 0,
      targetDate,
    };
    try {
      if (editing) {
        const { error } = await supabase.functions.invoke('manage-goal', { body: { action: 'update', goalId: editing.id, ...data } });
        if (error) throw error;
        setMsgType('success'); setMsg('Meta actualizada correctamente.');
      } else {
        const { error } = await supabase.functions.invoke('manage-goal', { body: { action: 'create', householdId: household.id, ...data } });
        if (error) throw error;
        trackOnce(`first-goal:${household.id}`, 'first_goal_created', { household_id: household.id }, 'local');
        setMsgType('success'); setMsg('Meta creada correctamente.');
      }
      setShowForm(false); await load();
    } catch { setMsgType('danger'); setMsg('No pudimos guardar la meta.'); }
    finally { setSaving(false); }
  }

  // ─── Render ──────────────────────────────────────────────
  const primaryGoal    = goals.find(g => g.is_primary && g.status === 'active');
  const secondaryGoals = goals.filter(g => !g.is_primary || g.status !== 'active');

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
            Metas de ahorro
          </h1>
          <p className="mt-1 text-sm" style={{ color: C.onSurfaceVariant }}>
            Una meta visible convierte el excedente del mes en dirección compartida.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreateGoal}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: C.primary, color: C.onPrimary }}
          >
            <Plus className="h-4 w-4" />
            Nueva meta
          </button>
        )}
      </div>

      {/* ── Alerts ───────────────────────────────────────── */}
      {msg && <AlertBanner type={msgType === 'info' ? 'info' : msgType} message={msg} onClose={() => setMsg('')} />}
      {!allowsMultipleGoals && activeGoalsCount >= 1 && (
        <UpgradePromptCard
          badge={goalsUpgrade.badge}
          title={goalsUpgrade.title}
          description={goalsUpgrade.description}
          highlights={goalsUpgrade.highlights}
          actionLabel={goalsUpgrade.actionLabel || 'Ver planes'}
          onAction={() => navigate(goalsUpgrade.route)}
          compact
          trackingContext="goals-limit"
        />
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {goals.length === 0 && (
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          eyebrow="Dirección compartida"
          title="Tu ahorro todavía no tiene una meta visible"
          description="Una meta clara convierte intención en dirección y ayuda a que el hogar vea para qué está guardando dinero."
          secondaryText="No tiene que ser perfecta. Basta una primera meta para empezar a orientar el mes."
          action={canCreateGoal ? { label: 'Crear meta', onClick: openCreate } : undefined}
        />
      )}

      {/* ── Primary goal hero card ────────────────────────── */}
      {primaryGoal && (
        <div
          className="lg:p-8 p-6"
          style={{ background: C.surface }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 fill-current" style={{ color: 'var(--color-s-accent-gold)' }} />
                <span className="text-xs uppercase tracking-wider font-medium" style={{ color: C.onSurfaceVariant }}>
                  Meta principal
                </span>
              </div>
              <h2 className="text-3xl font-light tracking-tight mt-1" style={{ fontFamily: C.fontHeadline, color: C.primary }}>
                {primaryGoal.name}
              </h2>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => openEdit(primaryGoal)}
                className="p-2 rounded-xl hover:bg-black/5 transition cursor-pointer"
                style={{ color: C.onSurfaceVariant }}
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-2 mb-3">
              <div>
                <p className="text-3xl font-bold" style={{ fontFamily: C.fontHeadline, color: C.onPrimaryContainer }}>
                  {formatCLP(primaryGoal.current_amount_clp)}
                </p>
                <p className="text-sm mt-0.5" style={{ color: C.onPrimaryContainer, opacity: 0.7 }}>
                  de {formatCLP(primaryGoal.target_amount_clp)}
                </p>
              </div>
              <p className="text-lg font-semibold" style={{ color: C.onPrimaryContainer }}>
                {primaryGoal.target_amount_clp > 0
                  ? `${Math.round((primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)}%`
                  : '0%'}
              </p>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: C.outline }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, primaryGoal.target_amount_clp > 0 ? (primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100 : 0)}%`,
                  background: C.primary,
                }}
              />
            </div>
            <p className="text-sm mt-2" style={{ color: C.onPrimaryContainer, opacity: 0.7 }}>
              Meta: {formatDateLong(primaryGoal.target_date)}
            </p>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                loading={actionLoadingId === primaryGoal.id}
                onClick={() => setPendingStatusChange({ goal: primaryGoal, nextStatus: 'completed' })}>
                Completar
              </Button>
              <Button size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />}
                loading={actionLoadingId === primaryGoal.id}
                onClick={() => setPendingStatusChange({ goal: primaryGoal, nextStatus: 'cancelled' })}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Secondary goals grid ─────────────────────────── */}
      {secondaryGoals.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {secondaryGoals.map(g => {
            const pct = g.target_amount_clp > 0 ? Math.min(100, (g.current_amount_clp / g.target_amount_clp) * 100) : 0;
            const statusStyle = {
              active:    { bg: C.primaryContainer,   color: C.onPrimaryContainer },
              completed: { bg: C.successBg,          color: C.successText },
              cancelled: { bg: 'var(--color-m3-error-container)', color: 'var(--color-m3-on-error-container)' },
            }[g.status];
            return (
              <div
                key={g.id}
                className="p-6"
                style={{ background: C.surface }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {g.is_primary && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                    <h3 className="font-semibold" style={{ color: C.onSurface }}>{g.name}</h3>
                  </div>
                  {canWrite && (
                    <button onClick={() => openEdit(g)}
                      className="p-1 rounded-lg hover:bg-black/10 transition cursor-pointer"
                      style={{ color: C.onSurfaceVariant }} title="Editar">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-2 mb-3">
                  <span className="text-2xl font-bold" style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
                    {formatCLP(g.current_amount_clp)}
                  </span>
                  <span className="text-sm" style={{ color: C.onSurfaceVariant }}>/ {formatCLP(g.target_amount_clp)}</span>
                </div>

                <div className="h-2 w-full rounded-full mb-2" style={{ background: C.outline }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 100 ? C.successText : C.primary }}
                  />
                </div>
                <div className="flex justify-between text-xs mb-3" style={{ color: C.onSurfaceVariant }}>
                  <span>{Math.round(pct)}% completado</span>
                  <span>Meta: {formatDateLong(g.target_date)}</span>
                </div>

                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}
                >
                  {g.status === 'active' ? 'Activa' : g.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>

                {canWrite && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {g.status === 'active' && !g.is_primary && (
                      <Button size="sm" variant="secondary" icon={<Star className="h-3.5 w-3.5" />}
                        loading={actionLoadingId === g.id}
                        onClick={() => void setPrimaryGoal(g)}>
                        Hacer principal
                      </Button>
                    )}
                    {g.status === 'active' && (
                      <>
                        <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === g.id}
                          onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'completed' })}>
                          Completar
                        </Button>
                        <Button size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === g.id}
                          onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'cancelled' })}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {g.status !== 'active' && (
                      <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />}
                        loading={actionLoadingId === g.id}
                        disabled={!allowsMultipleGoals && activeGoalsCount >= 1}
                        onClick={() => setPendingStatusChange({ goal: g, nextStatus: 'active' })}>
                        Reactivar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Form Modal ───────────────────────────────────── */}
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

      {/* ── Status change confirm ─────────────────────────── */}
      <ConfirmDialog
        open={!!pendingStatusChange}
        onClose={() => !actionLoadingId && setPendingStatusChange(null)}
        onConfirm={applyStatusChange}
        title={
          pendingStatusChange?.nextStatus === 'completed' ? 'Completar meta'
          : pendingStatusChange?.nextStatus === 'cancelled' ? 'Cancelar meta'
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
          pendingStatusChange?.nextStatus === 'completed' ? 'Completar'
          : pendingStatusChange?.nextStatus === 'cancelled' ? 'Cancelar'
          : 'Reactivar'
        }
        loading={!!actionLoadingId}
      />
    </div>
  );
}

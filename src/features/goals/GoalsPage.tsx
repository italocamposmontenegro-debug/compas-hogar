import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Button, Card, InputField, Modal, EmptyState, AlertBanner, ConfirmDialog, UpgradePromptCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatDateLong } from '../../utils/dates-chile';
import { validateAmount, validateDate, validateRequired } from '../../utils/validators';
import type { SavingsGoal } from '../../types/database';
import {
  CalendarDays,
  CheckCircle2,
  Edit2,
  Layers3,
  Plus,
  RotateCcw,
  Star,
  Target,
  XCircle,
} from 'lucide-react';

const C = {
  surface: 'var(--color-s-surface)',
  outline: 'var(--color-s-border)',
  onSurface: 'var(--color-s-text)',
  onSurfaceVariant: 'var(--color-s-text-muted)',
  primary: 'var(--color-s-primary)',
  onPrimary: 'var(--color-s-on-primary)',
  successText: 'var(--color-s-success)',
  fontHeadline: 'var(--font-headline)',
};

export function GoalsPage() {
  const { household } = useHousehold();
  const { canWrite, hasFeature, getUpgradeCopy, maxGoals } = useSubscription();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const allowsMultipleGoals = hasFeature('goals_multiple');
  const activeGoalsCount = goals.filter((goal) => goal.status === 'active').length;
  const canCreateGoal = canWrite && (maxGoals === null || activeGoalsCount < maxGoals);
  const goalsUpgrade = getUpgradeCopy('goals_multiple');

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('household_id', household.id)
      .order('is_primary', { ascending: false });

    setGoals((data || []) as SavingsGoal[]);
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setEditing(null);
    setName('');
    setTarget('');
    setCurrent('0');
    setTargetDate('');
    setMsg('');
    setShowForm(true);
  }, [canCreateGoal]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || !canCreateGoal) return;
    openCreate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateGoal, openCreate, searchParams, setSearchParams]);

  function openEdit(goal: SavingsGoal) {
    setEditing(goal);
    setName(goal.name);
    setTarget(String(goal.target_amount_clp));
    setCurrent(String(goal.current_amount_clp));
    setTargetDate(goal.target_date);
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
      const { error } = await supabase.functions.invoke('manage-goal', {
        body: { action: 'set-primary', goalId: goal.id },
      });
      if (error) throw error;

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
    setActionLoadingId(goal.id);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-goal', {
        body: { action: 'set-status', goalId: goal.id, nextStatus },
      });
      if (error) throw error;

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

    if (!editing && !canCreateGoal) {
      setMsgType('info');
      setMsg('Tu plan actual permite solo una meta activa. Actualiza para trabajar varias metas al mismo tiempo.');
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
      targetAmountClp: parseInt(target, 10),
      currentAmountClp: parseInt(current, 10) || 0,
      targetDate,
    };

    try {
      if (editing) {
        const { error } = await supabase.functions.invoke('manage-goal', {
          body: { action: 'update', goalId: editing.id, ...data },
        });
        if (error) throw error;
        setMsgType('success');
        setMsg('Meta actualizada correctamente.');
      } else {
        const { error } = await supabase.functions.invoke('manage-goal', {
          body: { action: 'create', householdId: household.id, ...data },
        });
        if (error) throw error;
        trackOnce(`first-goal:${household.id}`, 'first_goal_created', { household_id: household.id }, 'local');
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

  const primaryGoal = goals.find((goal) => goal.is_primary && goal.status === 'active');
  const secondaryGoals = goals.filter((goal) => !goal.is_primary || goal.status !== 'active');

  return (
    <div className="app-page max-w-6xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="goals-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Metas</p>
            <h1
              id="goals-title"
              className="mt-3 text-[clamp(1.85rem,2.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-text"
              style={{ fontFamily: C.fontHeadline }}
            >
              Metas de ahorro
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Define una dirección visible para que el ahorro del hogar no quede disperso.
            </p>
          </div>

          {canWrite ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!canCreateGoal}>
              Nueva meta
            </Button>
          ) : null}
        </div>
      </section>

      {msg ? <AlertBanner type={msgType === 'info' ? 'info' : msgType} message={msg} onClose={() => setMsg('')} /> : null}

      {!allowsMultipleGoals && activeGoalsCount >= 1 ? (
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
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen de metas">
        <GoalSignal
          icon={<Layers3 className="h-4 w-4" />}
          label="Metas activas"
          value={String(activeGoalsCount)}
          detail={activeGoalsCount === 1 ? 'Una meta en curso' : `${activeGoalsCount} metas en curso`}
        />
        <GoalSignal
          icon={<Star className="h-4 w-4" />}
          label="Meta principal"
          value={primaryGoal ? primaryGoal.name : 'Sin definir'}
          detail={primaryGoal ? `Objetivo ${formatDateLong(primaryGoal.target_date)}` : 'Aún no hay una meta priorizada'}
          compactValue={!primaryGoal}
        />
        <GoalSignal
          icon={<Target className="h-4 w-4" />}
          label="Capacidad del plan"
          value={maxGoals === null ? 'Sin límite' : `${activeGoalsCount}/${maxGoals}`}
          detail={maxGoals === null ? 'Puedes trabajar varias metas' : 'Free permite una meta activa a la vez'}
        />
      </section>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          eyebrow="Dirección compartida"
          title="Tu ahorro todavía no tiene una meta visible"
          description="Una meta clara convierte la intención del hogar en una decisión concreta."
          secondaryText="Empieza por una sola meta. Después podrás ordenar el resto con más criterio."
          action={canCreateGoal ? { label: 'Crear meta', onClick: openCreate } : undefined}
        />
      ) : null}

      {primaryGoal ? (
        <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="primary-goal-title">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="min-w-0">
              <div className="flex min-h-[28px] items-start justify-between gap-3">
                <span className="inline-flex min-h-8 items-center rounded-full border border-primary/12 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
                  Meta principal
                </span>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Edit2 className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(primaryGoal)}
                    className="shrink-0"
                  >
                    Editar
                  </Button>
                ) : null}
              </div>

              <h2
                id="primary-goal-title"
                className="mt-4 text-[1.9rem] font-semibold tracking-[-0.04em] text-text"
                style={{ fontFamily: C.fontHeadline }}
              >
                {primaryGoal.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
                Esta es la meta que hoy marca la dirección principal del ahorro.
              </p>

              <div className="mt-6 border-t border-border pt-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="metric-label">Progreso actual</p>
                    <p className="mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-text" style={{ fontFamily: C.fontHeadline }}>
                      {formatCLP(primaryGoal.current_amount_clp)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      de {formatCLP(primaryGoal.target_amount_clp)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="metric-label">Cumplimiento</p>
                    <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.035em] text-primary">
                      {primaryGoal.target_amount_clp > 0
                        ? `${Math.round((primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-border-light">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        primaryGoal.target_amount_clp > 0
                          ? (primaryGoal.current_amount_clp / primaryGoal.target_amount_clp) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-text-light" />
                    Objetivo {formatDateLong(primaryGoal.target_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="ui-panel ui-panel-subtle overflow-hidden p-5 shadow-none">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Acciones</p>
              <p className="mt-3 text-base font-semibold tracking-tight text-text">Mantén esta meta al día</p>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                Ajusta el avance, cambia su prioridad o ciérrala cuando deje de guiar el mes.
              </p>

              {canWrite ? (
                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    variant="secondary"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    loading={actionLoadingId === primaryGoal.id}
                    onClick={() => setPendingStatusChange({ goal: primaryGoal, nextStatus: 'completed' })}
                  >
                    Completar meta
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    loading={actionLoadingId === primaryGoal.id}
                    onClick={() => setPendingStatusChange({ goal: primaryGoal, nextStatus: 'cancelled' })}
                  >
                    Cancelar meta
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {secondaryGoals.length > 0 ? (
        <section className="space-y-4" aria-labelledby="secondary-goals-title">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Resto de metas</p>
            <h2 id="secondary-goals-title" className="mt-2 text-[1.55rem] font-semibold tracking-[-0.03em] text-text">
              Otras metas del hogar
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {secondaryGoals.map((goal) => {
              const progress = goal.target_amount_clp > 0 ? Math.min(100, (goal.current_amount_clp / goal.target_amount_clp) * 100) : 0;
              const statusMeta =
                goal.status === 'active'
                  ? { label: 'Activa', tone: 'success' as const }
                  : goal.status === 'completed'
                    ? { label: 'Completada', tone: 'neutral' as const }
                    : { label: 'Cancelada', tone: 'danger' as const };

              return (
                <div key={goal.id} className="ui-panel overflow-hidden p-6">
                  <div className="flex min-h-[28px] items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={goal.is_primary ? 'text-primary' : 'text-text-light'}>
                        {goal.is_primary ? (
                          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            Principal anterior
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                            Meta secundaria
                          </span>
                        )}
                      </span>
                    </div>
                    <GoalStatusBadge tone={statusMeta.tone}>{statusMeta.label}</GoalStatusBadge>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-text">{goal.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      {goal.status === 'active'
                        ? `Meta para ${formatDateLong(goal.target_date)}`
                        : `Sigue visible en el historial del hogar.`}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-border pt-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="metric-label">Ahorro actual</p>
                        <p className="mt-2 text-[1.7rem] font-semibold tracking-[-0.04em] text-text" style={{ fontFamily: C.fontHeadline }}>
                          {formatCLP(goal.current_amount_clp)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="metric-label">Objetivo</p>
                        <p className="mt-2 text-base font-semibold text-text">{formatCLP(goal.target_amount_clp)}</p>
                      </div>
                    </div>

                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-border-light">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: progress >= 100 ? C.successText : C.primary }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
                      <span>{Math.round(progress)}% completado</span>
                      <span>{formatDateLong(goal.target_date)}</span>
                    </div>
                  </div>

                  {canWrite ? (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {goal.status === 'active' && !goal.is_primary ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Star className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === goal.id}
                          onClick={() => void setPrimaryGoal(goal)}
                        >
                          Hacer principal
                        </Button>
                      ) : null}

                      {goal.status === 'active' ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            loading={actionLoadingId === goal.id}
                            onClick={() => setPendingStatusChange({ goal, nextStatus: 'completed' })}
                          >
                            Completar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<XCircle className="h-3.5 w-3.5" />}
                            loading={actionLoadingId === goal.id}
                            onClick={() => setPendingStatusChange({ goal, nextStatus: 'cancelled' })}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                          loading={actionLoadingId === goal.id}
                          disabled={!allowsMultipleGoals && activeGoalsCount >= 1}
                          onClick={() => setPendingStatusChange({ goal, nextStatus: 'active' })}
                        >
                          Reactivar
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => openEdit(goal)}>
                        Editar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar meta' : 'Nueva meta'} size="sm">
        <div className="space-y-5">
          <p className="text-sm leading-7 text-text-muted">
            Define una meta clara y un plazo realista para que el hogar pueda seguirla sin fricción.
          </p>

          <InputField
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder='Ej: "Fondo de emergencia"'
          />
          <InputField
            label="Monto objetivo (CLP)"
            type="number"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <InputField
            label="Ahorrado hasta ahora (CLP)"
            type="number"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <InputField
            label="Fecha objetivo"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Guardar meta' : 'Crear meta'}
            </Button>
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

function GoalSignal({
  icon,
  label,
  value,
  detail,
  compactValue = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  compactValue?: boolean;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className={`mt-3 font-semibold tracking-[-0.035em] text-text ${compactValue ? 'text-xl' : 'text-[1.65rem]'}`}>
            {value}
          </p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function GoalStatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'success' | 'danger' | 'neutral';
}) {
  const classes =
    tone === 'success'
      ? 'bg-success-bg text-success'
      : tone === 'danger'
        ? 'bg-danger-bg text-danger'
        : 'bg-surface-low text-text-muted';

  return (
    <span className={`inline-flex min-h-8 shrink-0 items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${classes}`}>
      {children}
    </span>
  );
}

// ============================================
// Casa Clara — Transactions Page — Stitch M3 Edition
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Button, InputField, SelectField, Modal, EmptyState, ConfirmDialog, AlertBanner } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import type { Transaction, Category } from '../../types/database';
import { Plus, Edit2, Trash2, ArrowUpDown } from 'lucide-react';

// ─── M3 CSS variable aliases ─────────────────────────────────────────────────
const C = {
  surface:              'var(--color-s-surface)',
  surfaceLow:           'var(--color-s-bg)',
  outline:              'var(--color-s-border)',
  onSurface:            'var(--color-s-text)',
  onSurfaceVariant:     'var(--color-s-text-muted)',
  primary:              'var(--color-s-primary)',
  onPrimary:            'var(--color-s-on-primary)',
  primaryContainer:     'var(--color-s-primary)',
  onPrimaryContainer:   'var(--color-s-on-primary)',
  secondaryContainer:   'transparent',
  onSecondaryContainer: 'var(--color-s-primary)',
  error:                'var(--color-s-danger)',
  errorContainer:       'var(--color-s-danger-bg)',
  onErrorContainer:     'var(--color-s-danger)',
  successBg:            'var(--color-s-surface)',
  successText:          'var(--color-s-success)',
  fontHeadline:         'var(--font-headline)',
};

export function TransactionsPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite, hasFeature } = useSubscription();
  const { year, month } = getCurrentMonthYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);

  const [showForm,   setShowForm]   = useState(false);
  const [editingTx,  setEditingTx]  = useState<Transaction | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  // Filters
  const [filterMonth,    setFilterMonth]    = useState(searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`);
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterMember,   setFilterMember]   = useState(searchParams.get('member') || '');
  const [filterType,     setFilterType]     = useState(searchParams.get('type') || '');

  // Form
  const [formType,        setFormType]        = useState<'income' | 'expense'>('expense');
  const [formDesc,        setFormDesc]        = useState('');
  const [formAmount,      setFormAmount]      = useState('');
  const [formCategory,    setFormCategory]    = useState('');
  const [formDate,        setFormDate]        = useState(new Date().toISOString().split('T')[0]);
  const [formScope,       setFormScope]       = useState<'personal' | 'shared'>('shared');
  const [formPaidBy,      setFormPaidBy]      = useState('');
  const [formExpenseType, setFormExpenseType] = useState<'fixed' | 'variable'>('variable');
  const [formNotes,       setFormNotes]       = useState('');
  const [saving,          setSaving]          = useState(false);
  const [msg,             setMsg]             = useState('');
  const [msgType,         setMsgType]         = useState<'success' | 'danger'>('success');

  const canUseCustomCategories = hasFeature('categories_custom');
  const canUseSplitManual      = hasFeature('split_manual');

  const loadData = useCallback(async () => {
    if (!household) return;
    const [y, m] = filterMonth.split('-').map(Number);
    const { start, end } = getMonthRange(y, m);

    const [txRes, catRes] = await Promise.all([
      supabase.from('transactions').select('*')
        .eq('household_id', household.id)
        .gte('occurred_on', start).lte('occurred_on', end)
        .is('deleted_at', null)
        .order('occurred_on', { ascending: false }),
      supabase.from('categories').select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
    ]);

    setTransactions((txRes.data || []) as Transaction[]);
    setCategories((catRes.data || []) as Category[]);
  }, [household, filterMonth]);

  useEffect(() => { if (currentMember) setFormPaidBy(currentMember.id); }, [currentMember]);

  useEffect(() => {
    setFilterMonth(searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`);
    setFilterCategory(searchParams.get('category') || '');
    setFilterMember(searchParams.get('member') || '');
    setFilterType(searchParams.get('type') || '');
  }, [month, searchParams, year]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filtered = transactions.filter(t => {
    if (filterCategory && t.category_id !== filterCategory) return false;
    if (filterMember   && t.paid_by_member_id !== filterMember) return false;
    if (filterType     && t.type !== filterType) return false;
    return true;
  });

  const totalIncome   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);
  const availableCategories = categories.filter(c => canUseCustomCategories || c.is_default || c.id === formCategory);

  const openCreate = useCallback(() => {
    setEditingTx(null);
    setFormType('expense');
    setFormDesc('');
    setFormAmount('');
    setFormCategory('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormScope('shared');
    setFormPaidBy(currentMember?.id || '');
    setFormExpenseType('variable');
    setFormNotes('');
    setShowForm(true);
  }, [currentMember?.id]);

  useEffect(() => {
    const createIntent = searchParams.get('create');
    if (!createIntent || !canWrite) return;
    openCreate();
    if (createIntent === 'income' || createIntent === 'expense') setFormType(createIntent);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canWrite, openCreate, searchParams, setSearchParams]);

  function openEdit(tx: Transaction) {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormDesc(tx.description);
    setFormAmount(String(tx.amount_clp));
    setFormCategory(tx.category_id || '');
    setFormDate(tx.occurred_on);
    setFormScope(tx.scope);
    setFormPaidBy(tx.paid_by_member_id);
    setFormExpenseType(tx.expense_type || 'variable');
    setFormNotes(tx.notes || '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!household || !currentMember) return;
    if (!formDesc.trim() || !formAmount || !formDate || !formPaidBy) {
      setMsgType('danger');
      setMsg(formType === 'income'
        ? 'Completa concepto, monto, fecha y quien lo recibio.'
        : 'Completa descripcion, monto, fecha y quien pago.');
      return;
    }

    setSaving(true);
    setMsg('');

    const data = {
      householdId: household.id,
      type: formType,
      paid_by_member_id: formPaidBy,
      scope: formScope,
      amountClp: parseInt(formAmount, 10),
      categoryId: formType === 'expense' ? formCategory || null : null,
      description: formDesc,
      occurredOn: formDate,
      expenseType: formType === 'expense' ? formExpenseType : null,
      paidByMemberId: formPaidBy,
      notes: formNotes || null,
    };

    try {
      if (editingTx) {
        const { error } = await supabase.functions.invoke('manage-transaction', {
          body: {
            action: 'update',
            transactionId: editingTx.id,
            type: formType,
            description: formDesc,
            amountClp: parseInt(formAmount, 10),
            categoryId: formType === 'expense' ? formCategory || null : null,
            occurredOn: formDate,
            paidByMemberId: formPaidBy,
            scope: formScope,
            expenseType: formType === 'expense' ? formExpenseType : null,
            notes: formNotes || null,
          },
        });
        if (error) throw error;
        setMsgType('success');
        setMsg(formType === 'income' ? 'Ingreso actualizado correctamente.' : 'Gasto actualizado correctamente.');
      } else {
        const { error } = await supabase.functions.invoke('manage-transaction', { body: { action: 'create', ...data } });
        if (error) throw error;
        trackOnce(`first-transaction:${household.id}`, 'first_transaction_created', { household_id: household.id, type: formType }, 'local');
        setMsgType('success');
        setMsg(formType === 'income' ? 'Ingreso creado correctamente.' : 'Gasto creado correctamente.');
      }
      setShowForm(false);
      await loadData();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error
        ? error.message
        : formType === 'income' ? 'No pudimos guardar el ingreso.' : 'No pudimos guardar el gasto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.functions.invoke('manage-transaction', {
        body: { action: 'delete', transactionId: deleteId },
      });
      if (error) throw error;
      setMsgType('success');
      setMsg('Movimiento eliminado correctamente.');
      setDeleteId(null);
      await loadData();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos eliminar el movimiento.');
    }
  }

  const getMemberName   = (id: string)       => members.find(mb => mb.id === id)?.display_name || '—';
  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';
  const getCategoryIcon = (id: string | null) => categories.find(c => c.id === id)?.icon || '📦';

  const [y, m] = filterMonth.split('-').map(Number);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
            Movimientos
          </h1>
          <p className="mt-1 text-sm" style={{ color: C.onSurfaceVariant }}>
            Aquí se arma la lectura real del mes. {formatMonthYear(y, m)}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer hover:opacity-90"
            style={{ background: C.primary, color: C.onPrimary }}
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        )}
      </div>

      {/* ── Alerts ───────────────────────────────────────── */}
      {msg && <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />}
      {!canUseSplitManual && (
        <AlertBanner
          type="info"
          message="En Free registras movimientos básicos. El reparto manual y quién pagó qué se habilitan desde Esencial."
        />
      )}

      {/* ── Summary cards ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <TxSummaryCard label="Ingresos" value={formatCLP(totalIncome)} tone="success" />
        <TxSummaryCard label="Gastos"   value={formatCLP(totalExpenses)} tone="danger" />
        <TxSummaryCard
          label="Balance"
          value={formatCLP(totalIncome - totalExpenses)}
          tone={totalIncome - totalExpenses >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="py-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InputField label="Mes" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          <SelectField label="Categoría" value={filterCategory} onChange={setFilterCategory}
            options={[{ value: '', label: 'Todas' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
          <SelectField label="Miembro" value={filterMember} onChange={setFilterMember}
            options={[{ value: '', label: 'Todos' }, ...members.map(mb => ({ value: mb.id, label: mb.display_name }))]} />
          <SelectField label="Tipo" value={filterType} onChange={setFilterType}
            options={[{ value: '', label: 'Todos' }, { value: 'income', label: 'Ingresos' }, { value: 'expense', label: 'Gastos' }]} />
        </div>
      </div>

      {/* ── Transactions table ───────────────────────────── */}
      <div className="overflow-hidden bg-transparent">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowUpDown className="h-8 w-8" />}
            eyebrow="Lectura inicial"
            title="Todavía no hay movimientos en este período"
            description="Cuando registres ingresos o gastos, esta vista empezará a mostrar cómo se está moviendo el hogar."
            secondaryText="El primer movimiento ya sirve para convertir intuición en una referencia concreta."
            action={canWrite ? { label: 'Registrar movimiento', onClick: openCreate } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.outline}` }}>
                  {['Fecha', 'Descripción', 'Categoría', 'Pagó', 'Tipo', 'Monto'].map(h => (
                    <th
                      key={h}
                      className={`py-3 px-4 font-medium text-xs uppercase tracking-wider ${h === 'Monto' ? 'text-right' : 'text-left'}`}
                      style={{ color: C.onSurfaceVariant }}
                    >
                      {h}
                    </th>
                  ))}
                  {canWrite && <th className="py-3 px-4" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} className="transition-colors hover:bg-black/5" style={{ borderBottom: `1px solid ${C.outline}` }}>
                    <td className="py-3 px-4 text-xs" style={{ color: C.onSurfaceVariant }}>
                      {formatDate(tx.occurred_on)}
                    </td>
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center flex-wrap gap-3">
                        <span className="font-medium shrink-0" style={{ color: C.onSurface }}>{tx.description}</span>
                        {tx.scope === 'shared' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                            style={{ background: C.primaryContainer, color: C.onPrimaryContainer }}>
                            compartido
                          </span>
                        )}
                        {tx.is_recurring_instance && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-border"
                            style={{ background: C.secondaryContainer, color: C.onSurfaceVariant }}>
                            recurrente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: C.onSurfaceVariant }}>
                      {getCategoryIcon(tx.category_id)} {getCategoryName(tx.category_id)}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: C.onSurfaceVariant }}>
                      {getMemberName(tx.paid_by_member_id)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={tx.type === 'income'
                          ? { background: C.successBg, color: C.successText }
                          : { background: C.errorContainer, color: C.onErrorContainer }
                        }
                      >
                        {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold"
                      style={{ color: tx.type === 'income' ? C.successText : C.onSurface }}>
                      {tx.type === 'income' ? '+' : '-'}{formatCLP(tx.amount_clp)}
                    </td>
                    {canWrite && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <button type="button" onClick={() => openEdit(tx)}
                            className="p-2 rounded-xl transition hover:bg-black/10 cursor-pointer"
                            style={{ color: C.primary }} title="Editar">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Form Modal ───────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingTx
          ? (formType === 'income' ? 'Editar ingreso' : 'Editar gasto')
          : (formType === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto')}
        size="lg"
      >
        <div className="space-y-10">
          <div className="flex justify-center">
            <div className="flex gap-3 p-1.5 bg-black/5 rounded-[2rem] w-full max-w-sm">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => setFormType(t)}
                  className="flex-1 py-3 text-sm font-bold rounded-[1.6rem] transition-all cursor-pointer shadow-sm border border-transparent"
                  style={formType === t
                    ? t === 'income'
                      ? { background: C.successBg, color: C.successText, border: `1px solid ${C.successBg}` }
                      : { background: C.errorContainer, color: C.onErrorContainer, border: `1px solid ${C.errorContainer}` }
                    : { background: 'transparent', color: C.onSurfaceVariant, border: `1px solid transparent`, boxShadow: 'none' }
                  }
                >
                  {t === 'income' ? 'Ingreso' : 'Gasto'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
            <InputField
              label={formType === 'income' ? 'Origen o concepto' : 'Descripción'}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder={formType === 'income' ? 'Ej: Sueldo' : 'Ej: Supermercado Líder'}
            />
            <InputField label="Monto (CLP)" type="number" value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              placeholder={formType === 'income' ? 'Ej: 1200000' : 'Ej: 45000'} />
            
            <div className="grid grid-cols-2 gap-6">
              {formType === 'expense' ? (
                <SelectField label="Categoría" value={formCategory} onChange={setFormCategory} placeholder="Seleccionar"
                  options={availableCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
              ) : (
                <InputField label="Fecha" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              )}
              {formType === 'expense' ? (
                <InputField label="Fecha" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              ) : (
                <SelectField label="Destino" value={formScope} onChange={v => setFormScope(v as 'personal' | 'shared')}
                  options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]} />
              )}
            </div>

            {canUseSplitManual ? (
              <div className="grid grid-cols-2 gap-6">
                <SelectField label={formType === 'income' ? '¿Quién lo recibió?' : '¿Quién pagó?'} value={formPaidBy} onChange={setFormPaidBy}
                  options={members.map(mb => ({ value: mb.id, label: mb.display_name }))} />
                {formType === 'expense' ? (
                  <SelectField label="Alcance" value={formScope} onChange={v => setFormScope(v as 'personal' | 'shared')}
                    options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]} />
                ) : <div />}
              </div>
            ) : (
              <AlertBanner
                type="info"
                message={formType === 'income'
                  ? 'El ingreso quedará asociado al miembro que lo registra.'
                  : 'El gasto quedará asociado al miembro que lo registra y como compartido por defecto.'}
              />
            )}

            {formType === 'expense' && canUseSplitManual && (
              <SelectField label="Tipo de gasto" value={formExpenseType} onChange={v => setFormExpenseType(v as 'fixed' | 'variable')}
                options={[{ value: 'variable', label: 'Variable' }, { value: 'fixed', label: 'Fijo' }]} />
            )}
            
            <InputField label="Notas (opcional)" value={formNotes}
              onChange={e => setFormNotes(e.target.value)} placeholder="Notas adicionales..." />
          </div>
          {editingTx?.is_recurring_instance && (
            <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
              Si este gasto viene de una recurrencia o pago programado, los cambios mantendrán ese enlace actualizado.
            </p>
          )}
          <div className="flex flex-col items-center gap-10 pt-10 border-t border-border/40 mt-14">
            <div className="flex items-center justify-center gap-6 w-full">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="min-w-[140px]">
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving} className="min-w-[180px]">
                {editingTx 
                  ? (formType === 'income' ? 'Guardar ingreso' : 'Guardar gasto')
                  : (formType === 'income' ? 'Crear ingreso' : 'Crear gasto')}
              </Button>
            </div>
            
            {editingTx && (
              <button
                type="button"
                onClick={() => { setShowForm(false); setDeleteId(editingTx.id); }}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-danger/60 hover:text-danger hover:bg-danger/5 rounded-full transition-all cursor-pointer opacity-70 hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar este movimiento definitivamente
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ───────────────────────────────── */}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Eliminar movimiento"
        message="¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar" />
    </div>
  );
}

// ─── Local sub-component ─────────────────────────────────────────────────────
function TxSummaryCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'neutral' }) {
  const styles = {
    success: { bg: 'var(--color-s-surface)', color: 'var(--color-s-primary)' },
    danger:  { bg: 'var(--color-s-surface)', color: 'var(--color-s-danger)' },
    neutral: { bg: 'var(--color-s-surface-muted)', color: 'var(--color-s-text)' },
  };
  const s = styles[tone];
  return (
    <div className="px-5 py-5 flex flex-col justify-center" style={{ background: s.bg }}>
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-70" style={{ color: 'var(--color-s-text-light)' }}>{label}</p>
      <p className="mt-2 text-3xl font-light tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: s.color }}>{value}</p>
    </div>
  );
}

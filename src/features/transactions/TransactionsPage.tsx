// ============================================
// Casa Clara — Transactions Page (CRUD + Filters)
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, SelectField, Modal, EmptyState, ConfirmDialog, AlertBanner } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, getCurrentMonthYear, getMonthRange, formatMonthYear } from '../../utils/dates-chile';
import type { Transaction, Category } from '../../types/database';
import { Plus, Edit2, Trash2, ArrowUpDown } from 'lucide-react';

export function TransactionsPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite } = useSubscription();
  const { year, month } = getCurrentMonthYear();
  const [searchParams] = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`);
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterMember, setFilterMember] = useState(searchParams.get('member') || '');
  const [filterType, setFilterType] = useState(searchParams.get('type') || '');

  // Form
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formScope, setFormScope] = useState<'personal' | 'shared'>('shared');
  const [formPaidBy, setFormPaidBy] = useState('');
  const [formExpenseType, setFormExpenseType] = useState<'fixed' | 'variable'>('variable');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');

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

  useEffect(() => {
    if (currentMember) setFormPaidBy(currentMember.id);
  }, [currentMember]);

  useEffect(() => {
    setFilterMonth(searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`);
    setFilterCategory(searchParams.get('category') || '');
    setFilterMember(searchParams.get('member') || '');
    setFilterType(searchParams.get('type') || '');
  }, [month, searchParams, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = transactions.filter(t => {
    if (filterCategory && t.category_id !== filterCategory) return false;
    if (filterMember && t.paid_by_member_id !== filterMember) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_clp, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_clp, 0);

  function openCreate() {
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
  }

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
      household_id: household.id,
      created_by: currentMember.user_id!,
      type: formType,
      paid_by_member_id: formPaidBy,
      scope: formScope,
      assigned_to_member_id: null,
      amount_clp: parseInt(formAmount),
      category_id: formType === 'expense' ? formCategory || null : null,
      description: formDesc,
      occurred_on: formDate,
      expense_type: formType === 'expense' ? formExpenseType : null,
      is_recurring_instance: false,
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
        setMsg(formType === 'income'
          ? 'Ingreso actualizado correctamente.'
          : 'Gasto actualizado correctamente.');
      } else {
        const { error } = await supabase.from('transactions').insert(data);
        if (error) throw error;
        setMsgType('success');
        setMsg(formType === 'income'
          ? 'Ingreso creado correctamente.'
          : 'Gasto creado correctamente.');
      }

      setShowForm(false);
      await loadData();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error
        ? error.message
        : formType === 'income'
          ? 'No pudimos guardar el ingreso.'
          : 'No pudimos guardar el gasto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.functions.invoke('manage-transaction', {
        body: {
          action: 'delete',
          transactionId: deleteId,
        },
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

  const getMemberName = (id: string) => members.find(m => m.id === id)?.display_name || '—';
  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';
  const getCategoryIcon = (id: string | null) => categories.find(c => c.id === id)?.icon || '📦';

  const [y, m] = filterMonth.split('-').map(Number);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Movimientos</h1>
          <p className="text-sm text-text-muted">{formatMonthYear(y, m)}</p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuevo
          </Button>
        )}
      </div>

      {msg && (
        <div className="mb-6">
          <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="sm">
          <p className="text-xs text-text-muted">Ingresos</p>
          <p className="text-lg font-bold text-success">{formatCLP(totalIncome)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-text-muted">Gastos</p>
          <p className="text-lg font-bold text-danger">{formatCLP(totalExpenses)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-text-muted">Balance</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCLP(totalIncome - totalExpenses)}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InputField label="Mes" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          <SelectField label="Categoría" value={filterCategory} onChange={setFilterCategory}
            options={[{ value: '', label: 'Todas' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
          <SelectField label="Miembro" value={filterMember} onChange={setFilterMember}
            options={[{ value: '', label: 'Todos' }, ...members.map(m => ({ value: m.id, label: m.display_name }))]} />
          <SelectField label="Tipo" value={filterType} onChange={setFilterType}
            options={[{ value: '', label: 'Todos' }, { value: 'income', label: 'Ingresos' }, { value: 'expense', label: 'Gastos' }]} />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {filtered.length === 0 ? (
          <EmptyState icon={<ArrowUpDown className="h-8 w-8" />} title="Sin movimientos" description="No hay movimientos para este período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Descripción</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Categoría</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Pagó</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Tipo</th>
                  <th className="text-right py-3 px-4 font-medium text-text-muted">Monto</th>
                  {canWrite && <th className="py-3 px-4"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} className="border-b border-border-light hover:bg-surface-hover transition-colors">
                    <td className="py-3 px-4 text-text-muted">{formatDate(tx.occurred_on)}</td>
                    <td className="py-3 px-4">
                      <span className="text-text">{tx.description}</span>
                      {tx.scope === 'shared' && <span className="ml-1.5 text-xs text-primary">compartido</span>}
                      {tx.is_recurring_instance && <span className="ml-1.5 text-xs text-warning">recurrente</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{getCategoryIcon(tx.category_id)} {getCategoryName(tx.category_id)}</td>
                    <td className="py-3 px-4 text-text-secondary">{getMemberName(tx.paid_by_member_id)}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${tx.type === 'income' ? 'text-success' : 'text-text'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCLP(tx.amount_clp)}
                    </td>
                    {canWrite && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => openEdit(tx)}>
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} className="text-danger hover:bg-danger-bg" onClick={() => setDeleteId(tx.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingTx
          ? (formType === 'income' ? 'Editar ingreso' : 'Editar gasto')
          : (formType === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => setFormType(t)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  formType === t ? (t === 'income' ? 'bg-success-bg border-success text-success' : 'bg-danger-bg border-danger text-danger') : 'border-border text-text-muted'
                }`}>
                {t === 'income' ? 'Ingreso' : 'Gasto'}
              </button>
            ))}
          </div>
          <InputField
            label={formType === 'income' ? 'Origen o concepto' : 'Descripción'}
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder={formType === 'income' ? 'Ej: Sueldo' : 'Ej: Supermercado Líder'}
          />
          <InputField
            label="Monto (CLP)"
            type="number"
            value={formAmount}
            onChange={e => setFormAmount(e.target.value)}
            placeholder={formType === 'income' ? 'Ej: 1200000' : 'Ej: 45000'}
          />
          <div className="grid grid-cols-2 gap-4">
            {formType === 'expense' ? (
              <SelectField label="Categoría" value={formCategory} onChange={setFormCategory} placeholder="Seleccionar"
                options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
            ) : (
              <InputField
                label="Fecha"
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            )}
            {formType === 'expense' ? (
              <InputField label="Fecha" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            ) : (
              <SelectField
                label="Destino"
                value={formScope}
                onChange={v => setFormScope(v as 'personal' | 'shared')}
                options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label={formType === 'income' ? '¿Quién lo recibió?' : '¿Quién pagó?'} value={formPaidBy} onChange={setFormPaidBy}
              options={members.map(m => ({ value: m.id, label: m.display_name }))} />
            {formType === 'expense' ? (
              <SelectField label="Alcance" value={formScope} onChange={v => setFormScope(v as 'personal' | 'shared')}
                options={[{ value: 'shared', label: 'Compartido' }, { value: 'personal', label: 'Personal' }]} />
            ) : (
              <div />
            )}
          </div>
          {formType === 'expense' && (
            <SelectField label="Tipo de gasto" value={formExpenseType} onChange={v => setFormExpenseType(v as 'fixed' | 'variable')}
              options={[{ value: 'variable', label: 'Variable' }, { value: 'fixed', label: 'Fijo' }]} />
          )}
          <InputField label="Notas (opcional)" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notas adicionales..." />
          {editingTx?.is_recurring_instance && (
            <p className="text-xs text-text-muted">
              Si este gasto viene de una recurrencia o pago programado, los cambios mantendrán ese enlace actualizado.
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingTx
                ? (formType === 'income' ? 'Guardar ingreso' : 'Guardar gasto')
                : (formType === 'income' ? 'Crear ingreso' : 'Crear gasto')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Eliminar movimiento" message="¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer." confirmLabel="Eliminar" />
    </div>
  );
}

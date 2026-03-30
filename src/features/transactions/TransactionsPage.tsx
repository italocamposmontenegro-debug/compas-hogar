import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import {
  AlertBanner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  InputField,
  Modal,
  SelectField,
  Tabs,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { trackOnce } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';
import { formatDate, formatMonthYear, getCurrentMonthYear, getMonthRange } from '../../utils/dates-chile';
import type { Category, Transaction } from '../../types/database';
import {
  ArrowUpDown,
  CalendarDays,
  CircleDollarSign,
  Edit2,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const C = {
  onSurface: 'var(--color-s-text)',
  onSurfaceVariant: 'var(--color-s-text-muted)',
  primary: 'var(--color-s-primary)',
  successText: 'var(--color-s-success)',
  danger: 'var(--color-s-danger)',
  fontHeadline: 'var(--font-headline)',
};

export function TransactionsPage() {
  const { household, members, currentMember } = useHousehold();
  const { canWrite, hasFeature } = useSubscription();
  const navigate = useNavigate();
  const { year, month } = getCurrentMonthYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') || `${year}-${String(month).padStart(2, '0')}`);
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterMember, setFilterMember] = useState(searchParams.get('member') || '');
  const [filterType, setFilterType] = useState(searchParams.get('type') || '');

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

  const canUseCustomCategories = hasFeature('categories_custom');
  const canUseSplitManual = hasFeature('split_manual');

  const loadData = useCallback(async () => {
    if (!household) return;
    const [selectedYear, selectedMonth] = filterMonth.split('-').map(Number);
    const { start, end } = getMonthRange(selectedYear, selectedMonth);

    const [txRes, catRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', household.id)
        .gte('occurred_on', start)
        .lte('occurred_on', end)
        .is('deleted_at', null)
        .order('occurred_on', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
    ]);

    setTransactions((txRes.data || []) as Transaction[]);
    setCategories((catRes.data || []) as Category[]);
  }, [filterMonth, household]);

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

  const filtered = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (filterCategory && transaction.category_id !== filterCategory) return false;
        if (filterMember && transaction.paid_by_member_id !== filterMember) return false;
        if (filterType && transaction.type !== filterType) return false;
        return true;
      }),
    [filterCategory, filterMember, filterType, transactions],
  );

  const totalIncome = filtered.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const totalExpenses = filtered.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount_clp, 0);
  const availableCategories = categories.filter((category) => canUseCustomCategories || category.is_default || category.id === formCategory);
  const currentMonthLabel = (() => {
    const [selectedYear, selectedMonth] = filterMonth.split('-').map(Number);
    return formatMonthYear(selectedYear, selectedMonth);
  })();

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

  const closeForm = useCallback(() => {
    setShowForm(false);
  }, []);

  useEffect(() => {
    const createIntent = searchParams.get('create');
    if (!createIntent || !canWrite) return;
    openCreate();
    if (createIntent === 'income' || createIntent === 'expense') setFormType(createIntent);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [canWrite, openCreate, searchParams, setSearchParams]);

  function openEdit(transaction: Transaction) {
    setEditingTx(transaction);
    setFormType(transaction.type);
    setFormDesc(transaction.description);
    setFormAmount(String(transaction.amount_clp));
    setFormCategory(transaction.category_id || '');
    setFormDate(transaction.occurred_on);
    setFormScope(transaction.scope);
    setFormPaidBy(transaction.paid_by_member_id);
    setFormExpenseType(transaction.expense_type || 'variable');
    setFormNotes(transaction.notes || '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!household || !currentMember) return;
    if (!formDesc.trim() || !formAmount || !formDate || !formPaidBy) {
      setMsgType('danger');
      setMsg(
        formType === 'income'
          ? 'Completa concepto, monto, fecha y quién recibió el ingreso.'
          : 'Completa descripción, monto, fecha y quién pagó el gasto.',
      );
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
        const { error } = await supabase.functions.invoke('manage-transaction', {
          body: { action: 'create', ...data },
        });
        if (error) throw error;
        trackOnce(`first-transaction:${household.id}`, 'first_transaction_created', { household_id: household.id, type: formType }, 'local');
        setMsgType('success');
        setMsg(formType === 'income' ? 'Ingreso creado correctamente.' : 'Gasto creado correctamente.');
      }
      closeForm();
      await loadData();
    } catch (error) {
      setMsgType('danger');
      setMsg(
        error instanceof Error
          ? error.message
          : formType === 'income'
            ? 'No pudimos guardar el ingreso.'
            : 'No pudimos guardar el gasto.',
      );
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

  const getMemberName = (id: string) => members.find((member) => member.id === id)?.display_name || '—';
  const getCategoryName = (id: string | null) => categories.find((category) => category.id === id)?.name || '—';

  return (
    <div className="app-page max-w-7xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="transactions-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Movimientos</p>
            <h1
              id="transactions-title"
              className="mt-3 text-[clamp(1.85rem,2.5vw,2.45rem)] font-semibold tracking-[-0.04em] text-text"
              style={{ fontFamily: C.fontHeadline }}
            >
              Registro del mes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Para gastos e ingresos puntuales. Si algo se repite cada mes, conviene llevarlo a Recurrencias.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate('/app/recurrencias')}>
              Ver recurrencias
            </Button>
            {canWrite ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Registrar movimiento
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {msg ? <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} /> : null}

      {!canUseSplitManual ? (
        <AlertBanner
          type="info"
          message="En Free registras movimientos básicos. El reparto manual y quién pagó qué se habilitan desde Esencial."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen financiero del período">
        <TxSummaryCard
          label="Ingresos"
          value={formatCLP(totalIncome)}
          note="Entradas registradas"
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <TxSummaryCard
          label="Gastos"
          value={formatCLP(totalExpenses)}
          note="Salidas registradas"
          tone="danger"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <TxSummaryCard
          label="Balance"
          value={formatCLP(totalIncome - totalExpenses)}
          note="Resultado del período"
          tone={totalIncome - totalExpenses >= 0 ? 'neutral' : 'danger'}
          icon={<Wallet className="h-4 w-4" />}
        />
      </section>

      <Card padding="lg">
        <div className="flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Filtros</p>
            <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">Ajusta la lectura del período</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Filtra por mes, categoría, miembro o tipo sin perder contexto.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InputField
              label="Mes"
              type="month"
              value={filterMonth}
              onChange={(event) => setFilterMonth(event.target.value)}
            />
            <SelectField
              label="Categoría"
              value={filterCategory}
              onChange={setFilterCategory}
              options={[{ value: '', label: 'Todas' }, ...categories.map((category) => ({ value: category.id, label: `${category.icon} ${category.name}` }))]}
            />
            <SelectField
              label="Miembro"
              value={filterMember}
              onChange={setFilterMember}
              options={[{ value: '', label: 'Todos' }, ...members.map((member) => ({ value: member.id, label: member.display_name }))]}
            />
            <SelectField
              label="Tipo"
              value={filterType}
              onChange={setFilterType}
              options={[
                { value: '', label: 'Todos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'expense', label: 'Gastos' },
              ]}
            />
          </div>
        </div>
      </Card>

      <section className="ui-panel overflow-hidden" aria-labelledby="transactions-list-title">
        <div className="border-b border-border-light px-6 py-5 lg:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Movimientos visibles</p>
              <h2 id="transactions-list-title" className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">
                {currentMonthLabel}
              </h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                {filtered.length === 0
                  ? 'Todavía no hay movimientos con estos filtros.'
                  : `${filtered.length} movimiento(s) listos para revisar o editar.`}
              </p>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-6 sm:px-6 lg:px-7">
            <EmptyState
              icon={<ArrowUpDown className="h-8 w-8" />}
              eyebrow="Lectura inicial"
              title="Aún no hay movimientos"
              description="Registra aquí gastos o ingresos puntuales."
              secondaryText="Si un pago se repite cada mes, llévalo a Recurrencias para no ingresarlo desde cero cada vez."
              action={canWrite ? { label: 'Registrar movimiento', onClick: openCreate } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {filtered.map((transaction) => (
                <TransactionMobileCard
                  key={transaction.id}
                  transaction={transaction}
                  categoryName={getCategoryName(transaction.category_id)}
                  memberName={getMemberName(transaction.paid_by_member_id)}
                  canWrite={canWrite}
                  onEdit={() => openEdit(transaction)}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-border-light">
                    {['Fecha', 'Descripción', 'Categoría', 'Pagó', 'Tipo', 'Monto'].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className={`px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-light ${header === 'Monto' ? 'text-right' : 'text-left'}`}
                      >
                        {header}
                      </th>
                    ))}
                    {canWrite ? <th scope="col" className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-text-light">Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border-light/80 last:border-b-0">
                      <td className="px-6 py-5 text-sm text-text-muted">{formatDate(transaction.occurred_on)}</td>
                      <td className="px-6 py-5 align-top">
                        <div className="min-w-[220px]">
                          <p className="text-sm font-semibold text-text">{transaction.description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ScopeBadge shared={transaction.scope === 'shared'} />
                            {transaction.is_recurring_instance ? <InlineChip tone="muted">Recurrente</InlineChip> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-text-secondary">{getCategoryName(transaction.category_id)}</td>
                      <td className="px-6 py-5 text-sm text-text-secondary">{getMemberName(transaction.paid_by_member_id)}</td>
                      <td className="px-6 py-5">
                        <TypeBadge type={transaction.type} />
                      </td>
                      <td className={`px-6 py-5 text-right text-base font-semibold tracking-tight ${transaction.type === 'income' ? 'text-success' : 'text-text'}`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCLP(transaction.amount_clp)}
                      </td>
                      {canWrite ? (
                        <td className="px-6 py-5 text-right">
                          <Button size="sm" variant="ghost" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => openEdit(transaction)}>
                            Editar
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={
          editingTx
            ? formType === 'income'
              ? 'Editar ingreso'
              : 'Editar gasto'
            : formType === 'income'
              ? 'Nuevo ingreso'
              : 'Nuevo gasto'
        }
        size="lg"
      >
        <div className="space-y-6">
          <p className="max-w-2xl text-sm leading-7 text-text-muted">
            Registra solo lo necesario para que el hogar lea el mes sin ruido.
          </p>

          <Tabs
            tabs={[
              { id: 'expense', label: 'Gasto' },
              { id: 'income', label: 'Ingreso' },
            ]}
            activeTab={formType}
            onChange={(value) => setFormType(value as 'income' | 'expense')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label={formType === 'income' ? 'Origen o concepto' : 'Descripción'}
              value={formDesc}
              onChange={(event) => setFormDesc(event.target.value)}
              placeholder={formType === 'income' ? 'Ej: Sueldo' : 'Ej: Supermercado'}
            />
            <InputField
              label="Monto (CLP)"
              type="number"
              value={formAmount}
              onChange={(event) => setFormAmount(event.target.value)}
              placeholder={formType === 'income' ? 'Ej: 1200000' : 'Ej: 45000'}
            />
            {formType === 'expense' ? (
              <SelectField
                label="Categoría"
                value={formCategory}
                onChange={setFormCategory}
                placeholder="Seleccionar"
                options={availableCategories.map((category) => ({ value: category.id, label: `${category.icon} ${category.name}` }))}
              />
            ) : (
              <SelectField
                label="Destino"
                value={formScope}
                onChange={(value) => setFormScope(value as 'personal' | 'shared')}
                options={[
                  { value: 'shared', label: 'Compartido' },
                  { value: 'personal', label: 'Personal' },
                ]}
              />
            )}
            <InputField label="Fecha" type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} />
          </div>

          {canUseSplitManual ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={formType === 'income' ? 'Quién recibió el ingreso' : 'Quién pagó'}
                value={formPaidBy}
                onChange={setFormPaidBy}
                options={members.map((member) => ({ value: member.id, label: member.display_name }))}
              />
              {formType === 'expense' ? (
                <SelectField
                  label="Alcance"
                  value={formScope}
                  onChange={(value) => setFormScope(value as 'personal' | 'shared')}
                  options={[
                    { value: 'shared', label: 'Compartido' },
                    { value: 'personal', label: 'Personal' },
                  ]}
                />
              ) : (
                <InputField label="Notas (opcional)" value={formNotes} onChange={(event) => setFormNotes(event.target.value)} />
              )}
            </div>
          ) : (
            <AlertBanner
              type="info"
              message={
                formType === 'income'
                  ? 'El ingreso quedará asociado al miembro que lo registra.'
                  : 'El gasto quedará asociado al miembro que lo registra y como compartido por defecto.'
              }
            />
          )}

          {formType === 'expense' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {canUseSplitManual ? (
                <SelectField
                  label="Tipo de gasto"
                  value={formExpenseType}
                  onChange={(value) => setFormExpenseType(value as 'fixed' | 'variable')}
                  options={[
                    { value: 'variable', label: 'Variable' },
                    { value: 'fixed', label: 'Fijo' },
                  ]}
                />
              ) : (
                <InputField label="Tipo de gasto" value="Variable" onChange={() => {}} readOnly />
              )}
              <InputField label="Notas (opcional)" value={formNotes} onChange={(event) => setFormNotes(event.target.value)} />
            </div>
          ) : null}

          {editingTx?.is_recurring_instance ? (
            <AlertBanner
              type="info"
              message="Si este movimiento viene de una recurrencia o pago programado, los cambios mantendrán ese enlace actualizado."
            />
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border-light pt-5">
            {editingTx ? (
              <div className="flex justify-start">
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-danger hover:border-danger/10 hover:bg-danger-bg hover:text-danger"
                  onClick={() => {
                    closeForm();
                    setDeleteId(editingTx.id);
                  }}
                >
                  Eliminar movimiento
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingTx
                  ? formType === 'income'
                    ? 'Guardar ingreso'
                    : 'Guardar gasto'
                  : formType === 'income'
                    ? 'Crear ingreso'
                    : 'Crear gasto'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar movimiento"
        message="Esta acción quitará el movimiento de la lectura del hogar. Úsala solo si el registro está mal o ya no corresponde."
        confirmLabel="Eliminar"
      />
    </div>
  );
}

function TxSummaryCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'success' | 'danger' | 'neutral';
  icon: ReactNode;
}) {
  const valueClass =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text';

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className={`mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] ${valueClass}`} style={{ fontFamily: C.fontHeadline }}>
            {value}
          </p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{note}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ScopeBadge({ shared }: { shared: boolean }) {
  if (!shared) return <InlineChip tone="muted">Personal</InlineChip>;
  return <InlineChip tone="primary">Compartido</InlineChip>;
}

function TypeBadge({ type }: { type: Transaction['type'] }) {
  return (
    <InlineChip tone={type === 'income' ? 'success' : 'danger'}>
      {type === 'income' ? 'Ingreso' : 'Gasto'}
    </InlineChip>
  );
}

function InlineChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'primary' | 'success' | 'danger' | 'muted';
}) {
  const classes =
    tone === 'primary'
      ? 'bg-primary/8 text-primary'
      : tone === 'success'
        ? 'bg-success-bg text-success'
        : tone === 'danger'
          ? 'bg-danger-bg text-danger'
          : 'bg-surface-low text-text-muted';

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${classes}`}>
      {children}
    </span>
  );
}

function TransactionMobileCard({
  transaction,
  categoryName,
  memberName,
  canWrite,
  onEdit,
}: {
  transaction: Transaction;
  categoryName: string;
  memberName: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="ui-panel overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-text">{transaction.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypeBadge type={transaction.type} />
            <ScopeBadge shared={transaction.scope === 'shared'} />
            {transaction.is_recurring_instance ? <InlineChip tone="muted">Recurrente</InlineChip> : null}
          </div>
        </div>
        {canWrite ? (
          <Button size="sm" variant="ghost" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={onEdit}>
            Editar
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MobileDetail label="Monto" value={`${transaction.type === 'income' ? '+' : '-'}${formatCLP(transaction.amount_clp)}`} valueTone={transaction.type === 'income' ? 'success' : 'danger'} />
        <MobileDetail label="Fecha" value={formatDate(transaction.occurred_on)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <MobileDetail label="Categoría" value={categoryName} icon={<ReceiptText className="h-3.5 w-3.5" />} />
        <MobileDetail label="Registró" value={memberName} icon={<CircleDollarSign className="h-3.5 w-3.5" />} />
      </div>
    </div>
  );
}

function MobileDetail({
  label,
  value,
  valueTone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  valueTone?: 'success' | 'danger' | 'neutral';
  icon?: ReactNode;
}) {
  const valueClass =
    valueTone === 'success' ? 'text-success' : valueTone === 'danger' ? 'text-danger' : 'text-text';

  return (
    <div className="rounded-2xl border border-border bg-bg/65 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-light">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {icon ? <span className="text-text-light">{icon}</span> : null}
        <p className={`text-sm font-medium leading-6 ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

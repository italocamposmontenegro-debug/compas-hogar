import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { AlertBanner, Button, Card, EmptyState, InputField, Modal, SelectField } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../utils/format-clp';
import { formatDate } from '../../utils/dates-chile';
import { calculateHouseholdBalance, getTransactionFlowType } from '../../lib/household-finance';
import type { Category, Transaction } from '../../types/database';
import {
  ArrowRightLeft,
  CheckCircle2,
  HandCoins,
  PencilLine,
  PiggyBank,
  Plus,
  Scale,
} from 'lucide-react';

export function SplitPage() {
  const navigate = useNavigate();
  const { household, members } = useHousehold();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'danger'>('success');
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [settlementPaidBy, setSettlementPaidBy] = useState('');
  const [settlementReceivedBy, setSettlementReceivedBy] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;

    const [transactionsResult, categoriesResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('occurred_on', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .order('sort_order'),
    ]);

    setTransactions((transactionsResult.data || []) as Transaction[]);
    setCategories((categoriesResult.data || []) as Category[]);
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

  const balanceSummary = useMemo(() => calculateHouseholdBalance({
    household,
    members,
    transactions,
    categories,
  }), [categories, household, members, transactions]);

  useEffect(() => {
    if (!balanceSummary.pendingMemberId || !balanceSummary.favoredMemberId) return;
    setSettlementPaidBy(balanceSummary.pendingMemberId);
    setSettlementReceivedBy(balanceSummary.favoredMemberId);
  }, [balanceSummary.favoredMemberId, balanceSummary.pendingMemberId]);

  async function handleToggleBalance(transaction: Transaction, nextValue: boolean) {
    try {
      const { error } = await supabase.functions.invoke('manage-transaction', {
        body: {
          action: 'update',
          transactionId: transaction.id,
          type: transaction.type,
          flowType: getTransactionFlowType(transaction, categories),
          description: transaction.description,
          amountClp: transaction.amount_clp,
          categoryId: transaction.category_id,
          goalId: transaction.goal_id,
          occurredOn: transaction.occurred_on,
          paidByMemberId: transaction.paid_by_member_id,
          assignedToMemberId: transaction.assigned_to_member_id,
          scope: transaction.scope,
          expenseType: transaction.expense_type,
          affectsHouseholdBalance: nextValue,
          notes: transaction.notes,
        },
      });

      if (error) throw error;
      setMessageType('success');
      setMessage(nextValue ? 'El movimiento volvió a contar en Saldo Hogar.' : 'El movimiento quedó fuera del balance común.');
      await load();
    } catch (error) {
      setMessageType('danger');
      setMessage(error instanceof Error ? error.message : 'No pudimos ajustar este movimiento.');
    }
  }

  async function handleRegisterSettlement() {
    if (!household || !settlementAmount || !settlementPaidBy || !settlementReceivedBy) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase.functions.invoke('manage-transaction', {
        body: {
          action: 'create',
          householdId: household.id,
          type: 'expense',
          flowType: 'abono_saldo_hogar',
          description: 'Abono de Saldo Hogar',
          amountClp: Number.parseInt(settlementAmount, 10),
          categoryId: null,
          goalId: null,
          occurredOn: settlementDate,
          paidByMemberId: settlementPaidBy,
          assignedToMemberId: settlementReceivedBy,
          scope: 'shared',
          expenseType: 'variable',
          affectsHouseholdBalance: false,
          notes: settlementNotes || null,
        },
      });

      if (error) throw error;
      setMessageType('success');
      setMessage('Abono registrado. El Saldo Hogar ya quedó actualizado.');
      setShowSettlementForm(false);
      setSettlementAmount('');
      setSettlementNotes('');
      await load();
    } catch (error) {
      setMessageType('danger');
      setMessage(error instanceof Error ? error.message : 'No pudimos registrar el abono.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page max-w-6xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Saldo Hogar</p>
            <h1 className="mt-3 text-[clamp(1.85rem,2.5vw,2.45rem)] font-semibold tracking-[-0.04em] text-text">
              Transparencia para ponerse al día
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
              Aquí ves cuándo uno adelantó más de lo que correspondía en gastos compartidos y cómo va la puesta al día.
            </p>
          </div>

          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowSettlementForm(true)} disabled={balanceSummary.status === 'Puesta al dia'}>
            Registrar abono
          </Button>
        </div>
      </section>

      {message ? <AlertBanner type={messageType} message={message} onClose={() => setMessage('')} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SignalCard
          label="Saldo neto actual"
          value={balanceSummary.status === 'Puesta al dia' ? 'Puesta al día' : formatCLP(balanceSummary.netAmount)}
          detail={balanceSummary.status === 'Puesta al dia' ? 'No hay diferencia pendiente entre ustedes.' : 'Eso es lo que aún falta equilibrar.'}
          icon={<Scale className="h-4 w-4" />}
        />
        <SignalCard
          label="Integrante a favor"
          value={balanceSummary.favoredMemberName || 'Sin saldo pendiente'}
          detail={balanceSummary.favoredMemberName ? 'Es quien adelantó más gastos compartidos.' : 'El hogar está equilibrado.'}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <SignalCard
          label="Puesta al día"
          value={balanceSummary.pendingMemberName || 'Al día'}
          detail={balanceSummary.pendingMemberName ? 'Es quien debería compensar lo pendiente.' : 'No hace falta registrar abonos ahora.'}
          icon={<HandCoins className="h-4 w-4" />}
        />
      </section>

      {balanceSummary.origins.length === 0 ? (
        <EmptyState
          eyebrow="Saldo Hogar"
          title="Aún no hay movimientos compartidos que generen saldo entre ustedes"
          description="Cuando un gasto compartido lo paga una sola persona y corresponde equilibrarlo, aparecerá aquí."
          action={{ label: 'Registrar gasto compartido', onClick: () => navigate('/app/gastos?create=1') }}
        />
      ) : (
        <section className="space-y-6">
          <Card padding="lg">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Origen del saldo</p>
                <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">Qué movimientos explican el desbalance</h2>
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  Cada origen muestra cuánto del gasto correspondía al otro integrante y qué parte ya se puso al día.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {balanceSummary.origins.map((origin) => {
                const rawTransaction = transactions.find((transaction) => transaction.id === origin.id);
                return (
                  <div key={origin.id} className="rounded-3xl border border-border bg-bg/65 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StateChip state={origin.state} />
                          <span className="text-xs uppercase tracking-[0.16em] text-text-light">{formatDate(origin.occurredOn)}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold tracking-tight text-text">{origin.description}</h3>
                        <p className="mt-2 text-sm leading-6 text-text-muted">
                          {origin.paidByMemberName} pagó {formatCLP(origin.amount)}. A {origin.counterpartyMemberName || 'la otra persona'} le correspondía compensar {formatCLP(origin.compensableAmount)}.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <BalanceDetail label="Abonado" value={formatCLP(origin.appliedAmount)} />
                          <BalanceDetail label="Pendiente" value={formatCLP(origin.remainingAmount)} />
                          <BalanceDetail label="Lectura" value={origin.affectsBalance ? 'Compensable' : 'Fuera del balance'} />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-3 lg:w-[220px]">
                        {rawTransaction ? (
                          <Button
                            variant="secondary"
                            icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                            onClick={() => handleToggleBalance(rawTransaction, !rawTransaction.affects_household_balance)}
                          >
                            {rawTransaction.affects_household_balance ? 'Excluir del balance' : 'Volver a incluir'}
                          </Button>
                        ) : null}
                        <Button variant="ghost" icon={<PencilLine className="h-3.5 w-3.5" />} onClick={() => navigate('/app/gastos')}>
                          Revisar en Gastos
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding="lg">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Historial de puesta al día</p>
            <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-text">Abonos registrados</h2>
            {balanceSummary.settlements.length === 0 ? (
              <p className="mt-4 text-sm leading-7 text-text-muted">
                Aún no hay abonos registrados. Cuando uno de ustedes se ponga al día, quedará visible aquí.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {balanceSummary.settlements.map((settlement) => (
                  <div key={settlement.id} className="rounded-3xl border border-border bg-bg/65 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {settlement.paidByMemberName} registró un abono a favor de {settlement.receivedByMemberName || 'la otra persona'}
                        </p>
                        <p className="mt-1 text-sm text-text-muted">{formatDate(settlement.occurredOn)} · {settlement.description}</p>
                        {settlement.notes ? (
                          <p className="mt-2 text-sm leading-6 text-text-muted">{settlement.notes}</p>
                        ) : null}
                      </div>
                      <p className="text-base font-semibold text-success">{formatCLP(settlement.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      <Modal open={showSettlementForm} onClose={() => !saving && setShowSettlementForm(false)} title="Registrar abono" size="md">
        <div className="space-y-5">
          <p className="text-sm leading-7 text-text-muted">
            Usa este registro cuando uno de ustedes se ponga al día con el saldo pendiente del hogar.
          </p>
          <InputField
            label="Monto del abono (CLP)"
            type="number"
            value={settlementAmount}
            onChange={(event) => setSettlementAmount(event.target.value)}
          />
          <InputField
            label="Fecha"
            type="date"
            value={settlementDate}
            onChange={(event) => setSettlementDate(event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Quién se pone al día"
              value={settlementPaidBy}
              onChange={setSettlementPaidBy}
              options={members.map((member) => ({ value: member.id, label: member.display_name }))}
            />
            <SelectField
              label="A favor de quién"
              value={settlementReceivedBy}
              onChange={setSettlementReceivedBy}
              options={members.map((member) => ({ value: member.id, label: member.display_name }))}
            />
          </div>
          <InputField
            label="Nota opcional"
            value={settlementNotes}
            onChange={(event) => setSettlementNotes(event.target.value)}
            placeholder="Ej: transferencia para dejar el mes al día"
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setShowSettlementForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterSettlement} loading={saving}>
              Registrar abono
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SignalCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-[1.8rem] font-semibold tracking-[-0.04em] text-text">{value}</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function BalanceDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-light">{label}</p>
      <p className="mt-2 text-sm font-medium text-text">{value}</p>
    </div>
  );
}

function StateChip({ state }: { state: string }) {
  const classes =
    state === 'Saldado'
      ? 'bg-success-bg text-success'
      : state === 'Parcial'
        ? 'bg-warning-bg text-warning'
        : state === 'Excluido'
          ? 'bg-surface-low text-text-muted'
          : state === 'Ajustado'
            ? 'bg-info-bg text-info'
            : 'bg-primary/8 text-primary';

  return (
    <span className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${classes}`}>
      {state === 'Saldado' ? <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> : null}
      {state}
    </span>
  );
}

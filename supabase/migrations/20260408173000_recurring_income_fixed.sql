ALTER TABLE public.recurring_transactions
ADD COLUMN transaction_type text NOT NULL DEFAULT 'expense'
CHECK (transaction_type IN ('expense', 'income'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_source_month_unique
ON public.transactions (
  recurring_source_id,
  date_trunc('month', occurred_on::timestamp)
)
WHERE
  is_recurring_instance = true
  AND recurring_source_id IS NOT NULL
  AND deleted_at IS NULL;

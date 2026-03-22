-- ==========================================
-- Casa Clara - Indexes
-- ==========================================

-- Indexes for household_members
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_household_id ON public.categories(household_id);

-- Indexes for recurring_transactions
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_household_id ON public.recurring_transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_paid_by ON public.recurring_transactions(paid_by_member_id);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_household_id ON public.transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON public.transactions(occurred_on);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_paid_by ON public.transactions(paid_by_member_id);

-- Indexes for payment_calendar_items
CREATE INDEX IF NOT EXISTS idx_payment_calendar_items_household_id ON public.payment_calendar_items(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_calendar_items_due_date ON public.payment_calendar_items(due_date);

-- Indexes for savings_goals
CREATE INDEX IF NOT EXISTS idx_savings_goals_household_id ON public.savings_goals(household_id);

-- Indexes for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON public.webhook_events(external_event_id);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_household_id ON public.audit_logs(household_id);

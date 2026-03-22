-- ==========================================
-- Casa Clara - Initial Schema
-- ==========================================

-- Enabling Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Vinculado a auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. HOUSEHOLDS
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  split_rule_type TEXT NOT NULL DEFAULT 'fifty_fifty',
  split_rule_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. HOUSEHOLD MEMBERS
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  monthly_income INTEGER NOT NULL DEFAULT 0,
  invited_by UUID REFERENCES public.profiles(id),
  invitation_status TEXT NOT NULL CHECK (invitation_status IN ('accepted', 'pending', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(household_id, email)
);

-- 4. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_account_label TEXT NOT NULL DEFAULT 'mp_default',
  plan_code TEXT NOT NULL CHECK (plan_code IN ('base', 'plus', 'admin')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'cancelled', 'expired', 'failed', 'inactive')),
  migration_status TEXT,
  external_reference TEXT,
  provider_subscription_id TEXT,
  price_amount_clp INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. SUBSCRIPTION EVENTS
CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- 7. RECURRING TRANSACTIONS (Referenciado por transacciones puntuales)
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  description TEXT NOT NULL,
  amount_clp INTEGER NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'shared')),
  paid_by_member_id UUID NOT NULL REFERENCES public.household_members(id),
  assigned_to_member_id UUID REFERENCES public.household_members(id),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  paid_by_member_id UUID NOT NULL REFERENCES public.household_members(id),
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'shared')),
  assigned_to_member_id UUID REFERENCES public.household_members(id),
  amount_clp INTEGER NOT NULL CHECK (amount_clp > 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  occurred_on DATE NOT NULL,
  expense_type TEXT CHECK (expense_type IN ('fixed', 'variable')),
  is_recurring_instance BOOLEAN DEFAULT false,
  recurring_source_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- 9. PAYMENT CALENDAR ITEMS
CREATE TABLE public.payment_calendar_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_clp INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  recurring_source_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  paid_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. SAVINGS GOALS
CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount_clp INTEGER NOT NULL,
  current_amount_clp INTEGER NOT NULL DEFAULT 0,
  target_date DATE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. MONTHLY REVIEWS
CREATE TABLE public.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_income INTEGER NOT NULL DEFAULT 0,
  total_expenses INTEGER NOT NULL DEFAULT 0,
  total_savings INTEGER NOT NULL DEFAULT 0,
  summary_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(household_id, year, month)
);

-- 12. CSV IMPORTS
CREATE TABLE public.csv_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id),
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  column_mapping JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. INVITATION TOKENS
CREATE TABLE public.invitation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  invited_email TEXT NOT NULL,
  invited_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. WEBHOOK EVENTS
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  provider_account_label TEXT,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload_raw JSONB,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received', 'processing', 'processed', 'failed', 'skipped')),
  processing_error TEXT,
  attempts INTEGER DEFAULT 0 NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  signature_header TEXT
);

-- 15. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 16. BILLING PROVIDER CONFIGS
CREATE TABLE public.billing_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  account_label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  plans JSONB NOT NULL DEFAULT '{}'::jsonb,
  back_url TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(provider, account_label)
);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at
CREATE TRIGGER set_timestamp_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_households BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_household_members BEFORE UPDATE ON household_members FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_subscriptions BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_recurring_transactions BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_payment_calendar_items BEFORE UPDATE ON payment_calendar_items FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_savings_goals BEFORE UPDATE ON savings_goals FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_billing_provider_configs BEFORE UPDATE ON billing_provider_configs FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

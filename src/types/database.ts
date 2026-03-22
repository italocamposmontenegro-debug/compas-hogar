// ============================================
// Casa Clara — Database Types (Supabase)
// Placeholder until generated with supabase gen types
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: any[];
      };
      households: {
        Row: Household;
        Insert: Partial<Household>;
        Update: Partial<Household>;
        Relationships: any[];
      };
      household_members: {
        Row: HouseholdMember;
        Insert: Partial<HouseholdMember>;
        Update: Partial<HouseholdMember>;
        Relationships: any[];
      };
      subscriptions: {
        Row: Subscription;
        Insert: Partial<Subscription>;
        Update: Partial<Subscription>;
        Relationships: any[];
      };
      subscription_events: {
        Row: SubscriptionEvent;
        Insert: Partial<SubscriptionEvent>;
        Update: Partial<SubscriptionEvent>;
        Relationships: any[];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category>;
        Update: Partial<Category>;
        Relationships: any[];
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
        Relationships: any[];
      };
      recurring_transactions: {
        Row: RecurringTransaction;
        Insert: Partial<RecurringTransaction>;
        Update: Partial<RecurringTransaction>;
        Relationships: any[];
      };
      payment_calendar_items: {
        Row: PaymentCalendarItem;
        Insert: Partial<PaymentCalendarItem>;
        Update: Partial<PaymentCalendarItem>;
        Relationships: any[];
      };
      savings_goals: {
        Row: SavingsGoal;
        Insert: Partial<SavingsGoal>;
        Update: Partial<SavingsGoal>;
        Relationships: any[];
      };
      monthly_reviews: {
        Row: MonthlyReview;
        Insert: Partial<MonthlyReview>;
        Update: Partial<MonthlyReview>;
        Relationships: any[];
      };
      csv_imports: {
        Row: CsvImport;
        Insert: Partial<CsvImport>;
        Update: Partial<CsvImport>;
        Relationships: any[];
      };
      invitation_tokens: {
        Row: InvitationToken;
        Insert: Partial<InvitationToken>;
        Update: Partial<InvitationToken>;
        Relationships: any[];
      };
      webhook_events: {
        Row: WebhookEvent;
        Insert: Partial<WebhookEvent>;
        Update: Partial<WebhookEvent>;
        Relationships: any[];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog>;
        Update: Partial<AuditLog>;
        Relationships: any[];
      };
      billing_provider_configs: {
        Row: BillingProviderConfig;
        Insert: Partial<BillingProviderConfig>;
        Update: Partial<BillingProviderConfig>;
        Relationships: any[];
      };
    };
    Functions: {
      has_active_subscription: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
    };
  };
}

// ============================================
// Row types
// ============================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  split_rule_type: 'fifty_fifty' | 'proportional' | 'fixed_amount' | 'custom_percent';
  split_rule_config: Record<string, unknown>;
  currency: string;
  timezone: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  role: 'owner' | 'member';
  display_name: string;
  email: string;
  monthly_income: number;
  invited_by: string | null;
  invitation_status: 'accepted' | 'pending' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  household_id: string;
  provider: string;
  provider_account_label: string;
  plan_code: 'base' | 'plus' | 'admin';
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'pending' | 'cancelled' | 'expired' | 'failed' | 'inactive';
  migration_status: string | null;
  external_reference: string | null;
  provider_subscription_id: string | null;
  price_amount_clp: number;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  event_type: string;
  provider_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Transaction {
  id: string;
  household_id: string;
  created_by: string;
  type: 'income' | 'expense';
  paid_by_member_id: string;
  scope: 'personal' | 'shared';
  assigned_to_member_id: string | null;
  amount_clp: number;
  category_id: string | null;
  description: string;
  occurred_on: string;
  expense_type: 'fixed' | 'variable' | null;
  is_recurring_instance: boolean;
  recurring_source_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecurringTransaction {
  id: string;
  household_id: string;
  created_by: string;
  description: string;
  amount_clp: number;
  category_id: string | null;
  scope: 'personal' | 'shared';
  paid_by_member_id: string;
  assigned_to_member_id: string | null;
  day_of_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentCalendarItem {
  id: string;
  household_id: string;
  description: string;
  amount_clp: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  category_id: string | null;
  recurring_source_id: string | null;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  household_id: string;
  name: string;
  target_amount_clp: number;
  current_amount_clp: number;
  target_date: string;
  is_primary: boolean;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MonthlyReview {
  id: string;
  household_id: string;
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  total_savings: number;
  summary_data: Record<string, unknown>;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface CsvImport {
  id: string;
  household_id: string;
  uploaded_by: string;
  filename: string;
  row_count: number;
  imported_count: number;
  skipped_count: number;
  status: 'pending' | 'completed' | 'failed';
  column_mapping: Record<string, unknown>;
  created_at: string;
}

export interface InvitationToken {
  id: string;
  household_id: string;
  token: string;
  invited_email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  provider_account_label: string | null;
  external_event_id: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  payload_raw: Record<string, unknown>;
  processing_status: 'received' | 'processing' | 'processed' | 'failed' | 'skipped';
  processing_error: string | null;
  attempts: number;
  received_at: string;
  processed_at: string | null;
  signature_header: string | null;
}

export interface AuditLog {
  id: string;
  household_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface BillingProviderConfig {
  id: string;
  provider: string;
  account_label: string;
  is_active: boolean;
  plans: Record<string, unknown>;
  back_url: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

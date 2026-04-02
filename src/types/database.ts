// ============================================
// Casa Clara - Database Types (Supabase)
// Synced manually with the SQL migrations in this repo.
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type FunctionArgs<T> = T & Record<string, unknown>;
type FunctionReturns<T> = T & Record<string, unknown>;

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
  split_rule_config: Json;
  currency: string;
  timezone: string;
  created_by: string | null;
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
  metadata: Json;
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
  created_by: string | null;
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
  created_by: string | null;
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
  summary_data: Json;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CsvImport {
  id: string;
  household_id: string;
  uploaded_by: string | null;
  filename: string;
  row_count: number;
  imported_count: number;
  skipped_count: number;
  status: 'pending' | 'completed' | 'failed';
  column_mapping: Json;
  created_at: string;
}

export interface InvitationToken {
  id: string;
  household_id: string;
  token: string;
  invited_email: string;
  invited_by: string | null;
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
  payload_raw: Json;
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
  metadata: Json;
  ip_address: string | null;
  created_at: string;
}

export interface BillingProviderConfig {
  id: string;
  provider: string;
  account_label: string;
  is_active: boolean;
  plans: Json;
  back_url: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ControlRoleAssignment {
  id: string;
  user_id: string;
  role: 'CEO' | 'OPS_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT' | 'BREAK_GLASS';
  granted_by: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Insert / Update helpers
// ============================================

export interface ProfileInsert {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HouseholdInsert {
  name: string;
  split_rule_type?: Household['split_rule_type'];
  split_rule_config?: Json;
  currency?: string;
  timezone?: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HouseholdMemberInsert {
  household_id: string;
  user_id?: string | null;
  role: 'owner' | 'member';
  display_name: string;
  email: string;
  monthly_income?: number;
  invited_by?: string | null;
  invitation_status: 'accepted' | 'pending' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionInsert {
  household_id: string;
  provider?: string;
  provider_account_label?: string;
  plan_code: Subscription['plan_code'];
  billing_cycle: Subscription['billing_cycle'];
  status: Subscription['status'];
  migration_status?: string | null;
  external_reference?: string | null;
  provider_subscription_id?: string | null;
  price_amount_clp?: number;
  current_period_start?: string | null;
  current_period_end?: string | null;
  last_payment_status?: string | null;
  trial_ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionEventInsert {
  subscription_id: string;
  event_type: string;
  provider_event_id?: string | null;
  metadata?: Json;
  created_at?: string;
}

export interface CategoryInsert {
  household_id: string;
  name: string;
  icon: string;
  color: string;
  is_default?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface TransactionInsert {
  household_id: string;
  created_by?: string | null;
  type: 'income' | 'expense';
  paid_by_member_id: string;
  scope: 'personal' | 'shared';
  assigned_to_member_id?: string | null;
  amount_clp: number;
  category_id?: string | null;
  description: string;
  occurred_on: string;
  expense_type?: 'fixed' | 'variable' | null;
  is_recurring_instance?: boolean;
  recurring_source_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface RecurringTransactionInsert {
  household_id: string;
  created_by?: string | null;
  description: string;
  amount_clp: number;
  category_id?: string | null;
  scope: 'personal' | 'shared';
  paid_by_member_id: string;
  assigned_to_member_id?: string | null;
  day_of_month: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentCalendarItemInsert {
  household_id: string;
  description: string;
  amount_clp: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  category_id?: string | null;
  recurring_source_id?: string | null;
  paid_transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SavingsGoalInsert {
  household_id: string;
  name: string;
  target_amount_clp: number;
  current_amount_clp?: number;
  target_date: string;
  is_primary?: boolean;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyReviewInsert {
  household_id: string;
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  total_savings?: number;
  summary_data?: Json;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface CsvImportInsert {
  household_id: string;
  uploaded_by?: string | null;
  filename: string;
  row_count?: number;
  imported_count?: number;
  skipped_count?: number;
  status: 'pending' | 'completed' | 'failed';
  column_mapping?: Json;
  created_at?: string;
}

export interface InvitationTokenInsert {
  household_id: string;
  token: string;
  invited_email: string;
  invited_by?: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at?: string | null;
  created_at?: string;
}

export interface WebhookEventInsert {
  provider: string;
  provider_account_label?: string | null;
  external_event_id: string;
  event_type: string;
  resource_type?: string | null;
  resource_id?: string | null;
  payload_raw?: Json;
  processing_status: 'received' | 'processing' | 'processed' | 'failed' | 'skipped';
  processing_error?: string | null;
  attempts?: number;
  received_at?: string;
  processed_at?: string | null;
  signature_header?: string | null;
}

export interface AuditLogInsert {
  household_id?: string | null;
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: Json;
  ip_address?: string | null;
  created_at?: string;
}

export interface BillingProviderConfigInsert {
  provider: string;
  account_label: string;
  is_active?: boolean;
  plans: Json;
  back_url?: string | null;
  webhook_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ControlRoleAssignmentInsert {
  user_id: string;
  role: ControlRoleAssignment['role'];
  granted_by?: string | null;
  note?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Database shape
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<Profile, ProfileInsert, Partial<Profile>>;
      households: TableDefinition<Household, HouseholdInsert, Partial<Household>>;
      household_members: TableDefinition<HouseholdMember, HouseholdMemberInsert, Partial<HouseholdMember>>;
      subscriptions: TableDefinition<Subscription, SubscriptionInsert, Partial<Subscription>>;
      subscription_events: TableDefinition<SubscriptionEvent, SubscriptionEventInsert, Partial<SubscriptionEvent>>;
      categories: TableDefinition<Category, CategoryInsert, Partial<Category>>;
      transactions: TableDefinition<Transaction, TransactionInsert, Partial<Transaction>>;
      recurring_transactions: TableDefinition<RecurringTransaction, RecurringTransactionInsert, Partial<RecurringTransaction>>;
      payment_calendar_items: TableDefinition<PaymentCalendarItem, PaymentCalendarItemInsert, Partial<PaymentCalendarItem>>;
      savings_goals: TableDefinition<SavingsGoal, SavingsGoalInsert, Partial<SavingsGoal>>;
      monthly_reviews: TableDefinition<MonthlyReview, MonthlyReviewInsert, Partial<MonthlyReview>>;
      csv_imports: TableDefinition<CsvImport, CsvImportInsert, Partial<CsvImport>>;
      invitation_tokens: TableDefinition<InvitationToken, InvitationTokenInsert, Partial<InvitationToken>>;
      webhook_events: TableDefinition<WebhookEvent, WebhookEventInsert, Partial<WebhookEvent>>;
      audit_logs: TableDefinition<AuditLog, AuditLogInsert, Partial<AuditLog>>;
      billing_provider_configs: TableDefinition<BillingProviderConfig, BillingProviderConfigInsert, Partial<BillingProviderConfig>>;
      control_role_assignments: TableDefinition<ControlRoleAssignment, ControlRoleAssignmentInsert, Partial<ControlRoleAssignment>>;
    };
    Views: Record<string, never>;
    Functions: {
      has_active_subscription: {
        Args: FunctionArgs<{ p_household_id: string }>;
        Returns: boolean;
      };
      create_household_setup: {
        Args: FunctionArgs<{
          p_name: string;
          p_split_rule?: string;
          p_monthly_income?: number;
          p_goal_name?: string | null;
          p_goal_amount?: number;
          p_goal_date?: string | null;
          p_partner_email?: string | null;
        }>;
        Returns: FunctionReturns<{
          household_id: string;
          invitation_token_id: string | null;
        }>;
      };
      resolve_current_household_context: {
        Args: FunctionArgs<{ p_user_id?: string }>;
        Returns: FunctionReturns<{
          membership_id: string;
          household_id: string;
          role: string;
          display_name: string;
          email: string;
          monthly_income: number;
          household_name: string;
          subscription_id: string | null;
          subscription_status: string | null;
          subscription_plan_code: string | null;
          subscription_billing_cycle: string | null;
          accepted_household_count: number;
          active_household_count: number;
          resolution_reason: string;
        }>[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

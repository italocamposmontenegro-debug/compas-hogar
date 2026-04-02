export interface ControlStatItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'muted';
}

export interface ExecutiveData {
  kpis: ControlStatItem[];
  funnel: Array<{ id: string; label: string; value: number; note: string }>;
  movement: Array<{ month: string; label: string; checkouts: number; activations: number; cancellations: number }>;
  payment_health: Record<string, number>;
  critical_incidents: Array<Record<string, unknown>>;
  availability_notes?: string[];
}

export interface BillingData {
  summary: ControlStatItem[];
  distribution: Array<{ label: string; value: number }>;
  subscriptions: Array<Record<string, unknown>>;
  recent_movements: Array<Record<string, unknown>>;
  recent_webhooks: Array<Record<string, unknown>>;
  anomalies: Array<{ id: string; label: string; value: number }>;
}

export interface Customer360Data {
  search: string | null;
  households: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  availability_notes?: string[];
}

export interface OperationsData {
  summary: ControlStatItem[];
  filters: Record<string, string | null>;
  incidents: Array<Record<string, unknown>>;
  availability_notes?: string[];
}

export interface RiskData {
  summary: ControlStatItem[];
  audit_feed: Array<Record<string, unknown>>;
  webhook_failures: Array<Record<string, unknown>>;
  role_assignments: Array<Record<string, unknown>>;
  operational_health: Array<{ label: string; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }>;
}

export interface GrowthData {
  summary: ControlStatItem[];
  activation_funnel: Array<{ label: string; value: number }>;
  trends: Record<string, Array<{ month: string; label: string; value: number }>>;
  friction_points: Array<{ label: string; status: string; detail: string }>;
}

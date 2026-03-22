// ============================================
// Casa Clara — Shared UI Components
// ============================================

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { Loader2, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// ============================================
// Button
// ============================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-light focus:ring-primary shadow-sm',
    secondary: 'bg-surface text-text border border-border hover:bg-surface-hover focus:ring-primary',
    ghost: 'text-text-muted hover:bg-surface-hover focus:ring-primary',
    danger: 'bg-danger text-white hover:bg-red-700 focus:ring-danger',
  };

  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-6 py-3',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ============================================
// Input
// ============================================
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function InputField({ label, error, hint, className = '', id, ...props }: InputFieldProps) {
  const inputId = id || label.toLowerCase().replace(/\s/g, '_');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full px-3 py-2.5 rounded-lg border bg-surface text-text placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// ============================================
// Select
// ============================================
interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export function SelectField({ label, value, onChange, options, error, placeholder }: SelectFieldProps) {
  const inputId = label.toLowerCase().replace(/\s/g, '_');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 rounded-lg border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer ${
          error ? 'border-danger' : 'border-border'
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ============================================
// Card
// ============================================
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div className={`bg-surface border border-border rounded-xl shadow-xs ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// Modal
// ============================================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface rounded-xl shadow-lg w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-hover cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Alert Banner
// ============================================
interface AlertBannerProps {
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

export function AlertBanner({ type, message, action, onClose }: AlertBannerProps) {
  const styles = {
    info: 'bg-info-bg border-info/20 text-info',
    warning: 'bg-warning-bg border-warning/20 text-warning',
    danger: 'bg-danger-bg border-danger/20 text-danger',
    success: 'bg-success-bg border-success/20 text-success',
  };

  const icons = {
    info: <Info className="h-4 w-4 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
    danger: <AlertTriangle className="h-4 w-4 shrink-0" />,
    success: <CheckCircle className="h-4 w-4 shrink-0" />,
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${styles[type]}`}>
      {icons[type]}
      <p className="text-sm flex-1">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm font-semibold underline cursor-pointer">
          {action.label}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="p-0.5 cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Loading Spinner
// ============================================
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${sizes[size]} animate-spin text-primary`} />
    </div>
  );
}

// ============================================
// Loading Page
// ============================================
export function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-text-muted text-sm">Cargando Casa Clara...</p>
      </div>
    </div>
  );
}

// ============================================
// Empty State
// ============================================
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="flex justify-center mb-4 text-text-light">{icon}</div>}
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-muted mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Stat Card
// ============================================
interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}

export function StatCard({ label, value, subValue, trend, icon }: StatCardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-text-muted',
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-muted">{label}</span>
        {icon && <span className="text-text-light">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      {subValue && (
        <p className={`text-xs mt-1 ${trend ? trendColors[trend] : 'text-text-muted'}`}>
          {subValue}
        </p>
      )}
    </div>
  );
}

// ============================================
// Restricted Banner (modo restringido)
// ============================================
export function RestrictedBanner({ message, actionLabel, onAction }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="bg-warning-bg border border-warning/20 rounded-xl p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-3" />
      <p className="text-sm text-warning font-medium mb-4">{message}</p>
      <Button variant="primary" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

// ============================================
// Tabs
// ============================================
interface Tab {
  id: string;
  label: string;
}

export function Tabs({ tabs, activeTab, onChange }: {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-hover rounded-lg border border-border">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
            activeTab === tab.id
              ? 'bg-surface text-text shadow-xs'
              : 'text-text-muted hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// FeatureGate
// ============================================
import { useSubscription } from '../../hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import type { Feature } from '../../lib/constants';

export function FeatureGate({ feature, children, fallback }: {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();

  if (!hasFeature(feature)) {
    return fallback ?? (
      <RestrictedBanner
        message="Esta función requiere un plan superior."
        actionLabel="Ver planes"
        onAction={() => navigate('/app/suscripcion')}
      />
    );
  }

  return <>{children}</>;
}

// ============================================
// WriteGuard
// ============================================
export function WriteGuard({ children, fallback }: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canWrite, ctaMessage, ctaAction, ctaRoute } = useSubscription();
  const navigate = useNavigate();

  if (!canWrite) {
    return fallback ?? (
      <RestrictedBanner
        message={ctaMessage || 'Tu suscripción no está activa.'}
        actionLabel={ctaAction || 'Ver suscripción'}
        onAction={() => navigate(ctaRoute || '/app/suscripcion')}
      />
    );
  }

  return <>{children}</>;
}

// ============================================
// Confirm Dialog
// ============================================
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', loading = false }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-text-secondary mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

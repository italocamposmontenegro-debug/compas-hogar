// ============================================
// Casa Clara — Shared UI Components
// ============================================

import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { Loader2, X, AlertTriangle, CheckCircle, Info, ArrowRight, Sparkles, Zap, ChevronRight, Lock } from 'lucide-react';
import { APP_NAME } from '../../lib/constants';
import { clearPersistedSupabaseSession } from '../../lib/supabase';
import { trackEvent, trackOnce } from '../../lib/analytics';

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
  const baseStyles = 'inline-flex items-center justify-center gap-2.5 font-bold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tracking-tight';

  const variants = {
    primary: 'bg-(--color-s-primary) text-(--color-s-on-primary) hover:shadow-ambient hover:-translate-y-0.5 active:translate-y-0 shadow-sm',
    secondary: 'bg-(--color-s-surface-low) text-(--color-s-text) hover:bg-(--color-s-surface-container)',
    ghost: 'text-(--color-s-text-muted) hover:bg-black/5 hover:text-(--color-s-text)',
    danger: 'bg-[var(--color-s-danger)] text-white hover:opacity-90 shadow-sm',
  };

  const sizes = {
    sm: 'text-xs px-5 py-2.5 rounded-xl',
    md: 'text-sm px-7 py-3.5 rounded-2xl',
    lg: 'text-base px-10 py-5 rounded-[1.25rem]',
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
    <div className="space-y-2.5">
      <label htmlFor={inputId} className="block text-[11px] font-bold uppercase tracking-[0.16em] ml-1 opacity-60" style={{ color: 'var(--color-s-text-muted)' }}>
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full px-10 py-4 rounded-2xl transition-all duration-200 outline-none
          bg-(--color-s-surface-low) hover:bg-(--color-s-surface-container) focus:bg-(--color-s-surface-lowest)
          focus:shadow-ambient border border-transparent focus:border-(--color-s-border-dark)
          text-sm font-medium text-(--color-s-text) placeholder:text-(--color-s-text-light)/40 ${
          error ? 'border-red-200 bg-red-50/30' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] font-bold text-(--color-s-danger) ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
      {hint && !error && <p className="text-[11px] font-medium text-(--color-s-text-muted) ml-1 opacity-60">{hint}</p>}
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
    <div className="space-y-2.5">
      <label htmlFor={inputId} className="block text-[11px] font-bold uppercase tracking-[0.16em] ml-1 opacity-60" style={{ color: 'var(--color-s-text-muted)' }}>
        {label}
      </label>
      <div className="relative">
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none px-10 py-4 rounded-2xl transition-all duration-200 outline-none
            bg-(--color-s-surface-low) hover:bg-(--color-s-surface-container) focus:bg-(--color-s-surface-lowest)
            focus:shadow-ambient border border-transparent focus:border-(--color-s-border-dark)
            text-sm font-medium text-(--color-s-text) cursor-pointer ${
            error ? 'border-red-200 bg-red-50/30' : ''
          }`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
          <ChevronRight className="h-4 w-4 rotate-90" />
        </div>
      </div>
      {error && <p className="text-[11px] font-bold text-(--color-s-danger) ml-1">{error}</p>}
    </div>
  );
}

// ============================================
// Card
// ============================================
interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-(--color-s-surface-lowest) rounded-[2rem] p-8 lg:p-10 transition-all duration-300 hover:shadow-ambient ${className}`}>
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

export function Modal({ open, onClose, children, size = 'md' }: ModalProps) {
  if (!open) return null;

  const sizes = { 
    sm: 'max-w-md', 
    md: 'max-w-xl', 
    lg: 'max-w-3xl' 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-10">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      <div className={`relative bg-(--color-s-surface-lowest) rounded-[1.5rem] shadow-2xl w-full ${sizes[size]} max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300`}>
        <div className="relative flex items-center justify-center p-10 lg:p-12 pb-2">
          <button onClick={onClose} className="absolute right-8 lg:right-10 top-8 lg:top-10 text-(--color-s-text-muted) hover:text-(--color-s-text) p-1.5 rounded-full hover:bg-black/5 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-14 lg:px-24 pb-24">
          <div className="max-w-full">
            {children}
          </div>
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
    info: 'bg-blue-50/50 text-blue-700',
    warning: 'bg-amber-50/50 text-amber-700',
    danger: 'bg-red-50/50 text-red-700',
    success: 'bg-emerald-50/50 text-emerald-700',
  };

  const icons = {
    info: <Info className="h-5 w-5 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0" />,
    danger: <AlertTriangle className="h-5 w-5 shrink-0" />,
    success: <CheckCircle className="h-5 w-5 shrink-0" />,
  };

  return (
    <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border border-transparent ${styles[type]} animate-in slide-in-from-top-2`}>
      {icons[type]}
      <p className="text-sm font-bold flex-1 tracking-tight leading-snug">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm font-black underline decoration-2 underline-offset-4 cursor-pointer">
          {action.label}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="p-1 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
          <X className="h-4 w-4" />
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
    <div className="flex items-center justify-center p-12">
      <Loader2 className={`${sizes[size]} animate-spin text-(--color-s-primary)`} />
    </div>
  );
}

// ============================================
// Loading Page
// ============================================
export function LoadingPage() {
  const [stalled, setStalled] = useState(false);

  const resetSession = () => {
    clearPersistedSupabaseSession();
    window.location.assign('/');
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setStalled(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-s-surface-lowest)">
      <div className="w-full max-w-lg px-8 py-10 text-center animate-in fade-in duration-1000">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-(--color-s-surface-low) shadow-ambient animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-(--color-s-primary)" />
        </div>
        <p className="mt-10 text-[11px] font-black uppercase tracking-[0.2em] text-(--color-s-primary)">Cargando</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-(--color-s-text)" style={{ fontFamily: 'var(--font-headline)' }}>
          {APP_NAME} está preparando tu hogar
        </h2>
        <p className="mx-auto mt-6 max-w-sm text-base leading-relaxed text-(--color-s-text-muted) opacity-70">
          Estamos recuperando tu sesión y el estado de tu hogar para que vuelvas al punto exacto.
        </p>
        {stalled && (
          <div className="mt-12 space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <p className="text-xs text-(--color-s-text-muted) max-w-xs mx-auto opacity-60">
              La carga está tardando más de lo habitual. Puedes intentar restablecer la sesión si el problema persiste.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="sm" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
              <Button size="sm" variant="secondary" onClick={resetSession}>
                Restablecer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Empty State
// ============================================
interface EmptyStateProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  secondaryText?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, eyebrow, title, description, secondaryText, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20 px-6">
      {icon && <div className="flex justify-center mb-8 opacity-40">{icon}</div>}
      {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.2em] text-(--color-s-primary) mb-5">{eyebrow}</p>}
      <h3 className="text-2xl font-bold text-(--color-s-text) mb-4 tracking-tight" style={{ fontFamily: 'var(--font-headline)' }}>
        {title}
      </h3>
      <p className="text-base text-(--color-s-text-muted) opacity-70 mb-10 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {secondaryText && <p className="text-xs text-(--color-s-text-muted) mb-10 max-w-xs mx-auto italic">{secondaryText}</p>}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// BlockingStatePage
// ============================================
interface BlockingStatePageProps {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function BlockingStatePage({ title, description, primaryAction, secondaryAction }: BlockingStatePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-s-surface-lowest) p-4">
      <div className="max-w-xl w-full bg-(--color-s-surface-low) rounded-[2.5rem] p-10 lg:p-14 text-center shadow-ambient animate-in zoom-in-95 duration-500">
        <div className="h-16 w-16 rounded-[2rem] bg-amber-100 flex items-center justify-center mx-auto mb-8">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 mb-4">Estado bloqueado</p>
        <h2 className="text-3xl lg:text-4xl font-bold text-(--color-s-text) mt-2 mb-4 tracking-tight" style={{ fontFamily: 'var(--font-headline)' }}>
          {title}
        </h2>
        <p className="text-base text-(--color-s-text-muted) opacity-70 mb-10 leading-relaxed max-w-sm mx-auto">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} size="lg">
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick} size="lg">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
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
  onClick?: () => void;
}

export function StatCard({ label, value, subValue, trend, icon, onClick }: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50',
    down: 'text-rose-600 bg-rose-50',
    neutral: 'text-text-muted bg-neutral-50',
  };

  const content = (
    <div className="relative group overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-(--color-s-text-muted) opacity-60">{label}</span>
        {icon && <span className="text-(--color-s-text-muted) opacity-40 group-hover:opacity-80 transition-opacity">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-(--color-s-text) tracking-tight mb-2" style={{ fontFamily: 'var(--font-headline)' }}>
        {value}
      </p>
      {subValue && (
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black">
          <span className={trend ? trendColors[trend].split(' ')[0] : 'text-(--color-s-text-muted)'}>
            {subValue}
          </span>
        </div>
      )}
    </div>
  );

  const cardClasses = "bg-(--color-s-surface-lowest) rounded-[2rem] p-8 lg:p-10 transition-all duration-300 shadow-sm border border-transparent";

  if (!onClick) {
    return (
      <div className={cardClasses}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cardClasses} text-left w-full cursor-pointer hover:shadow-ambient hover:-translate-y-1 active:translate-y-0`}
    >
      {content}
    </button>
  );
}

// ============================================
// Restricted Banner
// ============================================
export function RestrictedBanner({ message, actionLabel, onAction }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="bg-amber-50/50 rounded-[2.5rem] p-10 lg:p-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[2rem] bg-amber-100 text-amber-600 mb-8">
        <Lock className="h-8 w-8" />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 mb-4">Función restringida</p>
      <h3 className="text-2xl font-bold text-amber-900 mb-4 tracking-tight" style={{ fontFamily: 'var(--font-headline)' }}>
        Requiere suscripción activa
      </h3>
      <p className="text-base text-amber-800/70 mb-10 max-w-sm mx-auto leading-relaxed">
        {message}
      </p>
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function PlanBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-(--color-s-primary)/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-(--color-s-primary)">
      {children}
    </span>
  );
}

export function UpgradePromptCard({
  badge,
  title,
  description,
  highlights = [],
  actionLabel,
  onAction,
  compact = false,
  trackingContext,
}: {
  badge: string;
  title: string;
  description: string;
  highlights?: string[];
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
  trackingContext?: string;
}) {
  function handleAction() {
    trackEvent('upgrade_cta_clicked', {
      context: trackingContext || title,
      badge,
      action_label: actionLabel,
    });
    onAction();
  }

  return (
    <div className={`relative overflow-hidden group rounded-[2.5rem] bg-(--color-s-surface-low) ${compact ? 'p-8' : 'p-10 lg:p-14'} transition-all hover:shadow-ambient`}>
      <div className="absolute top-0 right-0 p-12 opacity-5 transition-transform group-hover:scale-110 group-hover:rotate-6">
        <Sparkles size={compact ? 80 : 120} />
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur shadow-sm mb-8">
          <Zap size={14} className="text-(--color-s-primary)" fill="currentColor" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-(--color-s-primary)">
            {badge}
          </span>
        </div>

        <h3 className={`${compact ? 'text-2xl' : 'text-3xl lg:text-4xl'} font-bold tracking-tight mb-6`} style={{ fontFamily: 'var(--font-headline)' }}>
          {title}
        </h3>
        <p className="text-base leading-relaxed opacity-70 mb-10 max-w-lg">
          {description}
        </p>

        {highlights.length > 0 && (
          <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'} mb-12`}>
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-4">
                <div className="mt-1 h-5 w-5 rounded-full bg-(--color-s-primary)/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 shrink-0 text-(--color-s-primary) mt-0.5" />
                </div>
                <span className="text-sm font-bold opacity-80 leading-snug">{item}</span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleAction} size={compact ? 'md' : 'lg'}>
          {actionLabel} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
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
    <div className="flex gap-2 p-1.5 bg-(--color-s-surface-low) rounded-2xl">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-8 py-3.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === tab.id
              ? 'bg-(--color-s-surface-lowest) text-(--color-s-text) shadow-sm'
              : 'text-(--color-s-text-muted) hover:text-(--color-s-text) hover:bg-black/5'
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
import type { FeatureKey } from '../../lib/constants';

export function FeatureGate({ feature, children, fallback }: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasFeature, getUpgradeCopy, planTier } = useSubscription();
  const navigate = useNavigate();
  const isAllowed = hasFeature(feature);

  useEffect(() => {
    if (isAllowed) return;
    trackOnce(
      `limit-reached:${planTier}:${feature}`,
      'limit_reached_viewed',
      { feature, plan: planTier, route: window.location.pathname },
      'session',
    );
  }, [feature, isAllowed, planTier]);

  if (!isAllowed) {
    const upgrade = getUpgradeCopy(feature);
    return fallback ?? (
      <UpgradePromptCard
        badge={upgrade.badge || 'Disponible con un plan superior'}
        title={upgrade.title || 'Función bloqueada'}
        description={upgrade.description || upgrade.message || 'Esta función no está disponible con tu plan actual.'}
        highlights={upgrade.highlights || []}
        actionLabel={upgrade.actionLabel || 'Ver planes'}
        onAction={() => navigate(upgrade.route || '/app/suscripcion')}
        trackingContext={`feature-gate-${feature}`}
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
      <p className="text-base text-(--color-s-text-muted) leading-relaxed mb-10">{message}</p>
      <div className="flex gap-4 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

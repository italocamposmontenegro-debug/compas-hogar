import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Info,
  Loader2,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import type { FeatureKey } from '../../lib/constants';
import { clearPersistedSupabaseSession } from '../../lib/supabase';
import { trackEvent, trackOnce } from '../../lib/analytics';
import { useSubscription } from '../../hooks/useSubscription';

const FOCUSABLE_SELECTOR = [
  '[data-autofocus="true"]',
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      !(element instanceof HTMLInputElement && element.type === 'hidden'),
  );
}

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
  type,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex min-w-[44px] items-center justify-center gap-2 rounded-xl border font-semibold tracking-tight transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0';

  const variants = {
    primary:
      'border-primary bg-primary text-white shadow-sm hover:border-primary-light hover:bg-primary-light active:bg-primary-light/95',
    secondary:
      'border-border bg-surface text-text shadow-sm hover:bg-surface-hover hover:border-border-strong active:bg-surface-low',
    ghost:
      'border-transparent bg-transparent text-text-secondary hover:bg-bg hover:text-text active:bg-surface-low',
    danger:
      'border-danger/20 bg-danger text-white shadow-sm hover:bg-[#981b1b] active:bg-[#841818]',
  } as const;

  const sizes = {
    sm: 'min-h-11 px-4 text-sm',
    md: 'min-h-12 px-5 text-sm',
    lg: 'min-h-14 px-6 text-base rounded-2xl',
  } as const;

  return (
    <button
      type={type ?? 'button'}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
        {!loading && icon ? <span className="inline-flex shrink-0 items-center justify-center">{icon}</span> : null}
        {children ? <span className="truncate">{children}</span> : null}
      </span>
    </button>
  );
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
}

export function InputField({
  label,
  error,
  hint,
  hideLabel = false,
  className = '',
  id,
  required,
  type,
  disabled,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const isColor = type === 'color';

  return (
    <div className="space-y-2.5">
      <label
        htmlFor={inputId}
        className={`${hideLabel ? 'sr-only' : 'block text-sm font-medium text-text'}`}
      >
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}
      </label>

      <input
        id={inputId}
        type={type}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-surface text-text shadow-none transition-colors duration-150 placeholder:text-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-text-light ${
          error
            ? 'border-danger/50 pr-4'
            : 'border-border hover:border-border-strong focus:border-primary'
        } ${isColor ? 'min-h-12 p-2' : 'min-h-12 px-4 py-3 text-base'} ${className}`}
        {...props}
      />

      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-sm leading-6 text-danger" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {hint && !error ? (
        <p id={hintId} className="flex items-start gap-2 text-sm leading-6 text-text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  hint?: string;
  placeholder?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  placeholder,
  className = '',
  id,
  required,
  disabled,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-text">
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}
      </label>

      <div className="relative">
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full appearance-none rounded-xl border bg-surface px-4 py-3 pr-11 text-base text-text shadow-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-text-light ${
            error
              ? 'border-danger/50'
              : 'border-border hover:border-border-strong focus:border-primary'
          } ${className}`}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light"
          aria-hidden="true"
        />
      </div>

      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-sm leading-6 text-danger" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {hint && !error ? (
        <p id={hintId} className="flex items-start gap-2 text-sm leading-6 text-text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = {
    sm: 'p-4 sm:p-5',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-7',
  } as const;

  return (
    <div className={`ui-panel ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  kind?: 'dialog' | 'alertdialog';
  descriptionId?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  kind = 'dialog',
  descriptionId,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    lastActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      const autofocusTarget = dialog?.querySelector<HTMLElement>('[data-autofocus="true"]');
      if (autofocusTarget) {
        autofocusTarget.focus();
        return;
      }

      const [firstFocusable] = getFocusableElements(dialog).filter(
        (element) => element.dataset.modalClose !== 'true',
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        dialog?.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastActiveElementRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role={kind}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[min(88vh,760px)] w-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-[0_24px_80px_rgba(17,17,14,0.22)] ${sizes[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-light px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-text">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-text-secondary transition-colors hover:bg-surface-low hover:text-text"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

interface AlertBannerProps {
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

export function AlertBanner({ type, message, action, onClose }: AlertBannerProps) {
  const labels = {
    info: 'Información',
    warning: 'Atención',
    danger: 'Importante',
    success: 'Listo',
  } as const;

  const tones = {
    info: 'border-info/15 bg-info-bg text-info',
    warning: 'border-warning/20 bg-warning-bg text-warning',
    danger: 'border-danger/18 bg-danger-bg text-danger',
    success: 'border-success/18 bg-success-bg text-success',
  } as const;

  const icons = {
    info: <Info className="h-4 w-4" aria-hidden="true" />,
    warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    danger: <CircleAlert className="h-4 w-4" aria-hidden="true" />,
    success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  } as const;

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${tones[type]}`}
      role={type === 'danger' || type === 'warning' ? 'alert' : 'status'}
      aria-live={type === 'danger' ? 'assertive' : 'polite'}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/60">
          {icons[type]}
        </div>
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-semibold tracking-tight">{labels[type]}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{message}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-medium text-current underline-offset-4 transition-colors hover:underline"
          >
            {action.label}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-current/70 transition-colors hover:bg-white/55 hover:text-current"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-7 w-7', lg: 'h-10 w-10' } as const;
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${sizes[size]} animate-spin text-primary`} aria-hidden="true" />
    </div>
  );
}

export function LoadingPage() {
  const [stalled, setStalled] = useState(false);

  function resetSession() {
    clearPersistedSupabaseSession();
    window.location.assign('/');
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setStalled(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="ui-panel max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-bg text-primary">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-text-light">Cargando</p>
          <h1 className="section-heading mt-3 text-3xl text-text">{APP_NAME} está preparando tu hogar</h1>
          <p className="mt-4 text-base leading-7 text-text-muted">
            Recuperamos tu sesión y el estado actual para llevarte al punto correcto.
          </p>

          {stalled ? (
            <div className="mt-6 rounded-2xl border border-border bg-surface-low px-4 py-4 text-left">
              <p className="text-sm font-medium text-text">Está tardando más de lo habitual.</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Si la vista no continúa, puedes reintentar o restablecer la sesión.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button size="sm" onClick={() => window.location.reload()}>
                  Reintentar
                </Button>
                <Button size="sm" variant="secondary" onClick={resetSession}>
                  Restablecer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
    <div className="mx-auto max-w-2xl text-center">
      <div className="ui-panel p-8 sm:p-10">
        {icon ? (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-bg text-primary">
            {icon}
          </div>
        ) : null}
        {eyebrow ? <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-text-light">{eyebrow}</p> : null}
        <h3 className="section-heading mt-3 text-2xl text-text">{title}</h3>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-text-muted">{description}</p>
        {secondaryText ? <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-light">{secondaryText}</p> : null}
        {action ? (
          <div className="mt-6">
            <Button onClick={action.onClick}>{action.label}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface BlockingStatePageProps {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function BlockingStatePage({
  title,
  description,
  primaryAction,
  secondaryAction,
}: BlockingStatePageProps) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="ui-panel max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-bg text-warning">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Acceso restringido</p>
          <h1 className="section-heading mt-3 text-3xl text-text">{title}</h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-text-muted">{description}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {primaryAction ? <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button> : null}
            {secondaryAction ? (
              <Button variant="secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  onClick?: () => void;
}

export function StatCard({ label, value, subValue, trend, icon, onClick }: StatCardProps) {
  const trendClass = {
    up: 'text-success bg-success-bg',
    down: 'text-danger bg-danger-bg',
    neutral: 'text-text-muted bg-surface-low',
  } as const;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className="metric-value">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
            {icon}
          </div>
        ) : null}
      </div>
      {subValue ? (
        <div className={`mt-4 inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold ${trend ? trendClass[trend] : 'bg-surface-low text-text-muted'}`}>
          {subValue}
        </div>
      ) : null}
    </>
  );

  if (!onClick) {
    return <div className="ui-panel p-5 sm:p-6">{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className="ui-panel ui-panel-interactive w-full p-5 text-left sm:p-6">
      {content}
    </button>
  );
}

export function RestrictedBanner({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="ui-panel overflow-hidden p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-bg text-warning">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Función restringida</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-text">Requiere un plan compatible</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{message}</p>
          </div>
        </div>
        <div className="sm:pt-1">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function PlanBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-primary/15 bg-primary/8 px-3.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
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
    <div className={`ui-panel overflow-hidden ${compact ? 'p-6 sm:p-7' : 'p-7 sm:p-8'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <PlanBadge>{badge}</PlanBadge>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-bg text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <h3 className={`mt-4 ${compact ? 'text-2xl' : 'text-3xl'} font-semibold tracking-[-0.035em] text-text`}>
            {title}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{description}</p>

          {highlights.length > 0 ? (
            <ul className={`mt-5 grid gap-3 ${compact ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-surface-low px-4 py-3.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-lighter" aria-hidden="true" />
                  <span className="text-sm leading-6 text-text-secondary">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 lg:pt-1">
          <Button onClick={handleAction} size={compact ? 'md' : 'lg'}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Tab {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-h-12 min-w-full items-center gap-1 rounded-full border border-border bg-surface-low p-1" role="tablist" aria-label="Pestañas">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`min-h-11 min-w-[96px] rounded-full px-4 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:bg-bg hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FeatureGate({
  feature,
  children,
  fallback,
}: {
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
    return (
      fallback ?? (
        <UpgradePromptCard
          badge={upgrade.badge || 'Disponible con un plan superior'}
          title={upgrade.title || 'Función bloqueada'}
          description={
            upgrade.description || upgrade.message || 'Esta función no está disponible con tu plan actual.'
          }
          highlights={upgrade.highlights || []}
          actionLabel={upgrade.actionLabel || 'Ver planes'}
          onAction={() => navigate(upgrade.route || '/app/suscripcion')}
          trackingContext={`feature-gate-${feature}`}
        />
      )
    );
  }

  return <>{children}</>;
}

export function WriteGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { canWrite, ctaMessage, ctaAction, ctaRoute } = useSubscription();
  const navigate = useNavigate();

  if (!canWrite) {
    return (
      fallback ?? (
        <RestrictedBanner
          message={ctaMessage || 'Tu suscripción no está activa.'}
          actionLabel={ctaAction || 'Ver suscripción'}
          onAction={() => navigate(ctaRoute || '/app/suscripcion')}
        />
      )
    );
  }

  return <>{children}</>;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  const descriptionId = useId();

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" kind="alertdialog" descriptionId={descriptionId}>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-bg text-warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p id={descriptionId} className="text-sm leading-7 text-text-muted">
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} data-autofocus="true">
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

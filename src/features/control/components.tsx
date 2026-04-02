import type { ReactNode } from 'react';
import { AlertBanner, Card, EmptyState } from '../../components/ui';
import { ShieldAlert } from 'lucide-react';

export function ControlModuleIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <section className="ui-panel overflow-hidden p-6 lg:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{eyebrow}</p>
          <h1 className="mt-2 text-[clamp(1.9rem,2.7vw,2.8rem)] font-semibold tracking-[-0.04em] text-text">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">{description}</p>
        </div>
        {aside ? <div className="lg:max-w-sm">{aside}</div> : null}
      </div>
    </section>
  );
}

export function ControlStatGrid({
  items,
}: {
  items: Array<{ id: string; label: string; value: string; detail: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'muted' }>;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{item.label}</p>
          <p className={`mt-3 text-3xl font-semibold tracking-[-0.04em] ${
            item.tone === 'danger'
              ? 'text-danger'
              : item.tone === 'success'
                ? 'text-primary'
                : item.tone === 'muted'
                  ? 'text-text-muted'
                  : 'text-text'
          }`}>
            {item.value}
          </p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{item.detail}</p>
        </Card>
      ))}
    </section>
  );
}

export function ControlSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-panel overflow-hidden p-6 lg:p-7">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function TonePill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'danger'
    ? 'border-danger/20 bg-danger-bg text-danger'
    : tone === 'warning'
      ? 'border-warning/20 bg-warning-bg text-warning'
      : tone === 'success'
        ? 'border-primary/20 bg-primary-bg text-primary'
        : 'border-border bg-surface-low text-text-secondary';

  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {children}
    </span>
  );
}

export function AvailabilityNotes({ notes }: { notes?: string[] }) {
  if (!notes || notes.length === 0) return null;

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <AlertBanner key={note} type="info" message={note} />
      ))}
    </div>
  );
}

export function EmptyControlState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-8 w-8" />}
      title={title}
      description={description}
    />
  );
}

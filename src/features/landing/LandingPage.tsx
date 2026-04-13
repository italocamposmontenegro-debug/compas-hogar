import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Button, PlanBadge } from '../../components/ui';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { COMMERCIAL_PLAN_INFO, COMMERCIAL_PLAN_ORDER, PREMIUM_TRIAL_ENABLED, type CommercialPlanTier } from '../../lib/constants';
import { trackEvent } from '../../lib/analytics';
import { formatCLP } from '../../utils/format-clp';

const VALUE_PILLARS = [
  {
    icon: CircleDollarSign,
    title: 'Los dos ven el mismo mes',
    description: 'Ingresos, pagos y prioridades del hogar en una lectura común y fácil de entender.',
  },
  {
    icon: Users,
    title: 'Quién puso qué, claro y al día',
    description: 'Menos dudas, menos supuestos y menos conversaciones sueltas sobre la plata del hogar.',
  },
  {
    icon: Target,
    title: 'Del orden al proyecto familiar',
    description: 'Cuando el mes se ordena, ahorrar, decidir y avanzar juntos se vuelve más posible.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  function handlePrimaryCta(context: string) {
    trackEvent('landing_cta_primary_click', { context });
    navigate('/registro');
  }

  function handleExampleCta(context: string) {
    trackEvent('landing_cta_example_click', { context });
    document.getElementById('hero-mockup')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/92 backdrop-blur-md">
        <div className="page-shell flex items-center justify-between py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo mode="icon" className="h-8 w-8 sm:hidden" />
            <BrandLogo mode="full" className="hidden h-8 w-auto sm:block" />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
              Iniciar sesión
            </Button>
            <Button size="sm" onClick={() => handlePrimaryCta('header')}>
              Crear cuenta
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="page-shell pt-8 lg:pt-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,520px)] lg:items-center xl:gap-14">
            <div className="min-w-0 lg:pr-3">
              <div className="flex justify-center lg:justify-start">
                <BrandLogo mode="full" className="h-10 w-auto" />
              </div>
              <div className="eyebrow">
                <Sparkles className="h-4 w-4" />
                Finanzas claras para construir juntos
              </div>
              <h1 className="display-heading mt-6 max-w-[13ch] text-[clamp(2.7rem,6vw,5rem)] text-text">
                Ordenen la plata del hogar sin discusiones, planillas ni supuestos.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
                Compás Hogar ayuda a una pareja a ver el mismo mes, entender cuánto puso cada uno, qué falta por cubrir y avanzar con más calma hacia sus proyectos en común.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" onClick={() => handlePrimaryCta('hero')}>
                  Probar con mi pareja
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="lg" onClick={() => handleExampleCta('hero')}>
                  Ver un mes de ejemplo
                </Button>
              </div>
              <p className="mt-4 text-sm text-text-muted">
                {PREMIUM_TRIAL_ENABLED
                  ? '30 días de Premium gratis · sin tarjeta · después ustedes deciden'
                  : 'Empiecen gratis · sin fricción · elijan Premium cuando el hogar lo necesite'}
              </p>
            </div>

            <div id="hero-mockup" className="ui-panel overflow-hidden p-6 sm:p-7" aria-labelledby="landing-mockup-title">
              <div className="flex items-center justify-between gap-3 border-b border-border-light pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Estado del hogar</p>
                  <h2 id="landing-mockup-title" className="mt-2 text-xl font-semibold tracking-tight text-text">Marzo 2026</h2>
                </div>
                <span className="traffic-light traffic-light-order">En control</span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                <div className="ui-panel ui-panel-subtle p-5">
                  <p className="metric-label">Saldo disponible</p>
                  <p className="metric-value text-text">{formatCLP(1240000)}</p>
                  <p className="metric-subvalue text-success">Bajo control para cerrar el mes.</p>
                </div>

                <div className="space-y-4">
                  <div className="ui-panel ui-panel-subtle p-5">
                    <p className="metric-label">Pagos por cubrir</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-warning">{formatCLP(290000)}</p>
                  </div>
                  <div className="ui-panel ui-panel-subtle p-5">
                    <p className="metric-label">Meta principal</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">62%</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 ui-panel ui-panel-subtle p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Acción inmediata</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-text">2 pagos requieren atención hoy</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-danger-bg text-danger">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">Arriendo</p>
                      <p className="text-sm text-text-muted">Vence mañana</p>
                    </div>
                    <span className="text-sm font-semibold text-danger">{formatCLP(490000)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">Internet</p>
                      <p className="text-sm text-text-muted">Vence en 3 días</p>
                    </div>
                    <span className="text-sm font-semibold text-warning">{formatCLP(24990)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell pt-2">
          <div className="grid gap-4 lg:grid-cols-3">
            {VALUE_PILLARS.map((pillar) => (
              <article key={pillar.title} className="ui-panel ui-panel-subtle h-full p-5 sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-bg text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-text">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-7 text-text-muted">{pillar.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="planes" className="page-shell">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">Planes</p>
              <h2 className="section-heading mt-2 text-[clamp(2rem,3vw,2.75rem)] text-text">Empiecen gratis. Cuando el hogar pida más orden, activen Premium.</h2>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                {PREMIUM_TRIAL_ENABLED
                  ? 'Todos los hogares pueden probar Premium durante 30 días. Después pueden seguir en Free o activar Premium por $4.990 al mes.'
                  : 'Empiecen con Free y activen Premium por $4.990 al mes cuando el hogar necesite más orden, más claridad y mejor proyección.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-low p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                  !annual ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                  annual ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Anual
              </button>
              <span className="px-3 text-xs font-medium text-text-light">Ahorra</span>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {COMMERCIAL_PLAN_ORDER.map((tier) => (
              <PricingCard
                key={tier}
                tier={tier}
                annual={annual}
                onSelect={() => handlePrimaryCta(`pricing-${tier}`)}
              />
            ))}
          </div>
        </section>

        <section className="page-shell pt-0">
          <div className="ui-panel bg-primary px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Compás Hogar</p>
                <h2 className="section-heading mt-2 text-3xl text-white">Empiecen a ordenar el hogar como equipo.</h2>
                <p className="mt-3 text-sm leading-7 text-white/80">
                  Una base clara para ver el mismo mes, bajar fricción y avanzar con más tranquilidad hacia lo que están construyendo juntos.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => handlePrimaryCta('closing-cta')} className="!bg-white !text-primary hover:!bg-white/94">
                  Crear hogar gratis
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleExampleCta('closing-cta')}
                  className="!border-white/25 !bg-white/10 !text-white hover:!bg-white/16"
                >
                  Ver cómo funciona
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PricingCard({
  tier,
  annual,
  onSelect,
}: {
  tier: CommercialPlanTier;
  annual: boolean;
  onSelect: () => void;
}) {
  const plan = COMMERCIAL_PLAN_INFO[tier];
  const price = annual ? plan.prices.yearly : plan.prices.monthly;
  const badge = tier === 'premium' ? 'Recomendado' : null;
  const metaLabel = tier === 'free' ? 'Base de arranque' : 'Premium';
  const description = plan.description;

  return (
    <article
      className={`ui-panel h-full p-6 lg:p-7 ${
        tier === 'premium'
          ? 'border-primary/25 bg-[linear-gradient(180deg,rgba(220,236,235,0.55),#ffffff)]'
          : ''
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex min-h-[28px] items-start justify-between gap-3">
          <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-text-light">{metaLabel}</p>
          {badge ? <PlanBadge>{badge}</PlanBadge> : <span className="inline-block h-7" aria-hidden="true" />}
        </div>

        <div className="mt-3">
          <h3 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-text">{plan.name}</h3>
          <p className="mt-2 text-sm font-medium text-primary">{plan.promise}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-text-muted">{description}</p>

        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-semibold tracking-[-0.04em] text-text">
              {price === null ? 'Gratis' : formatCLP(price)}
            </span>
            {price !== null ? (
              <span className="pb-1 text-sm text-text-muted">/{annual ? 'año' : 'mes'}</span>
            ) : null}
          </div>
        </div>

        <ul className="mt-5 flex-1 space-y-3">
          {plan.featureHighlights.slice(0, 4).map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary-lighter" />
              <span className="text-sm leading-6 text-text-secondary">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Button variant={tier === 'premium' ? 'primary' : 'secondary'} className="w-full" onClick={onSelect}>
            {tier === 'free' ? 'Empezar gratis' : 'Activar Premium'}
          </Button>
        </div>
      </div>
    </article>
  );
}

// ============================================
// Casa Clara — Landing Page
// ============================================

import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { PLANS, APP_NAME, APP_TAGLINE } from '../../lib/constants';
import { formatCLP } from '../../utils/format-clp';
import {
  Home, Shield, PieChart, Target, CalendarCheck, Users,
  CheckCircle, ChevronDown, ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-text">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Iniciar sesión
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/registro')}>
              Comenzar gratis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 lg:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-bg text-primary text-sm font-medium mb-6">
            <Home className="h-4 w-4" />
            Para parejas y hogares en Chile
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold text-text mb-6 leading-tight">
            {APP_TAGLINE.split('sin')[0]}
            <span className="text-primary">sin pelear ni depender de Excel.</span>
          </h1>
          <p className="text-lg lg:text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
            Casa Clara te ayuda a coordinar ingresos, gastos compartidos, reglas de reparto y metas de ahorro con tu pareja. Todo claro, justo y bajo control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/registro')}>
              Crear mi hogar <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => {
              document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Ver planes
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-surface border-y border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold text-text text-center mb-12">
            ¿Qué puedes hacer con Casa Clara?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: PieChart, title: 'Ordena tus gastos', desc: 'Registra ingresos y gastos. Separa lo personal de lo compartido. Clasifica por categoría.' },
              { icon: Users, title: 'Reparte con justicia', desc: 'Define reglas claras: 50/50, proporcional o personalizado. Visualiza quién aportó cuánto.' },
              { icon: Target, title: 'Avanza tus metas', desc: 'Crea metas de ahorro reales. Ve tu avance mes a mes. Siente que estás progresando.' },
              { icon: CalendarCheck, title: 'Controla tus pagos', desc: 'Calendario de pagos próximos. Alertas de vencimiento. Nunca más un pago olvidado.' },
              { icon: Shield, title: 'Seguro y privado', desc: 'Tus datos son solo tuyos. Acceso protegido. Cada hogar aislado del resto.' },
              { icon: Home, title: 'Pensado para Chile', desc: 'Moneda CLP, categorías de hogar chileno, zona horaria Santiago. Hecho para ti.' },
            ].map((item, i) => (
              <div key={i} className="bg-bg rounded-xl p-6 border border-border-light">
                <div className="h-10 w-10 rounded-lg bg-primary-bg flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-text mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planes" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold text-text text-center mb-4">
            Planes simples, sin letra chica
          </h2>
          <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
            Elige el plan que se ajuste a tu hogar. Cambia o cancela cuando quieras.
          </p>

          <PricingCards onSelect={() => navigate('/registro')} />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-text text-center mb-10">
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {[
              { q: '¿Puedo usar Casa Clara solo/a?', a: 'Sí. Puedes usar Casa Clara con o sin pareja. Solo necesitas crear tu hogar y empezar a registrar.' },
              { q: '¿Mis datos están seguros?', a: 'Sí. Usamos autenticación segura, cifrado en tránsito, y cada hogar está completamente aislado del resto.' },
              { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Puedes cancelar tu suscripción cuando quieras. Tu información queda disponible en modo lectura.' },
              { q: '¿Funciona en celular?', a: 'Sí. Casa Clara funciona perfecto desde el navegador de tu celular. No necesitas instalar nada.' },
              { q: '¿Qué métodos de pago aceptan?', a: 'Aceptamos tarjeta de crédito y débito a través de Mercado Pago chile.' },
              { q: '¿Puedo cambiar de plan?', a: 'Sí. Puedes subir de Base a Plus en cualquier momento desde la configuración de tu cuenta.' },
            ].map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-text mb-4">
            ¿Listo para ordenar tu hogar?
          </h2>
          <p className="text-text-muted mb-8">
            Crea tu hogar en menos de 3 minutos. Sin tarjeta de crédito para empezar.
          </p>
          <Button size="lg" onClick={() => navigate('/registro')}>
            Comenzar ahora <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Home className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-text">{APP_NAME}</span>
          </div>
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} Casa Clara. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// Pricing Cards
// ============================================
function PricingCards({ onSelect }: { onSelect: () => void }) {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!annual ? 'text-text' : 'text-text-muted'}`}>Mensual</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${annual ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${annual ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-text' : 'text-text-muted'}`}>
          Anual
          <span className="ml-1.5 text-xs text-success font-semibold">Ahorra más</span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {(['base', 'plus'] as const).map(planKey => {
          const plan = PLANS[planKey];
          const price = annual ? plan.prices.yearly : plan.prices.monthly;
          const isPlus = planKey === 'plus';

          return (
            <div
              key={planKey}
              className={`relative bg-surface rounded-2xl p-8 border-2 transition-all ${
                isPlus ? 'border-primary shadow-md' : 'border-border'
              }`}
            >
              {isPlus && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold rounded-full">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-bold text-text mb-2">{plan.name}</h3>
              <p className="text-sm text-text-muted mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-text">{formatCLP(price)}</span>
                <span className="text-text-muted text-sm">/{annual ? 'año' : 'mes'}</span>
                {annual && (
                  <p className="text-xs text-success mt-1">
                    Ahorras {formatCLP(plan.savings.yearly)} al año
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={isPlus ? 'primary' : 'secondary'}
                className="w-full"
                onClick={onSelect}
              >
                Elegir {plan.name}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// FAQ Item
// ============================================
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <span className="font-medium text-text text-sm">{question}</span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-sm text-text-muted">{answer}</p>
        </div>
      )}
    </div>
  );
}

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  GitCompare,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Scale,
  Settings,
  Tags,
  Target,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, PlanBadge } from '../ui';
import type { FeatureKey } from '../../lib/constants';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  feature?: FeatureKey;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', label: 'Control', icon: LayoutDashboard },
  { to: '/app/movimientos', label: 'Movimientos', icon: ArrowUpDown },
  { to: '/app/calendario', label: 'Calendario', icon: CalendarClock },
  { to: '/app/metas', label: 'Metas', icon: Target },
  { to: '/app/resumen', label: 'Resumen', icon: BarChart3 },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { to: '/app/categorias', label: 'Categorías', icon: Tags },
  { to: '/app/reparto', label: 'Reparto', icon: Scale, feature: 'split_manual' },
  { to: '/app/cierre', label: 'Cierre mensual', icon: ClipboardCheck, feature: 'monthly_close_simple' },
  { to: '/app/configuracion', label: 'Configuración', icon: Settings },
  { to: '/app/suscripcion', label: 'Suscripción', icon: CreditCard },
  { to: '/app/csv', label: 'Importar CSV', icon: FileSpreadsheet, feature: 'csv_import' },
  { to: '/app/recurrencias', label: 'Recurrencias', icon: Repeat, feature: 'recurring_transactions' },
  { to: '/app/comparacion', label: 'Comparación', icon: GitCompare, feature: 'monthly_comparison' },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const { household } = useHousehold();
  const { isRestricted, ctaMessage, ctaAction, ctaRoute, hasFeature, planName } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('compas-hogar:sidebar-collapsed') === '1';
  });
  const [secondaryNavOpen, setSecondaryNavOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('compas-hogar:sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const visiblePrimary = useMemo(
    () => PRIMARY_NAV_ITEMS.filter((item) => !item.feature || hasFeature(item.feature)),
    [hasFeature],
  );
  const visibleSecondary = useMemo(
    () => SECONDARY_NAV_ITEMS.filter((item) => !item.feature || hasFeature(item.feature)),
    [hasFeature],
  );
  const isSecondaryRoute = visibleSecondary.some((item) => location.pathname.startsWith(item.to));
  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((name) => name[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function renderNavItem(item: NavItem) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        title={sidebarCollapsed ? item.label : undefined}
        aria-label={item.label}
        className={({ isActive }) =>
          `group flex min-h-11 items-center rounded-xl border px-3 transition-colors ${
            sidebarCollapsed ? 'justify-center' : 'gap-3'
          } ${
            isActive
              ? 'border-primary/15 bg-primary-bg text-primary'
              : 'border-transparent text-text-muted hover:border-border hover:bg-surface-low hover:text-text'
          }`
        }
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
      </NavLink>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text lg:p-[var(--app-frame-y)]">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar navegación"
        />
      ) : null}

      <div className="lg:flex lg:min-h-[calc(100vh-2*var(--app-frame-y))] lg:gap-4">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[18.5rem] max-w-[85vw] flex-col border-r border-border bg-surface px-3 py-4 transition-transform duration-200 lg:static lg:inset-auto lg:h-[calc(100vh-2*var(--app-frame-y))] lg:shrink-0 lg:rounded-[1.5rem] lg:border lg:shadow-panel ${
            sidebarCollapsed ? 'lg:w-[5.75rem]' : 'lg:w-[18rem]'
          } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          aria-label="Barra lateral"
        >
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3 px-1 pb-4`}>
            <div className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'hidden lg:flex lg:flex-col lg:items-center' : ''}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                <Home className="h-5 w-5" />
              </div>
              {!sidebarCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-text">Compás Hogar</p>
                  <p className="truncate text-[11px] uppercase tracking-[0.16em] text-text-light">
                    {household?.name || 'Mi hogar'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className="hidden lg:inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:bg-surface-low hover:text-text"
                aria-label={sidebarCollapsed ? 'Expandir navegación' : 'Contraer navegación'}
                title={sidebarCollapsed ? 'Expandir navegación' : 'Contraer navegación'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:bg-surface-low hover:text-text lg:hidden"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!sidebarCollapsed ? (
            <div className="px-1 pb-4">
              <PlanBadge>{planName}</PlanBadge>
            </div>
          ) : null}

          <nav className="flex-1 overflow-y-auto pr-1" aria-label="Navegación principal">
            <div className="space-y-1">{visiblePrimary.map(renderNavItem)}</div>

            <div className="mt-5 border-t border-border-light pt-4">
              <button
                type="button"
                onClick={() => setSecondaryNavOpen((value) => !value)}
                className={`flex min-h-11 w-full items-center rounded-xl border px-3 text-sm font-medium transition-colors ${
                  sidebarCollapsed ? 'justify-center' : 'gap-3'
                } ${
                  isSecondaryRoute || secondaryNavOpen
                    ? 'border-border bg-surface-low text-text'
                    : 'border-transparent text-text-muted hover:border-border hover:bg-surface-low hover:text-text'
                }`}
                aria-expanded={secondaryNavOpen || isSecondaryRoute}
                aria-controls="secondary-navigation"
                title={sidebarCollapsed ? 'Más opciones' : undefined}
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed ? <span className="truncate">Más</span> : null}
              </button>

              {(secondaryNavOpen || isSecondaryRoute) && (
                <div id="secondary-navigation" className="mt-2 space-y-1">
                  {visibleSecondary.map(renderNavItem)}
                </div>
              )}
            </div>
          </nav>

          <div className="mt-4 border-t border-border-light pt-4">
            <div className={`rounded-2xl border border-border bg-surface-low px-3 py-3 ${sidebarCollapsed ? 'text-center' : ''}`}>
              <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-bg text-xs font-semibold text-primary">
                  {initials}
                </div>
                {!sidebarCollapsed ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{profile?.full_name || 'Usuario'}</p>
                    <p className="truncate text-xs text-text-light">{profile?.email}</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className={`mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-bg ${
                  sidebarCollapsed ? 'w-full' : ''
                }`}
                title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
              >
                <LogOut className="h-4 w-4" />
                {!sidebarCollapsed ? <span>Cerrar sesión</span> : null}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-surface/94 px-4 py-3 backdrop-blur-md lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:bg-surface-low hover:text-text"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-base font-semibold text-text">Compás Hogar</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-text-light">
                    {household?.name || 'Mi hogar'}
                  </p>
                </div>
              </div>
              <PlanBadge>{planName}</PlanBadge>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
            <div className="page-shell">
              {isRestricted && ctaMessage ? (
                <div className="mb-6">
                  <AlertBanner
                    type="warning"
                    message={ctaMessage}
                    action={{ label: ctaAction, onClick: () => navigate(ctaRoute) }}
                  />
                </div>
              ) : null}

              <div className="page-enter">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

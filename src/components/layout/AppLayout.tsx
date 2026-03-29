// ============================================
// Casa Clara — App Layout (Sidebar + Header) — Stitch M3 Edition
// ============================================

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner } from '../ui';
import { PlanBadge } from '../ui';
import {
  LayoutDashboard, ArrowUpDown, Tags, Scale, CalendarClock,
  Target, BarChart3, FileSpreadsheet, Repeat, GitCompare,
  ClipboardCheck, Settings, CreditCard, LogOut, Menu, X,
  Home, PanelLeftClose, PanelLeftOpen, MoreHorizontal,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import type { FeatureKey } from '../../lib/constants';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  feature?: FeatureKey;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard',    label: 'Panel general', icon: LayoutDashboard },
  { to: '/app/movimientos',  label: 'Movimientos',   icon: ArrowUpDown },
  { to: '/app/calendario',   label: 'Calendario',    icon: CalendarClock },
  { to: '/app/metas',        label: 'Metas',         icon: Target },
  { to: '/app/resumen',      label: 'Resumen',       icon: BarChart3 },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { to: '/app/categorias',   label: 'Categorías',     icon: Tags },
  { to: '/app/reparto',      label: 'Reparto',        icon: Scale,         feature: 'split_manual' as FeatureKey },
  { to: '/app/cierre',       label: 'Cierre mensual', icon: ClipboardCheck, feature: 'monthly_close_simple' as FeatureKey },
  { to: '/app/configuracion',label: 'Configuración',  icon: Settings },
  { to: '/app/suscripcion',  label: 'Suscripción',    icon: CreditCard },
  { to: '/app/csv',          label: 'Importar CSV',   icon: FileSpreadsheet, feature: 'csv_import' as FeatureKey },
  { to: '/app/recurrencias', label: 'Recurrencias',   icon: Repeat,        feature: 'recurring_transactions' as FeatureKey },
  { to: '/app/comparacion',  label: 'Comparación',    icon: GitCompare,    feature: 'monthly_comparison' as FeatureKey },
];

// ─── CSS variable shortcuts ────────────────────────────────────────────────────
const C = {
  bg:               'var(--color-s-bg)',
  surface:          'var(--color-s-surface-low)', /* Light anchor background */
  surfaceHigh:      'transparent',
  surfaceLowest:    'var(--color-s-surface-lowest)',
  outline:          'var(--color-s-border)',
  onSurface:        'var(--color-s-text)',
  onSurfaceVariant: 'var(--color-s-text-muted)',
  primary:          'var(--color-s-primary)',
  onPrimary:        'var(--color-s-on-primary)',
  primaryContainer: 'var(--color-s-surface-container)',
  onPrimaryContainer: 'var(--color-s-text)',
  secondaryContainer: 'transparent',
  onSecondaryContainer: 'var(--color-s-primary)',
  error:            'var(--color-s-danger)',
  fontHeadline:     'var(--font-headline)',
  fontSans:         'var(--font-body)',
};

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const { household } = useHousehold();
  const { isRestricted, ctaMessage, ctaAction, ctaRoute, hasFeature, planName } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen]               = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed]     = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('compas-hogar:sidebar-collapsed') === '1';
  });
  const [sidebarPreviewOpen, setSidebarPreviewOpen] = useState(false);
  const [secondaryNavOpen, setSecondaryNavOpen]     = useState(false);

  useEffect(() => {
    window.localStorage.setItem('compas-hogar:sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const isSidebarExpanded = !sidebarCollapsed || sidebarPreviewOpen;

  const handleSidebarToggle     = () => { setSidebarPreviewOpen(false); setSidebarCollapsed(v => !v); };
  const handleSidebarFocusEnter = () => { if (sidebarCollapsed) setSidebarPreviewOpen(true); };
  const handleSidebarFocusLeave = (e: React.FocusEvent<HTMLElement>) => {
    if (!sidebarCollapsed) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSidebarPreviewOpen(false);
  };
  const handleSidebarMouseEnter = () => { if (sidebarCollapsed) setSidebarPreviewOpen(true); };
  const handleSidebarMouseLeave = () => { if (sidebarCollapsed) setSidebarPreviewOpen(false); };
  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const visiblePrimary   = PRIMARY_NAV_ITEMS.filter(i => !i.feature || hasFeature(i.feature));
  const visibleSecondary = SECONDARY_NAV_ITEMS.filter(i => !i.feature || hasFeature(i.feature));
  const isSecondaryRoute = visibleSecondary.some(i => location.pathname.startsWith(i.to));

  const toggleSecondaryNav = () => {
    if (!isSidebarExpanded) { setSidebarCollapsed(false); setSecondaryNavOpen(true); return; }
    setSecondaryNavOpen(v => !v);
  };

  const initials = (profile?.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // Reusable NavEntry renderer
  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={() => setSidebarOpen(false)}
      title={!isSidebarExpanded ? item.label : undefined}
      aria-label={item.label}
      className={({ isActive }) =>
        `group relative flex items-center rounded-2xl text-[13px] transition-all duration-300 ${
          isSidebarExpanded ? 'gap-4 px-5 py-2' : 'justify-center py-3'
        } ${isActive ? 'font-bold' : 'font-medium'}`
      }
      style={({ isActive }) =>
        isActive
          ? { color: C.primary, background: 'var(--color-s-surface-lowest)', boxShadow: 'var(--shadow-ambient)' }
          : { color: C.onSurfaceVariant }
      }
    >
      {({ isActive }) => (
        <>
          <span className={`inline-flex items-center justify-center rounded-xl shrink-0 transition-all ${
            isSidebarExpanded ? 'h-8 w-8' : 'h-10 w-10 shadow-sm bg-white'
          } ${!isActive ? 'group-hover:bg-black/5 opacity-70 group-hover:opacity-100' : ''}`}>
            <item.icon className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100 group-hover:scale-105'} ${
              isSidebarExpanded ? 'h-4 w-4' : 'h-5 w-5'
            }`} />
          </span>
          {isSidebarExpanded && <span className="truncate tracking-tight opacity-90">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex" style={{ background: C.bg, color: C.onSurface }}>

      {/* ── Mobile overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm animate-in fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        onFocusCapture={handleSidebarFocusEnter}
        onBlurCapture={handleSidebarFocusLeave}
        className={`fixed lg:relative inset-y-0 left-0 z-50 overflow-visible flex flex-col
          transform transition-[transform,width] duration-500 ease-in-out lg:translate-x-0
          ${isSidebarExpanded ? 'lg:w-[280px]' : 'lg:w-20'} w-72
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: C.surface, borderRight: `1px solid ${C.outline}` }}
      >
        {/* Invisible collapse hit-zone */}
        <button
          type="button"
          onClick={handleSidebarToggle}
          onMouseEnter={handleSidebarMouseEnter}
          onFocus={handleSidebarFocusEnter}
          className="hidden lg:block absolute inset-y-0 right-0 z-30 w-6 cursor-pointer"
          title={sidebarCollapsed ? 'Mantener menú abierto' : 'Contraer menú'}
          aria-label={sidebarCollapsed ? 'Mantener menú abierto' : 'Contraer menú'}
        />
        {/* Collapse visual indicator */}
        <div
          className={`pointer-events-none hidden lg:flex absolute right-1 top-1/2 z-20 h-14 w-10
            -translate-y-1/2 items-center justify-center rounded-2xl shadow-ambient transition-all duration-300 ${
              isSidebarExpanded ? 'translate-x-12 opacity-0' : 'translate-x-0 opacity-100'
            }`}
          style={{ background: C.surfaceLowest, border: `1px solid ${C.outline}`, color: C.onSurfaceVariant }}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </div>

        {/* ── Brand ─────────────────────────────────────────── */}
        <div
          className={`flex items-center gap-4 ${isSidebarExpanded ? 'px-6 py-8' : 'px-4 py-8 justify-center'}`}
        >
          {isSidebarExpanded ? (
            <>
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-ambient"
                style={{ background: C.primary, color: C.onPrimary }}>
                <Home className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-[14px] leading-tight tracking-tight"
                  style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
                  Compás<br />Hogar
                </h1>
                <p className="text-[11px] uppercase tracking-[0.12em] font-bold" style={{ color: C.onSurfaceVariant }}>
                  {household?.name || 'Mi hogar'}
                </p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg cursor-pointer hover:bg-black/5"
                style={{ color: C.onSurfaceVariant }}>
                <X className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSidebarCollapsed(false)}
              className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-ambient transition cursor-pointer"
              style={{ background: C.primary, color: C.onPrimary }} title="Abrir menú" aria-label="Abrir menú">
              <Home className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ── Plan badge ────────────────────────────────────── */}
        {isSidebarExpanded && (
          <div className="px-6 py-2">
            <PlanBadge>{planName}</PlanBadge>
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────── */}
        <nav className={`flex-1 overflow-y-auto py-6 ${isSidebarExpanded ? 'px-4' : 'px-3'}`}>
          <div className="space-y-1">
            {visiblePrimary.map(renderNavItem)}
          </div>

          {/* Secondary nav toggle */}
          <div className="mt-4">
            <button type="button" onClick={toggleSecondaryNav}
              title={!isSidebarExpanded ? 'Más opciones' : undefined}
              aria-label="Más opciones"
              className={`group flex w-full items-center rounded-xl text-sm font-semibold transition-all hover:bg-black/5 ${
                isSidebarExpanded ? 'gap-4 px-4 py-3' : 'justify-center py-4'
              }`}
              style={{ color: C.onSurfaceVariant }}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
                <MoreHorizontal className="h-[20px] w-[20px]" />
              </span>
              {isSidebarExpanded && (
                <>
                  <span className="truncate">Opciones</span>
                  <span className="ml-auto opacity-50">
                    {secondaryNavOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </>
              )}
            </button>
          </div>

          {(secondaryNavOpen || isSecondaryRoute) && (
            <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {visibleSecondary.map(renderNavItem)}
            </div>
          )}
        </nav>

        {/* ── User profile ──────────────────────────────────── */}
        <div className={`mt-auto ${isSidebarExpanded ? 'p-6' : 'p-4'}`}>
          <div
            className={`rounded-2xl flex ${isSidebarExpanded ? 'items-center gap-3 px-4 py-3.5' : 'flex-col items-center gap-3 px-2 py-3'}`}
            style={{ background: C.surfaceLowest, border: `1px solid ${C.outline}`, boxShadow: 'var(--shadow-ambient)' }}
          >
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: C.primaryContainer, color: C.onPrimaryContainer, fontFamily: C.fontSans }}
              title={profile?.full_name || 'Usuario'}>
              {initials}
            </div>
            {isSidebarExpanded ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate tracking-tight" style={{ color: C.onSurface }}>
                    {profile?.full_name || 'Usuario'}
                  </p>
                  <p className="text-[11px] truncate opacity-60" style={{ color: C.onSurfaceVariant }}>
                    {profile?.email}
                  </p>
                </div>
                <button onClick={handleSignOut}
                  className="p-2 rounded-lg transition cursor-pointer shrink-0 hover:bg-red-50"
                  style={{ color: C.error }} title="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button onClick={handleSignOut}
                className="p-2 rounded-lg transition cursor-pointer hover:bg-red-50"
                style={{ color: C.error }} title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 px-6 py-4 flex items-center justify-between"
          style={{ background: C.surface, borderBottom: `1px solid ${C.outline}`, backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="cursor-pointer p-1.5 rounded-lg hover:bg-black/5" style={{ color: C.onSurfaceVariant }}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-ambient"
                style={{ background: C.primary, color: C.onPrimary }}>
                <Home className="h-4 w-4" />
              </div>
                <span className="block text-[14px] leading-tight font-bold tracking-tight"
                  style={{ fontFamily: C.fontHeadline, color: C.onSurface }}>
                  Compás<br />Hogar
                </span>
            </div>
          </div>
        </header>

        {/* The "Breath" Rule: Top-of-page margins (spacing-20 = 7.5rem / 5rem used for balance) */}
        <div className="w-full max-w-[1600px] mx-auto pt-8 lg:pt-16 pb-12 px-12 lg:px-40">
          
          {/* Restricted mode banner */}
          {isRestricted && ctaMessage && (
            <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertBanner
                type="warning"
                message={ctaMessage}
                action={{ label: ctaAction, onClick: () => navigate(ctaRoute) }}
              />
            </div>
          )}

          {/* Page content */}
          <div className="page-enter">
            <Outlet />
          </div>
        </div>

      </main>
    </div>
  );
}

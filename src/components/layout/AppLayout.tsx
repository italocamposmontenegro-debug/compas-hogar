// ============================================
// Casa Clara — App Layout (Sidebar + Header)
// ============================================

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner } from '../ui';
import {
  LayoutDashboard, ArrowUpDown, Tags, Scale, CalendarClock,
  Target, BarChart3, FileSpreadsheet, Repeat, GitCompare,
  ClipboardCheck, Settings, CreditCard, LogOut, Menu, X, Home,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/movimientos', label: 'Movimientos', icon: ArrowUpDown },
  { to: '/app/categorias', label: 'Categorías', icon: Tags },
  { to: '/app/reparto', label: 'Reparto', icon: Scale },
  { to: '/app/calendario', label: 'Calendario', icon: CalendarClock },
  { to: '/app/metas', label: 'Metas', icon: Target },
  { to: '/app/resumen', label: 'Resumen', icon: BarChart3 },
];

const PLUS_NAV_ITEMS = [
  { to: '/app/csv', label: 'Importar CSV', icon: FileSpreadsheet, plus: true },
  { to: '/app/recurrencias', label: 'Recurrencias', icon: Repeat, plus: true },
  { to: '/app/comparacion', label: 'Comparación', icon: GitCompare, plus: true },
  { to: '/app/cierre', label: 'Cierre mensual', icon: ClipboardCheck, plus: true },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const { household } = useHousehold();
  const { isRestricted, ctaMessage, ctaAction, ctaRoute, canUsePlus } = useSubscription();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col transform transition-transform duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Home className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-text text-sm">Casa Clara</h1>
                <p className="text-xs text-text-muted truncate max-w-[140px]">{household?.name || 'Mi hogar'}</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-text-muted cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-bg text-primary'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Plus features */}
          <div className="mt-6">
            <p className="px-3 text-xs font-semibold text-text-light uppercase tracking-wider mb-2">
              Plus {!canUsePlus && '🔒'}
            </p>
            <div className="space-y-0.5">
              {PLUS_NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-bg text-primary'
                        : canUsePlus
                          ? 'text-text-secondary hover:bg-surface-hover'
                          : 'text-text-light hover:bg-surface-hover'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Config */}
          <div className="mt-6 space-y-0.5">
            <NavLink
              to="/app/configuracion"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-bg text-primary' : 'text-text-secondary hover:bg-surface-hover'
                }`
              }
            >
              <Settings className="h-4 w-4" />
              Configuración
            </NavLink>
            <NavLink
              to="/app/suscripcion"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-bg text-primary' : 'text-text-secondary hover:bg-surface-hover'
                }`
              }
            >
              <CreditCard className="h-4 w-4" />
              Suscripción
            </NavLink>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-xs text-text-muted truncate">{profile?.email}</p>
            </div>
            <button onClick={handleSignOut} className="text-text-muted hover:text-danger p-1.5 rounded-lg hover:bg-surface-hover cursor-pointer" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-text-muted cursor-pointer">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <Home className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-sm text-text">Casa Clara</span>
          </div>
        </header>

        {/* Restricted mode banner */}
        {isRestricted && ctaMessage && (
          <div className="px-4 lg:px-8 pt-4">
            <AlertBanner
              type="warning"
              message={ctaMessage}
              action={{
                label: ctaAction,
                onClick: () => navigate(ctaRoute),
              }}
            />
          </div>
        )}

        {/* Page content */}
        <div className="p-4 lg:p-8 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { AlertBanner, Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useControlAccess } from '../../hooks/useControlAccess';
import {
  CONTROL_MODULE_LABELS,
  CONTROL_ROLE_DESCRIPTIONS,
  CONTROL_ROLE_LABELS,
  type ControlModuleKey,
} from '../../../shared/control';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const MODULES: ControlModuleKey[] = ['executive', 'billing', 'customers', 'operations', 'risk', 'growth'];

export function ControlLayout() {
  const { profile } = useAuth();
  const { roles, primaryRole, canAccessModule, isLegacyAdminFallback } = useControlAccess();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6 lg:py-6">
        <header className="ui-panel overflow-hidden p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <BrandLogo mode="full" className="h-9 w-auto" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Sistema maestro de control v1</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">Dirección y control interno</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted">
                  Lectura ejecutiva, operación segura y trazabilidad real sobre la base del producto actual.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => window.location.assign('/app/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
                Volver a la app
              </Button>
              <div className="rounded-2xl border border-border bg-surface-low px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Acceso actual</p>
                <p className="mt-2 text-sm font-semibold text-text">
                  {primaryRole ? CONTROL_ROLE_LABELS[primaryRole] : 'Sin rol asignado'}
                </p>
                <p className="mt-1 max-w-xs text-xs leading-6 text-text-muted">
                  {primaryRole ? CONTROL_ROLE_DESCRIPTIONS[primaryRole] : 'No se encontró un rol interno activo para esta cuenta.'}
                </p>
                {profile?.full_name ? (
                  <p className="mt-2 text-xs text-text-light">
                    {profile.full_name} · {profile.email}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {isLegacyAdminFallback ? (
          <AlertBanner
            type="warning"
            message="Esta cuenta está entrando por compatibilidad heredada desde is_admin. Conviene asignarle un rol explícito en la nueva capa RBAC."
          />
        ) : null}

        <nav className="ui-panel overflow-hidden p-3" aria-label="Navegación del sistema de control">
          <div className="flex flex-wrap gap-2">
            {MODULES.filter((module) => canAccessModule(module)).map((module) => (
              <NavLink
                key={module}
                to={`/app/control/${moduleLabelToPath(module)}`}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary/20 bg-primary-bg text-primary'
                      : 'border-border bg-surface-low text-text-secondary hover:border-border-light hover:text-text'
                  }`
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {CONTROL_MODULE_LABELS[module]}
              </NavLink>
            ))}
          </div>
          {roles.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map((role) => (
                <span key={role} className="inline-flex min-h-8 items-center rounded-full border border-border bg-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {CONTROL_ROLE_LABELS[role]}
                </span>
              ))}
            </div>
          ) : null}
        </nav>

        <main className="flex-1">
          <div className="space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function moduleLabelToPath(module: ControlModuleKey) {
  switch (module) {
    case 'executive':
      return 'ejecutivo';
    case 'billing':
      return 'billing';
    case 'customers':
      return 'clientes';
    case 'operations':
      return 'operaciones';
    case 'risk':
      return 'riesgos';
    case 'growth':
      return 'crecimiento';
    default:
      return 'ejecutivo';
  }
}

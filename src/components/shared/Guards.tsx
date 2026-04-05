// ============================================
// Casa Clara — Route Guards
// ============================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useControlAccess } from '../../hooks/useControlAccess';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { BlockingStatePage, LoadingPage } from '../ui';
import type { FeatureKey } from '../../lib/constants';
import type { ControlModuleKey } from '../../../shared/control';
import { getDefaultControlModule } from '../../../shared/control';

/**
 * Guard 1: Requiere autenticación
 */
export function AuthGuard() {
  const location = useLocation();
  const { user, loading, error } = useAuth();

  if (error) {
    return (
      <BlockingStatePage
        title="No pudimos abrir tu sesión"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Ir al inicio', onClick: () => window.location.assign('/') }}
      />
    );
  }
  if (loading) return <LoadingPage />;
  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Outlet />;
}

/**
 * Guard 2: Requiere pertenecer a un hogar
 */
export function HouseholdGuard() {
  const { hasHousehold, loading, error, refetch } = useHousehold();

  if (error) {
    return (
      <BlockingStatePage
        title="No pudimos cargar tu hogar"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => { void refetch(); } }}
        secondaryAction={{ label: 'Ir al inicio', onClick: () => window.location.assign('/') }}
      />
    );
  }
  if (loading) return <LoadingPage />;
  if (!hasHousehold) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}

/**
 * Guard 3: Requiere una capacidad del plan actual
 */
export function FeatureRouteGuard({ feature }: { feature: FeatureKey }) {
  const { hasFeature, getUpgradeCopy } = useSubscription();

  if (!hasFeature(feature)) {
    const upgrade = getUpgradeCopy(feature);
    return <Navigate to={upgrade.route || '/app/suscripcion'} replace />;
  }

  return <Outlet />;
}

/**
 * Guard 4: Requiere admin
 */
export function AdminGuard() {
  const { profile, loading, error } = useAuth();

  if (error) {
    return (
      <BlockingStatePage
        title="No pudimos validar tu acceso"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Ir al inicio', onClick: () => window.location.assign('/') }}
      />
    );
  }
  if (loading) return <LoadingPage />;
  if (!profile?.is_admin) return <Navigate to="/app/resumen" replace />;

  return <Outlet />;
}

/**
 * Guard 5: Requiere acceso al sistema de control
 */
export function ControlGuard() {
  const { loading, error, hasAccess, roles } = useControlAccess();

  if (error && !hasAccess) {
    return (
      <BlockingStatePage
        title="No pudimos validar tu acceso interno"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Volver al resumen', onClick: () => window.location.assign('/app/resumen') }}
      />
    );
  }
  if (loading) return <LoadingPage />;
  if (!hasAccess) return <Navigate to="/app/resumen" replace />;

  const defaultModule = getDefaultControlModule(roles);
  if (!defaultModule) return <Navigate to="/app/resumen" replace />;

  return <Outlet />;
}

/**
 * Guard 6: Requiere acceso a un módulo del sistema de control
 */
export function ControlModuleGuard({ module }: { module: ControlModuleKey }) {
  const { loading, error, canAccessModule, roles } = useControlAccess();

  if (error && !canAccessModule(module)) {
    return (
      <BlockingStatePage
        title="No pudimos abrir este módulo"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Ir al panel ejecutivo', onClick: () => window.location.assign('/app/control/ejecutivo') }}
      />
    );
  }
  if (loading) return <LoadingPage />;
  if (!canAccessModule(module)) {
    const fallbackModule = getDefaultControlModule(roles);
    if (!fallbackModule) return <Navigate to="/app/resumen" replace />;
    return <Navigate to={getControlModuleRoute(fallbackModule)} replace />;
  }

  return <Outlet />;
}

export function ControlEntryRedirect() {
  const { loading, roles, hasAccess } = useControlAccess();

  if (loading) return <LoadingPage />;
  if (!hasAccess) return <Navigate to="/app/resumen" replace />;

  const module = getDefaultControlModule(roles);
  if (!module) return <Navigate to="/app/resumen" replace />;

  return <Navigate to={getControlModuleRoute(module)} replace />;
}

function getControlModuleRoute(module: ControlModuleKey) {
  switch (module) {
    case 'executive':
      return '/app/control/ejecutivo';
    case 'billing':
      return '/app/control/billing';
    case 'customers':
      return '/app/control/clientes';
    case 'operations':
      return '/app/control/operaciones';
    case 'risk':
      return '/app/control/riesgos';
    case 'growth':
      return '/app/control/crecimiento';
    default:
      return '/app/resumen';
  }
}

/**
 * Redirect if already logged in
 */
export function PublicOnlyGuard() {
  const { user, loading, error } = useAuth();
  const { hasHousehold, loading: householdLoading, error: householdError, refetch } = useHousehold();

  if (error) {
    return (
      <BlockingStatePage
        title="No pudimos abrir la aplicación"
        description={error}
        primaryAction={{ label: 'Reintentar', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Ir al inicio', onClick: () => window.location.assign('/') }}
      />
    );
  }
  if (user && householdError) {
    return (
      <BlockingStatePage
        title="No pudimos cargar tu hogar"
        description={householdError}
        primaryAction={{ label: 'Reintentar', onClick: () => { void refetch(); } }}
        secondaryAction={{ label: 'Ir al inicio', onClick: () => window.location.assign('/') }}
      />
    );
  }
  if (loading || (user && householdLoading)) return <LoadingPage />;

  if (user) {
    if (hasHousehold) return <Navigate to="/app/resumen" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

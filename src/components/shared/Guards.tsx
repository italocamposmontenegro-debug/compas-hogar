// ============================================
// Casa Clara — Route Guards
// ============================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { BlockingStatePage, LoadingPage } from '../ui';

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
 * Guard 3: Requiere plan Plus activo (para rutas Plus)
 */
export function PlusFeatureGuard() {
  const { canUsePlus, isActive } = useSubscription();

  if (!isActive || !canUsePlus) {
    return <Navigate to="/app/suscripcion" replace />;
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
  if (!profile?.is_admin) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
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
    if (hasHousehold) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

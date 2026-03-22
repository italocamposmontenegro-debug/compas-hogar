// ============================================
// Casa Clara — Route Guards
// ============================================

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { LoadingPage } from '../ui';

/**
 * Guard 1: Requiere autenticación
 */
export function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

/**
 * Guard 2: Requiere pertenecer a un hogar
 */
export function HouseholdGuard() {
  const { hasHousehold, loading } = useHousehold();

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
  const { profile, loading } = useAuth();

  if (loading) return <LoadingPage />;
  if (!profile?.is_admin) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
}

/**
 * Redirect if already logged in
 */
export function PublicOnlyGuard() {
  const { user, loading } = useAuth();
  const { hasHousehold } = useHousehold();

  if (loading) return <LoadingPage />;

  if (user) {
    if (hasHousehold) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

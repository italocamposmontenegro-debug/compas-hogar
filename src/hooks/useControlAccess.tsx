/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ControlRoleAssignment } from '../types/database';
import {
  canAccessControlModule,
  dedupeControlRoles,
  getControlCapabilities,
  getPrimaryControlRole,
  type ControlCapability,
  type ControlModuleKey,
  type ControlRole,
} from '../../shared/control';

interface ControlAccessContextValue {
  roles: ControlRole[];
  primaryRole: ControlRole | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  isLegacyAdminFallback: boolean;
  canAccessModule: (module: ControlModuleKey) => boolean;
  hasCapability: (capability: ControlCapability) => boolean;
}

const ControlAccessContext = createContext<ControlAccessContextValue | null>(null);

export function ControlAccessProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<ControlRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLegacyAdminFallback, setIsLegacyAdminFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadControlRoles = async () => {
      if (authLoading) {
        setLoading(true);
        return;
      }

      if (!user) {
        setRoles([]);
        setError(null);
        setLoading(false);
        setIsLegacyAdminFallback(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('control_role_assignments')
          .select('role, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) {
          if (profile?.is_admin) {
            if (!cancelled) {
              setRoles(['BREAK_GLASS']);
              setIsLegacyAdminFallback(true);
              setLoading(false);
            }
            return;
          }

          throw error;
        }

        const dbRoles = ((data ?? []) as Pick<ControlRoleAssignment, 'role' | 'is_active'>[])
          .map((item) => item.role);
        const nextRoles = dedupeControlRoles([
          ...dbRoles,
          profile?.is_admin ? 'BREAK_GLASS' : null,
        ]);

        if (!cancelled) {
          setRoles(nextRoles);
          setIsLegacyAdminFallback(profile?.is_admin === true && !dbRoles.includes('BREAK_GLASS'));
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setRoles(profile?.is_admin ? ['BREAK_GLASS'] : []);
          setIsLegacyAdminFallback(Boolean(profile?.is_admin));
          setError(error instanceof Error ? error.message : 'No pudimos validar tus permisos internos.');
          setLoading(false);
        }
      }
    };

    void loadControlRoles();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.is_admin, user]);

  const capabilities = useMemo(() => getControlCapabilities(roles), [roles]);
  const value = useMemo<ControlAccessContextValue>(() => ({
    roles,
    primaryRole: getPrimaryControlRole(roles),
    loading,
    error,
    hasAccess: roles.length > 0,
    isLegacyAdminFallback,
    canAccessModule: (module) => canAccessControlModule(roles, module),
    hasCapability: (capability) => capabilities.has(capability),
  }), [capabilities, error, isLegacyAdminFallback, loading, roles]);

  return (
    <ControlAccessContext.Provider value={value}>
      {children}
    </ControlAccessContext.Provider>
  );
}

export function useControlAccess() {
  const ctx = useContext(ControlAccessContext);
  if (!ctx) throw new Error('useControlAccess must be used within ControlAccessProvider');
  return ctx;
}

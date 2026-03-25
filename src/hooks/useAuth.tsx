// ============================================
// Casa Clara — AuthContext
// ============================================

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { clearPersistedSupabaseSession, supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import {
  isTransientNetworkError,
  queryWithTimeout,
  retryOnceOnTransientNetworkError,
} from '../lib/async';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{
    error: string | null;
    needsEmailConfirmation: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const profileLoadedForUserId = useRef<string | null>(null);
  const lastSessionRecoveryAt = useRef(0);
  const authOperationRef = useRef<Promise<unknown> | null>(null);

  const runExclusiveAuthOperation = async <T,>(operation: () => Promise<T>) => {
    while (authOperationRef.current) {
      try {
        await authOperationRef.current;
      } catch {
        authOperationRef.current = null;
      }
    }

    const task = operation();
    const trackedTask = task.finally(() => {
      if (authOperationRef.current === trackedTask) {
        authOperationRef.current = null;
      }
    });
    authOperationRef.current = trackedTask;

    return task;
  };

  useEffect(() => {
    let cancelled = false;

    const initializeAuthState = async () => {
      try {
        setError(null);
        const { data: { session } } = await runExclusiveAuthOperation(() => supabase.auth.getSession());
        if (cancelled) return;

        if (!session?.user) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session.user);
      } catch (error) {
        console.error('Error initializing auth state:', error);
        if (!cancelled) {
          if (isTransientNetworkError(error)) {
            setError('La conexión con Casa Clara está inestable.');
          } else {
            setError(error instanceof Error ? error.message : 'No pudimos validar tu sesión.');
          }
          setLoading(false);
        }
      }
    };

    void initializeAuthState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        setError(null);
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;
        const hasLoadedCurrentProfile = !!nextUserId && profileLoadedForUserId.current === nextUserId;

        setSession(session);
        setUser(nextUser);

        if (!nextUser) {
          profileLoadedForUserId.current = null;
          setProfile(null);
          setLoading(false);
          return;
        }

        // Supabase can emit SIGNED_IN/TOKEN_REFRESHED again for the same user when the
        // tab returns from the background. If the current user's profile is already loaded,
        // going back to loading=true here traps the UI behind the global loader.
        if (hasLoadedCurrentProfile && event !== 'USER_UPDATED') {
          setLoading(false);
          return;
        }

        if (profileLoadedForUserId.current !== nextUserId || event === 'USER_UPDATED') {
          setLoading(true);
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!userId) {
        setProfile(null);
        setLoading(false);
        profileLoadedForUserId.current = null;
        return;
      }

      if (profileLoadedForUserId.current === userId && profile) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await queryWithTimeout(
          (signal) => supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .abortSignal(signal)
            .maybeSingle(),
          7000,
          'No pudimos cargar tu perfil.',
        );
        if (cancelled) return;

        if (!error && data) {
          setProfile(data as Profile);
        } else {
          setProfile(null);
        }
        profileLoadedForUserId.current = userId;
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching profile:', error);
        setProfile(null);
        setError(error instanceof Error ? error.message : 'No pudimos cargar tu perfil.');
        profileLoadedForUserId.current = null;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [profile, userId]);

  useEffect(() => {
    const recoverVisibleSession = async () => {
      if (document.visibilityState === 'hidden') return;
      if (!userId) return;
      if (['/login', '/registro', '/recuperar-clave', '/restablecer-clave', '/verificar-email'].includes(window.location.pathname)) return;
      if (!session?.refresh_token) return;

      const now = Date.now();
      if (now - lastSessionRecoveryAt.current < 30_000) {
        return;
      }

      lastSessionRecoveryAt.current = now;

      try {
        const { data, error } = await retryOnceOnTransientNetworkError(() => runExclusiveAuthOperation(
          () => supabase.auth.refreshSession(),
        ),
        );

        if (error) {
          throw new Error(error.message);
        }

        if (!data.session?.user) {
          profileLoadedForUserId.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setError(null);
        setSession(data.session);
        setUser(data.session.user);
      } catch (error) {
        console.error('Error recovering auth session:', error);

        if (isTransientNetworkError(error)) {
          setLoading(false);
          return;
        }

        clearPersistedSupabaseSession();
        profileLoadedForUserId.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setError(null);
        setLoading(false);
      }
    };

    window.addEventListener('focus', recoverVisibleSession);
    document.addEventListener('visibilitychange', recoverVisibleSession);

    return () => {
      window.removeEventListener('focus', recoverVisibleSession);
      document.removeEventListener('visibilitychange', recoverVisibleSession);
    };
  }, [session?.refresh_token, userId]);

  async function signUp(email: string, password: string, fullName: string) {
    try {
      const { data, error } = await retryOnceOnTransientNetworkError(() => runExclusiveAuthOperation(
        () => supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/verificar-email`,
          },
        }),
      ),
      );

      return {
        error: error?.message ?? null,
        needsEmailConfirmation: !data.session,
      };
    } catch (error) {
      return {
        error: isTransientNetworkError(error)
          ? 'La conexión está inestable. Reintenta en unos segundos.'
          : error instanceof Error
            ? error.message
            : 'No pudimos crear tu cuenta.',
        needsEmailConfirmation: false,
      };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await retryOnceOnTransientNetworkError(() => runExclusiveAuthOperation(
        () => supabase.auth.signInWithPassword({ email, password }),
      ),
      );
      return { error: error?.message ?? null };
    } catch (error) {
      return {
        error: isTransientNetworkError(error)
          ? 'La conexión con Casa Clara tardó demasiado. Reintenta en unos segundos.'
          : error instanceof Error
            ? error.message
            : 'No pudimos iniciar sesión.',
      };
    }
  }

  async function signOut() {
    await runExclusiveAuthOperation(() => supabase.auth.signOut());
    setUser(null);
    setProfile(null);
    setSession(null);
    setError(null);
    setLoading(false);
    profileLoadedForUserId.current = null;
  }

  async function resetPassword(email: string) {
    try {
      const { error } = await retryOnceOnTransientNetworkError(() => runExclusiveAuthOperation(
        () => supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/restablecer-clave`,
        }),
      ),
      );
      return { error: error?.message ?? null };
    } catch (error) {
      return {
        error: isTransientNetworkError(error)
          ? 'La conexión está inestable. Reintenta en unos segundos.'
          : error instanceof Error
            ? error.message
            : 'No pudimos enviar el enlace de recuperación.',
      };
    }
  }

  async function updatePassword(newPassword: string) {
    try {
      const { error } = await retryOnceOnTransientNetworkError(() => runExclusiveAuthOperation(
        () => supabase.auth.updateUser({ password: newPassword }),
      ),
      );
      return { error: error?.message ?? null };
    } catch (error) {
      return {
        error: isTransientNetworkError(error)
          ? 'La conexión está inestable. Reintenta en unos segundos.'
          : error instanceof Error
            ? error.message
            : 'No pudimos actualizar tu contraseña.',
      };
    }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, error,
      signUp, signIn, signOut, resetPassword, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

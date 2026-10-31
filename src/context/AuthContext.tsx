'use client';

// =============================================================================
// TradeRisk Manager — Authentication Context & Provider (Supabase Auth)
// =============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { setStorageNamespace } from '@/lib/storage';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  rawUser: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured());
  const [error, setError] = useState<string | null>(null);

  // Format Supabase user into simplified AuthUser
  const user: AuthUser | null = useMemo(() => {
    if (!rawUser) return null;
    return {
      id: rawUser.id,
      email: rawUser.email || '',
      fullName: rawUser.user_metadata?.full_name || rawUser.email?.split('@')[0],
      avatarUrl: rawUser.user_metadata?.avatar_url,
    };
  }, [rawUser]);

  const clearError = useCallback(() => setError(null), []);

  // Initialize session and listen for auth state updates
  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let isMounted = true;

    // Get current session
    supabase.auth.getSession().then(({ data: { session: currentSession }, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) {
        console.warn('[TradeRisk Auth] Session check error:', sessionError.message);
      }
      setSession(currentSession);
      setRawUser(currentSession?.user ?? null);
      setStorageNamespace(currentSession?.user?.id ?? null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('trm-storage-update'));
      }
      setIsLoading(false);
    });

    // Listen to auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setRawUser(newSession?.user ?? null);
      setStorageNamespace(newSession?.user?.id ?? null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('trm-storage-update'));
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  // Sign Up
  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      setError(null);
      if (!configured) {
        return { success: false, error: 'Supabase no está configurado.' };
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { success: false, error: 'Cliente de autenticación no disponible.' };
      }

      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return { success: false, error: signUpError.message };
        }

        if (data.session) {
          setSession(data.session);
          setRawUser(data.session.user);
        }

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error inesperado durante el registro';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [configured],
  );

  // Sign In
  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!configured) {
        return { success: false, error: 'Supabase no está configurado.' };
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { success: false, error: 'Cliente de autenticación no disponible.' };
      }

      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return { success: false, error: signInError.message };
        }

        setSession(data.session);
        setRawUser(data.user);
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [configured],
  );

  // Sign Out
  const signOut = useCallback(async () => {
    setError(null);
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await supabase.auth.signOut();
      setSession(null);
      setRawUser(null);
      setStorageNamespace(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('trm-storage-update'));
      }
    } catch (err: unknown) {
      console.error('[TradeRisk Auth] Sign out error:', err);
    }
  }, [configured]);

  // Reset Password
  const resetPassword = useCallback(
    async (email: string) => {
      setError(null);
      if (!configured) {
        return { success: false, error: 'Supabase no está configurado.' };
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { success: false, error: 'Cliente no disponible.' };
      }

      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) {
          setError(resetError.message);
          return { success: false, error: resetError.message };
        }
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al solicitar restablecimiento';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [configured],
  );

  const contextValue: AuthContextValue = useMemo(
    () => ({
      user,
      rawUser,
      session,
      isLoading,
      isConfigured: configured,
      error,
      signUp,
      signIn,
      signOut,
      resetPassword,
      clearError,
    }),
    [user, rawUser, session, isLoading, configured, error, signUp, signIn, signOut, resetPassword, clearError],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

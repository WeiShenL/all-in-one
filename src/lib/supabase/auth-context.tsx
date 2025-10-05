'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { createClient } from './client';
import type { AuthUser, UserProfile, UserRole } from './types';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (
    email: string,
    password: string,
    userData?: Partial<UserProfile>
  ) => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
  changePassword: (newPassword: string) => Promise<{ error: unknown }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchUserProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      try {
        console.warn('🔍 [Auth Context] Fetching user profile for:', userId);
        // Call tRPC API endpoint via fetch
        const response = await fetch(
          `/api/trpc/userProfile.getById?input=${encodeURIComponent(JSON.stringify({ id: userId }))}`
        );
        console.warn(
          '🔍 [Auth Context] Profile fetch response status:',
          response.status
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔍 [Auth Context] Profile fetch failed:', errorText);
          throw new Error('Failed to fetch user profile');
        }
        const data = await response.json();
        console.warn('🔍 [Auth Context] Profile data:', data);
        return data.result.data;
      } catch (error) {
        console.error('🔍 [Auth Context] Error fetching user profile:', error);
        return null;
      }
    },
    []
  );

  const refreshProfile = async () => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
      setUserRole(profile?.role || null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (initialSession?.user) {
          const profile = await fetchUserProfile(initialSession.user.id);
          const userWithProfile: AuthUser = {
            ...initialSession.user,
            user_profile: profile || undefined,
          };

          setUser(userWithProfile);
          setUserProfile(profile);
          setUserRole(profile?.role || null);
          setSession(initialSession);
        }
      } catch (error) {
        console.error('[Auth Context] Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.warn(
          '🔍 [Auth Context] Auth state changed:',
          event,
          'Session:',
          session?.user?.id
        );
        setSession(session);

        if (session?.user) {
          console.warn(
            '🔍 [Auth Context] User authenticated, fetching profile...'
          );
          const profile = await fetchUserProfile(session.user.id);
          const userWithProfile: AuthUser = {
            ...session.user,
            user_profile: profile || undefined,
          };

          setUser(userWithProfile);
          setUserProfile(profile);
          setUserRole(profile?.role || null);
          console.warn('🔍 [Auth Context] Profile loaded:', profile?.role);
        } else {
          console.warn('🔍 [Auth Context] No session, clearing user data');
          setUser(null);
          setUserProfile(null);
          setUserRole(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, supabase.auth]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData?: Partial<UserProfile>
  ) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: userData,
        },
      });

      if (error) {
        return { error };
      }

      // Profile will be automatically created by database trigger
      // No need to manually insert into UserProfile table

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const changePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    userRole,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    changePassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { createClient } from './client';
import type { AuthUser, UserProfile, UserRole, Database } from './types';
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
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          return null;
        }

        return data;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
    },
    [supabase]
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
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          const userWithProfile: AuthUser = {
            ...session.user,
            user_profile: profile || undefined,
          };

          setUser(userWithProfile);
          setUserProfile(profile);
          setUserRole(profile?.role || null);
        } else {
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // If user was created and userData provided, create profile
      if (data.user && userData) {
        const profileData: Database['public']['Tables']['user_profiles']['Insert'] =
          {
            id: data.user.id,
            email: data.user.email!,
            ...userData,
          };

        // Type assertion required - client may not be connecting to actual Supabase instance
        // profileData is still fully type-checked above for security
        const { error: profileError } =
          await // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('user_profiles').insert(profileData);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      }

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

  const value: AuthContextType = {
    user,
    userProfile,
    userRole,
    session,
    loading,
    signIn,
    signUp,
    signOut,
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

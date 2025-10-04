"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export type UserRole = 'super_admin' | 'user';

export interface AuthUser extends User {
  role?: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, role?: UserRole) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  createUser: (email: string, password: string, role: UserRole) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateUserRole: (newRole: UserRole) => Promise<{ error: AuthError | null }>;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        const userWithRole = {
          ...session.user,
          role: session.user.user_metadata?.role as UserRole || 'user'
        } as AuthUser;
        setUser(userWithRole);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          const userWithRole = {
            ...session.user,
            role: session.user.user_metadata?.role as UserRole || 'user'
          } as AuthUser;
          setUser(userWithRole);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (data.user) {
      const userWithRole = {
        ...data.user,
        role: data.user.user_metadata?.role as UserRole || 'user'
      } as AuthUser;
      setUser(userWithRole);
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, role: UserRole = 'user') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
        },
        
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const createUser = async (email: string, password: string, role: UserRole) => {
    // This requires admin privileges - only super admins can create users
    if (!isSuperAdmin) {
      return { error: { message: 'Insufficient permissions' } as AuthError };
    }

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { role },
      email_confirm: true, // Auto-confirm email
    });

    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password-confirm`,
    });
    return { error };
  };

  const updateUserRole = async (newRole: UserRole) => {
    if (!user) return { error: { message: 'No user logged in' } as AuthError };
    
    const { error } = await supabase.auth.updateUser({
        data: { role: newRole },
     
    });
    
    if (!error && user) {
      const updatedUser = {
        ...user,
        role: newRole,
        user_metadata: { ...user.user_metadata, role: newRole }
      } as AuthUser;
      setUser(updatedUser);
    }
    
    return { error };
  };

  // Extract role from user metadata or direct role property
  const getUserRole = (user: AuthUser | null ): UserRole => {
    if (!user) return 'user';
    return user.role || user.user_metadata?.role || 'user';
  };

  const isSuperAdmin = getUserRole(user) === 'super_admin';
  const isAuthenticated = !!user;

  // Debug logging (reduced frequency in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // console.log('Auth Debug:', {
    //   user: user ? 'authenticated' : 'null',
    //   role: getUserRole(user),  
    //   isSuperAdmin,
    //   isAuthenticated
    // });
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    createUser,
    resetPassword,
    updateUserRole,
    isSuperAdmin,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

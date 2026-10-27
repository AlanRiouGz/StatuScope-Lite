import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginDemo, logoutDemo, restoreDemoProfile } from '@/lib/demo/service';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  hospitalId: string | null;
  hospitalName: string | null;
  roles: string[];
  privileges: string[];
}

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setProfile(restoreDemoProfile()); setLoading(false); }, []);
  return <AuthContext.Provider value={{ profile, loading,
    login: async (email, password) => {
      const next = loginDemo(email, password); setProfile(next); return next;
    },
    logout: async () => { logoutDemo(); setProfile(null); },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}

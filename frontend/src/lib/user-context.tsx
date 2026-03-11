'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from './api-client';

interface UserInfo {
  fullName: string | null;
  email: string;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get<{ email: string; full_name: string | null }>('/api/users/me')
      .then((data) => {
        if (cancelled) return;
        setUser({ fullName: data.full_name, email: data.email });
      })
      .catch(() => {
        // API unavailable — leave user as null
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

'use client';

import { createContext, useContext, useState, useEffect, useSyncExternalStore, useCallback, type ReactNode } from 'react';
import { ROLES, type RoleKey, type RoleConfig } from './roles';
import { api } from './api-client';

interface RoleContextValue {
  currentRole: RoleKey;
  setRole: (role: RoleKey) => void;
  roleConfig: RoleConfig;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = 'wrapiq_selected_role';

function getStoredRole(): RoleKey {
  if (typeof window === 'undefined') return 'admin';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in ROLES) {
    return stored as RoleKey;
  }
  return 'admin';
}

const emptySubscribe = () => () => {};

export function RoleProvider({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [currentRole, setCurrentRole] = useState<RoleKey>(getStoredRole);

  // Validate role from API on mount
  useEffect(() => {
    let cancelled = false;

    api
      .get<{ role: string }>('/api/users/me')
      .then((user) => {
        if (cancelled) return;
        const apiRole = user.role as string;
        if (apiRole && apiRole in ROLES && apiRole !== currentRole) {
          setCurrentRole(apiRole as RoleKey);
          localStorage.setItem(STORAGE_KEY, apiRole);
        }
      })
      .catch(() => {
        // API unavailable — keep using cached localStorage value
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRole = useCallback((role: RoleKey) => {
    setCurrentRole(role);
    localStorage.setItem(STORAGE_KEY, role);
  }, []);

  const roleConfig = ROLES[currentRole];

  if (!mounted) {
    return null;
  }

  return (
    <RoleContext.Provider value={{ currentRole, setRole, roleConfig }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

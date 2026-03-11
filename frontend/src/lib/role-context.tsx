'use client';

import { createContext, useContext, useState, useEffect, useSyncExternalStore, useCallback, type ReactNode } from 'react';
import { ROLES, type RoleKey, type RoleConfig } from './roles';
import { api } from './api-client';
import { getAccessToken } from './auth';

/** Lowest-privilege role used as the safe default. */
const DEFAULT_ROLE: RoleKey = 'installer';

interface RoleContextValue {
  currentRole: RoleKey;
  setRole: (role: RoleKey) => void;
  roleConfig: RoleConfig;
  roleLoading: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = 'wrapiq_selected_role';

/**
 * Return the role stored in localStorage, falling back to the
 * lowest-privilege default.  Never returns 'admin' by default.
 */
function getStoredRole(): RoleKey {
  if (typeof window === 'undefined') return DEFAULT_ROLE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in ROLES) {
    return stored as RoleKey;
  }
  return DEFAULT_ROLE;
}

const emptySubscribe = () => () => {};

export function RoleProvider({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [currentRole, setCurrentRole] = useState<RoleKey>(getStoredRole);
  const hasToken = typeof window !== 'undefined' && !!getAccessToken();
  const [roleLoading, setRoleLoading] = useState<boolean>(hasToken);

  // Fetch and enforce the role from the API on mount
  useEffect(() => {
    if (!hasToken) return;

    let cancelled = false;

    api
      .get<{ role: string }>('/api/users/me')
      .then((user) => {
        if (cancelled) return;
        const apiRole = user.role as string;
        if (apiRole && apiRole in ROLES) {
          setCurrentRole(apiRole as RoleKey);
          localStorage.setItem(STORAGE_KEY, apiRole);
        } else {
          // API returned an unrecognised role — fall back to safe default
          setCurrentRole(DEFAULT_ROLE);
          localStorage.setItem(STORAGE_KEY, DEFAULT_ROLE);
        }
      })
      .catch(() => {
        // API unavailable — reset to safe default instead of trusting localStorage
        setCurrentRole(DEFAULT_ROLE);
        localStorage.setItem(STORAGE_KEY, DEFAULT_ROLE);
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  const setRole = useCallback((role: RoleKey) => {
    setCurrentRole(role);
    localStorage.setItem(STORAGE_KEY, role);
  }, []);

  const roleConfig = ROLES[currentRole];

  if (!mounted) {
    return null;
  }

  return (
    <RoleContext.Provider value={{ currentRole, setRole, roleConfig, roleLoading }}>
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

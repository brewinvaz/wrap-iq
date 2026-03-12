'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import React from 'react';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'wrapiq-theme';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'dark';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function getResolvedTheme(theme?: Theme): 'dark' | 'light' {
  const t = theme ?? getTheme();
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

function applyTheme(theme: Theme): void {
  const resolved = getResolvedTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
}

// ── React Context ──

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => getResolvedTheme());

  const handleSetTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setTheme(newTheme);
    setResolvedTheme(getResolvedTheme(newTheme));
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function handleChange() {
      if (getTheme() === 'system') {
        const resolved = mq.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolved);
        setResolvedTheme(resolved);
      }
    }
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, resolvedTheme, setTheme: handleSetTheme } },
    children,
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

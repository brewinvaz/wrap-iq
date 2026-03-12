'use client';

import { ThemeProvider } from '@/lib/theme';

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

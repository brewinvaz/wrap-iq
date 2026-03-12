'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';

const CYCLE: Theme[] = ['dark', 'light', 'system'];

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  function cycleTheme() {
    const currentIndex = CYCLE.indexOf(theme);
    const nextIndex = (currentIndex + 1) % CYCLE.length;
    setTheme(CYCLE[nextIndex]);
  }

  const label =
    theme === 'system'
      ? `System (${resolvedTheme})`
      : theme === 'dark'
        ? 'Dark mode'
        : 'Light mode';

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <button
      onClick={cycleTheme}
      title={label}
      aria-label={label}
      className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
    >
      <Icon size={20} />
    </button>
  );
}

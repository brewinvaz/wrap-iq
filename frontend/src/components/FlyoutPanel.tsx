'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useCallback } from 'react';
import { useRole } from '@/lib/role-context';
import { useBadgeCounts } from '@/lib/use-badge-counts';
import { ICON_MAP } from './IconRail';
import { ClipboardList } from 'lucide-react';

export default function FlyoutPanel({
  activeGroup,
  onMouseEnter,
  onMouseLeave,
}: {
  activeGroup: number | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const pathname = usePathname();
  const { roleConfig, currentRole } = useRole();
  const badgeCounts = useBadgeCounts();

  // Keyboard support: Ctrl+/ toggles flyout
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        // Toggle is managed by parent
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (currentRole === 'client' || activeGroup === null) return null;

  const navGroups = roleConfig.navGroups;

  return (
    <div
      className="fixed left-16 top-0 z-40 hidden h-screen w-60 border-r border-[var(--border)] bg-[var(--surface-card)] shadow-lg md:block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex h-full flex-col overflow-y-auto py-4">
        {navGroups.map((group, idx) => (
          <div key={group.label} className={idx > 0 ? 'mt-5' : ''}>
            <h3 className="mb-1.5 px-4 font-mono text-[10px] uppercase tracking-[1.2px] text-[var(--text-muted)]">
              {group.label}
            </h3>
            <ul>
              {group.items.map((item) => {
                const Icon = ICON_MAP[item.icon] || ClipboardList;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                const badgeValue = item.badgeKey
                  ? badgeCounts[item.badgeKey]
                  : item.badge;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors ${
                        isActive
                          ? 'bg-[var(--accent-primary-bg)] font-medium text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeValue !== undefined && badgeValue > 0 && (
                        <span
                          className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-medium ${
                            item.badgeVariant === 'amber'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                              : isActive
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'bg-[var(--surface-overlay)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  ClipboardList, BarChart3, Package, Calendar, MessageSquare,
  CalendarDays, Users, Palette, Printer, Wrench, DollarSign,
  FileText, Receipt, TrendingUp, Clock, User, CreditCard, Key,
  Plug, Bot, Box, Camera, Settings, File, CheckSquare, Upload,
  FolderOpen, BookOpen, Image, type LucideIcon,
} from 'lucide-react';
import { useRole } from '@/lib/role-context';
import { useUser } from '@/lib/user-context';
import { useBadgeCounts } from '@/lib/use-badge-counts';
import { useSidebar } from '@/lib/sidebar-context';
import { ROLES, type RoleKey } from '@/lib/roles';
import { getRefreshToken, clearTokens } from '@/lib/auth';
import { api } from '@/lib/api-client';

export const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, BarChart3, Package, Calendar, MessageSquare,
  CalendarDays, Users, Palette, Printer, Wrench, DollarSign,
  FileText, Receipt, TrendingUp, Clock, User, CreditCard, Key,
  Plug, Bot, Box, Camera, Settings, File, CheckSquare, Upload,
  FolderOpen, BookOpen, Image,
};

const INTERNAL_ROLES: RoleKey[] = ['admin', 'pm', 'installer', 'designer', 'production'];
const CLIENT_ROLES: RoleKey[] = ['client'];
const isDev = process.env.NODE_ENV === 'development';

function NotificationDot() {
  return (
    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent-secondary)]" />
  );
}

export default function IconRail({
  onHoverGroup,
  onLeaveRail,
}: {
  onHoverGroup?: (groupIndex: number | null) => void;
  onLeaveRail?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, setRole, roleConfig } = useRole();
  const { user } = useUser();
  const badgeCounts = useBadgeCounts();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showRoleSwitcher = isDev || user?.role === 'admin';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      }
    } catch {
      // Proceed with logout even if API call fails
    } finally {
      clearTokens();
      router.replace('/login');
    }
  }

  if (currentRole === 'client') return null;

  // Build rail items: first item from each nav group
  const railItems = roleConfig.navGroups.map((group, groupIndex) => {
    const firstItem = group.items[0];
    const Icon = ICON_MAP[firstItem.icon] || ClipboardList;
    const isActive = group.items.some(
      (item) =>
        pathname === item.href ||
        (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')),
    );
    const hasBadge = group.items.some(
      (item) => item.badgeKey && badgeCounts[item.badgeKey] > 0,
    );

    return { group, groupIndex, firstItem, Icon, isActive, hasBadge };
  });

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : roleConfig.avatarText;

  const railContent = (
    <div className="flex h-full flex-col items-center py-3">
      {/* Logo */}
      <Link href="/dashboard" className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
        <span className="font-mono text-xs font-bold text-white">WF</span>
      </Link>

      {/* Primary nav icons */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {railItems.map(({ groupIndex, firstItem, Icon, isActive, hasBadge }) => (
          <div
            key={firstItem.href}
            className="relative"
            onMouseEnter={() => onHoverGroup?.(groupIndex)}
          >
            <Link
              href={firstItem.href}
              title={firstItem.label}
              className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={20} />
            </Link>
            {hasBadge && <NotificationDot />}
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + Avatar */}
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/dashboard/settings/billing"
          title="Settings"
          className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl transition-colors ${
            pathname.startsWith('/dashboard/settings')
              ? 'bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Settings size={20} />
        </Link>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => showRoleSwitcher ? setDropdownOpen(!dropdownOpen) : handleLogout()}
            disabled={loggingOut}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-semibold text-white ${roleConfig.avatarBg} ${showRoleSwitcher ? 'cursor-pointer' : ''}`}
            title={showRoleSwitcher ? 'Switch role' : 'Sign out'}
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg">
              <div className="px-3 py-1.5">
                <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{user?.fullName || roleConfig.name}</p>
                <p className="truncate text-[10px] text-[var(--text-muted)]">{user?.email || roleConfig.title}</p>
              </div>
              <div className="mx-2 my-1 border-t border-[var(--border)]" />
              <div className="px-2.5 py-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Internal</span>
              </div>
              {INTERNAL_ROLES.map((roleKey) => {
                const role = ROLES[roleKey];
                return (
                  <button
                    key={roleKey}
                    onClick={() => { setRole(roleKey); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-overlay)]"
                  >
                    <div className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${role.avatarBg}`}>
                      {role.avatarText}
                    </div>
                    <span className="flex-1 text-[12px] text-[var(--text-primary)]">{role.name}</span>
                    {currentRole === roleKey && (
                      <span className="text-[var(--accent-primary)]">
                        <CheckSquare size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="mx-2 my-1 border-t border-[var(--border)]" />
              <div className="px-2.5 py-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Client Portal</span>
              </div>
              {CLIENT_ROLES.map((roleKey) => {
                const role = ROLES[roleKey];
                return (
                  <button
                    key={roleKey}
                    onClick={() => { setRole(roleKey); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-overlay)]"
                  >
                    <div className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${role.avatarBg}`}>
                      {role.avatarText}
                    </div>
                    <span className="flex-1 text-[12px] text-[var(--text-primary)]">{role.name}</span>
                    {currentRole === roleKey && (
                      <span className="text-[var(--accent-primary)]">
                        <CheckSquare size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="mx-2 my-1 border-t border-[var(--border)]" />
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
              >
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-[var(--border)] bg-[var(--surface-base)] md:hidden">
        {railItems.slice(0, 5).map(({ firstItem, Icon, isActive, hasBadge }) => (
          <Link
            key={firstItem.href}
            href={firstItem.href}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 ${
              isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Icon size={20} />
            <span className="text-[9px] font-medium">{firstItem.label.split(' ')[0]}</span>
            {hasBadge && <NotificationDot />}
          </Link>
        ))}
      </nav>

      {/* Desktop/tablet icon rail */}
      <aside
        className="hidden h-screen w-16 shrink-0 border-r border-[var(--border)] bg-[var(--surface-base)] md:block"
        onMouseLeave={onLeaveRail}
      >
        {railContent}
      </aside>
    </>
  );
}

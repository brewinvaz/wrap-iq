'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/lib/sidebar-context';
import { api } from '@/lib/api-client';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Jobs Board',
  '/dashboard/work-orders': 'Work Orders',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/customers': 'Customers',
  '/dashboard/design-queue': 'Design Queue',
  '/dashboard/print': 'Print / Lam',
  '/dashboard/install-schedule': 'Install Schedule',
  '/dashboard/financials': 'Financials',
  '/dashboard/time-logs': 'Time Tracking',
  '/dashboard/team': 'User Management',
  '/dashboard/comms': 'Communications',
  '/dashboard/hours': 'Design Hours',
  '/dashboard/settings/billing': 'Billing & Settings',
  '/dashboard/integrations': 'Integrations',
  '/dashboard/ai': 'Shop Intelligence',
  '/dashboard/3d': '3D Rendering',
  '/dashboard/jobs': 'All Jobs Board',
  '/dashboard/schedule': 'Schedule',
  '/dashboard/contracts': 'Contracts & Documents',
  '/dashboard/proofs': 'Proof Approvals',
  '/dashboard/reports': 'Reports',
  '/dashboard/photos': 'Job Photos',
  '/dashboard/materials': 'Materials',
  '/dashboard/equipment': 'Equipment',
  '/dashboard/brand-files': 'Brand Files',
  '/dashboard/briefs': 'Job Briefs',
  '/dashboard/checklists': 'Checklists',
  '/dashboard/projects': 'Projects',
  '/dashboard/settings/api-keys': 'API Keys',
  '/dashboard/settings/team': 'Team',
};

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationListResponse {
  items: Notification[];
  total: number;
}

interface UnreadCountResponse {
  count: number;
}

interface TopbarProps {
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
};

export default function Topbar({ subtitle, actionLabel, onAction }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleMobile } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');
  const title = ROUTE_TITLES[pathname] ?? 'Dashboard';

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Fetch unread count on mount and poll every 60s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get<UnreadCountResponse>(
        '/api/notifications/unread-count',
      );
      setUnreadCount(data.count);
    } catch {
      // Silently ignore — user may not be authenticated yet
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch recent notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await api.get<NotificationListResponse>(
        '/api/notifications?limit=10',
      );
      setNotifications(data.items);
    } catch {
      // ignore
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  function togglePanel() {
    const opening = !panelOpen;
    setPanelOpen(opening);
    if (opening) {
      fetchNotifications();
    }
  }

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelOpen &&
        panelRef.current &&
        bellRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  async function handleMarkAsRead(id: string) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.post('/api/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  function handleSearchSubmit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/dashboard/work-orders?q=${encodeURIComponent(trimmed)}`);
  }
  return (
    <header className="flex h-[54px] shrink-0 items-center border-b border-[#e6e6eb] bg-white px-3 md:px-5">
      {/* Hamburger menu - mobile only */}
      <button
        onClick={toggleMobile}
        className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#60606a] transition-colors hover:bg-[#f4f4f6] hover:text-[#18181b] md:hidden"
        aria-label="Open sidebar menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Left: Title */}
      <div className="flex-1">
        <h1 className="text-[16px] font-semibold text-[#18181b]">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-[#a8a8b4]">{subtitle}</p>
        )}
      </div>

      {/* Center-right: Search (hidden on mobile) */}
      <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a8a8b4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search work orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-[210px] rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] pl-8 pr-3 text-[13px] text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-300 focus:bg-white"
        />
      </form>

      {/* Right: Notifications + Action */}
      <div className="ml-3 flex items-center gap-2">
        <div className="relative">
          <button
            ref={bellRef}
            onClick={togglePanel}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#f4f4f6]"
            aria-label="Notifications"
          >
            <svg className="h-4.5 w-4.5 text-[#60606a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown panel */}
          {panelOpen && (
            <div
              ref={panelRef}
              className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-[#e6e6eb] bg-white shadow-lg"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-[#e6e6eb] px-4 py-3">
                <h3 className="text-[14px] font-semibold text-[#18181b]">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto">
                {loadingNotifications ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-[#18181b]" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-[#a8a8b4]">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) handleMarkAsRead(n.id);
                      }}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f4f4f6] ${
                        !n.is_read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          TYPE_COLORS[n.notification_type] ?? 'bg-gray-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] ${!n.is_read ? 'font-semibold text-[#18181b]' : 'text-[#60606a]'}`}>
                          {n.title}
                        </p>
                        <p className="truncate text-[12px] text-[#a8a8b4]">
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#a8a8b4]">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex h-8 items-center rounded-lg bg-[#18181b] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2d2d30]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}

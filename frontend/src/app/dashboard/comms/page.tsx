'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

type FilterTab = 'all' | 'unread' | 'read';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationsResponse {
  items: Notification[];
  total: number;
}

interface UnreadCountResponse {
  count: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  channel: string;
  variables: string[];
  created_at: string;
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

const typeColors: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
  success: 'bg-emerald-500',
  reminder: 'bg-violet-500',
};

function getInitials(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarColor(type: string): string {
  return typeColors[type] ?? 'bg-blue-500';
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-56 animate-pulse rounded bg-[var(--surface-overlay)]" />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 border-r border-[var(--border)] bg-[var(--surface-card)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--surface-overlay)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-overlay)]" />
                <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-1 flex-col p-6">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-16 w-72 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const [notifResp, unreadResp, templatesResp] = await Promise.all([
        api.get<NotificationsResponse>('/api/notifications?limit=50'),
        api.get<UnreadCountResponse>('/api/notifications/unread-count'),
        api.get<MessageTemplate[]>('/api/message-templates'),
      ]);

      if (signal?.cancelled) return;

      setNotifications(notifResp?.items ?? []);
      setUnreadCount(unreadResp?.count ?? 0);
      setTemplates(templatesResp ?? []);

      // Auto-select first notification if none selected
      if (!selectedId && notifResp?.items?.length) {
        setSelectedId(notifResp.items[0].id);
      }
    } catch (err) {
      if (signal?.cancelled) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load communications');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchData(signal);
    return () => { signal.cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter((n) => !n.is_read);
    if (activeTab === 'read') return notifications.filter((n) => n.is_read);
    return notifications;
  }, [notifications, activeTab]);

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((n) => !n.is_read).length,
    read: notifications.filter((n) => n.is_read).length,
  }), [notifications]);

  const selectedNotification = useMemo(
    () => notifications.find((n) => n.id === selectedId) ?? null,
    [notifications, selectedId],
  );

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    const notif = notifications.find((n) => n.id === id);
    if (notif && !notif.is_read) {
      try {
        await api.patch(`/api/notifications/${id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail — the notification is still viewable
      }
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      await api.post('/api/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    } finally {
      setMarkingRead(false);
    }
  };

  const handleSendTemplate = async (templateId: string) => {
    setSendingTemplate(templateId);
    try {
      await api.post(`/api/message-templates/${templateId}/send`);
    } catch {
      // Silently fail
    } finally {
      setSendingTemplate(null);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load communications</p>
        <p className="text-xs text-[var(--text-muted)]">{error}</p>
        <button
          onClick={() => fetchData()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Client Communications</h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
              {unreadCount} unread
            </span>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingRead}
              className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 disabled:opacity-50"
            >
              {markingRead ? 'Marking...' : 'Mark all as read'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Notification List */}
        <div className="flex w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-card)]">
          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-[var(--border)] px-4 py-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#18181b] text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay)]'
                }`}
              >
                {tab.label}
                <span className="ml-1 opacity-60">{counts[tab.key]}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-[var(--text-secondary)]">
                No notifications
              </div>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n.id)}
                  className={`flex w-full items-start gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
                    selectedId === n.id ? 'bg-blue-500/10' : 'hover:bg-[var(--surface-overlay)]'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColor(n.type)}`}>
                    {getInitials(n.title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} text-[var(--text-primary)]`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{formatTimestamp(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{n.body}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail Area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {selectedNotification ? (
              <div className="mx-auto max-w-2xl">
                {/* Notification detail */}
                <div className="mb-6">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(selectedNotification.type)}`}>
                      {getInitials(selectedNotification.title)}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        {selectedNotification.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {new Date(selectedNotification.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        <span className="mx-1.5">·</span>
                        <span className="capitalize">{selectedNotification.type}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--surface-raised)] px-5 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                    {selectedNotification.body}
                  </p>
                </div>

                {selectedNotification.updated_at !== selectedNotification.created_at && (
                  <p className="mt-3 text-[10px] text-[var(--text-secondary)]">
                    Updated {formatTimestamp(selectedNotification.updated_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
                Select a notification to view details
              </div>
            )}
          </div>

          {/* Quick-send templates */}
          {templates.length > 0 && (
            <div className="border-t border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Quick Send Templates
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSendTemplate(t.id)}
                    disabled={sendingTemplate === t.id}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] disabled:opacity-50"
                    title={t.subject}
                  >
                    {sendingTemplate === t.id ? 'Sending...' : t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

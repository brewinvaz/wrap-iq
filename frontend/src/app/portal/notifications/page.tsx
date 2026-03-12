'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationListResponse {
  items: Notification[];
  total: number;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PortalNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<NotificationListResponse>('/api/portal/notifications')
      .then((data) => setNotifications(data.items))
      .catch((err) => setError(err.message || 'Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = () => {
    // Optimistically mark all as read in the UI
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={handleMarkAllRead}
            variant="secondary"
            size="sm"
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-[12px] border bg-[var(--surface-card)] p-[18px] shadow-sm ${
              notification.is_read ? 'border-[var(--border)]' : 'border-[var(--accent-primary)]/30'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Unread indicator */}
              <div className="mt-1.5 shrink-0">
                {!notification.is_read ? (
                  <div className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-[14px] ${
                      notification.is_read
                        ? 'font-medium text-[var(--text-secondary)]'
                        : 'font-semibold text-[var(--text-primary)]'
                    }`}
                  >
                    {notification.title}
                  </h3>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                    {formatTimestamp(notification.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[14px] text-[var(--text-muted)]">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

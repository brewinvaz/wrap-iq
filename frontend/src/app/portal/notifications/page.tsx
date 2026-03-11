'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[#18181b]">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-[#60606a]">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#18181b]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-[14px] text-[#60606a]">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-lg border border-[#e6e6eb] bg-white px-3 py-1.5 text-[13px] font-medium text-[#60606a] shadow-sm transition-colors hover:bg-[#f4f4f6]"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-xl border bg-white p-5 shadow-sm ${
              notification.is_read ? 'border-[#e6e6eb]' : 'border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Unread indicator */}
              <div className="mt-1.5 shrink-0">
                {!notification.is_read ? (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-[14px] ${
                      notification.is_read
                        ? 'font-medium text-[#60606a]'
                        : 'font-semibold text-[#18181b]'
                    }`}
                  >
                    {notification.title}
                  </h3>
                  <span className="shrink-0 text-[11px] text-[#a8a8b4]">
                    {formatTimestamp(notification.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#60606a]">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[14px] text-[#a8a8b4]">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

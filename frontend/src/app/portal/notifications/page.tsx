'use client';

import { useState } from 'react';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Proof Ready for Review',
    body: 'The design proof for WO-2024-0042 (Fleet Branding — Van #3) is ready for your review and approval.',
    timestamp: '2026-03-10T14:30:00Z',
    read: false,
  },
  {
    id: '2',
    title: 'Production Started',
    body: 'Printing has started for WO-2024-0039 (Box Truck Full Wrap). Estimated completion in 3 business days.',
    timestamp: '2026-03-08T09:15:00Z',
    read: false,
  },
  {
    id: '3',
    title: 'Install Scheduled',
    body: 'The installation for WO-2024-0036 (Partial Wrap — Driver Side) has been scheduled for March 3-5.',
    timestamp: '2026-03-01T11:00:00Z',
    read: true,
  },
  {
    id: '4',
    title: 'Project Complete',
    body: 'WO-2024-0030 (Color Change Wrap) is complete. Final photos have been uploaded for your review.',
    timestamp: '2026-02-08T16:45:00Z',
    read: true,
  },
];

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
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
              notification.read ? 'border-[#e6e6eb]' : 'border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Unread indicator */}
              <div className="mt-1.5 shrink-0">
                {!notification.read ? (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-[14px] ${
                      notification.read
                        ? 'font-medium text-[#60606a]'
                        : 'font-semibold text-[#18181b]'
                    }`}
                  >
                    {notification.title}
                  </h3>
                  <span className="shrink-0 text-[11px] text-[#a8a8b4]">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#60606a]">
                  {notification.body}
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

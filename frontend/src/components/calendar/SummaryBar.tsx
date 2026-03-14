'use client';

import { CalendarEvent } from '@/lib/types';

interface SummaryBarProps {
  events: CalendarEvent[];
  viewLabel: string;
}

export default function SummaryBar({ events, viewLabel }: SummaryBarProps) {
  const uniqueWorkOrders = new Set(events.map((e) => e.jobNumber)).size;

  return (
    <div className="flex items-center gap-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-3 backdrop-blur-sm">
      <span className="text-xs text-[var(--text-muted)]">{viewLabel}:</span>
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {uniqueWorkOrders} work {uniqueWorkOrders === 1 ? 'order' : 'orders'}
      </span>
    </div>
  );
}

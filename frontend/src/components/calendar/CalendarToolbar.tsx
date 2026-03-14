'use client';

import { WorkOrderCalendar } from './CalendarPage';

interface CalendarToolbarProps {
  woCalendars: WorkOrderCalendar[];
  activeWorkOrders: Set<string>;
  onToggleWorkOrder: (jobNumber: string) => void;
  onSetAllWorkOrders: (jobNumbers: string[]) => void;
}

export default function CalendarToolbar({
  woCalendars,
  activeWorkOrders,
  onToggleWorkOrder,
  onSetAllWorkOrders,
}: CalendarToolbarProps) {
  const allActive = woCalendars.length > 0 && woCalendars.every((wc) => activeWorkOrders.has(wc.jobNumber));

  return (
    <div className="flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-2.5 backdrop-blur-sm overflow-hidden">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Work Orders
      </span>

      {/* Select all / none toggle */}
      <button
        onClick={() => {
          if (allActive) {
            onSetAllWorkOrders([]);
          } else {
            onSetAllWorkOrders(woCalendars.map((wc) => wc.jobNumber));
          }
        }}
        className="shrink-0 rounded-md border border-[var(--glass-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
      >
        All
      </button>

      <div className="h-4 w-px shrink-0 bg-[var(--glass-border)]" />

      {/* Work order pills — horizontal scroll when overflow */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {woCalendars.map((wc) => {
          const isActive = activeWorkOrders.has(wc.jobNumber);
          return (
            <button
              key={wc.jobNumber}
              onClick={() => onToggleWorkOrder(wc.jobNumber)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                isActive ? 'opacity-100' : 'opacity-35'
              }`}
              style={{
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${wc.color} 15%, transparent)`
                  : 'transparent',
                border: `1px solid ${isActive ? `color-mix(in srgb, ${wc.color} 25%, transparent)` : 'transparent'}`,
                color: wc.color,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: wc.color }}
              />
              {wc.jobNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

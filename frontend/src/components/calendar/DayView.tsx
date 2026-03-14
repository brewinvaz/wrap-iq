'use client';

import { Fragment } from 'react';
import { CalendarEvent, Installer } from '@/lib/types';
import EventCard from './EventCard';

interface DayViewProps {
  dateStr: string;
  isToday: boolean;
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
  installers: Installer[];
  activeInstallers: Set<string>;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export default function DayView({
  dateStr,
  isToday,
  events,
  colorBy,
  installers,
  activeInstallers,
}: DayViewProps) {
  const dayEvents = events.filter((e) => e.date === dateStr);

  const useInstallerColumns = colorBy === 'installer';
  const filteredInstallers = installers.filter((i) => activeInstallers.has(i.id));
  const columns = useInstallerColumns ? filteredInstallers : [{ id: 'all', name: 'All', initials: '', color: '' }];

  return (
    <div className="flex-1 overflow-auto">
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: `80px repeat(${columns.length}, 1fr)`,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--glass-border)] bg-[var(--surface-card)] p-2" />
        {columns.map((col) => (
          <div
            key={col.id}
            className="sticky top-0 z-10 border-b border-l border-[var(--glass-border)] bg-[var(--surface-card)] p-2 text-center text-xs font-semibold text-[var(--text-secondary)]"
          >
            {useInstallerColumns ? col.name : ''}
          </div>
        ))}

        {HOURS.map((hour) => (
          <Fragment key={`row-${hour}`}>
            <div
              className="border-b border-[var(--glass-border)] px-3 py-3 text-right text-[10px] font-medium text-[var(--text-muted)]"
            >
              {formatHour(hour)}
            </div>
            {columns.map((col) => {
              const cellEvents = dayEvents.filter((e) => {
                const eventHour = parseInt(e.startTime.split(':')[0], 10);
                if (useInstallerColumns) {
                  return eventHour === hour && e.installer === col.id;
                }
                return eventHour === hour;
              });

              return (
                <div
                  key={`cell-${hour}-${col.id}`}
                  className={`border-b border-l border-[var(--glass-border)] p-1 ${
                    isToday ? 'bg-[rgba(6,182,212,0.02)]' : ''
                  }`}
                >
                  {cellEvents.map((event) => (
                    <EventCard key={event.id} event={event} colorBy={colorBy} />
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

'use client';

import { CalendarEvent } from '@/lib/types';
import EventCard from './EventCard';

interface WeekDay {
  date: Date;
  label: string;
  dateStr: string;
  isToday: boolean;
}

interface WeekViewProps {
  weekDays: WeekDay[];
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
}

export default function WeekView({ weekDays, events, colorBy }: WeekViewProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-5 gap-3">
        {weekDays.map((day) => {
          const dayEvents = events.filter((e) => e.date === day.dateStr);
          return (
            <div key={day.dateStr}>
              <div
                className={`mb-2 rounded-md px-2 py-1 text-center text-xs font-semibold uppercase tracking-wider ${
                  day.isToday
                    ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {day.label} {day.date.getDate()}
              </div>
              <div
                className={`min-h-[120px] rounded-lg border p-2 ${
                  day.isToday
                    ? 'border-[var(--accent-primary-border)] bg-[rgba(6,182,212,0.03)] shadow-[0_0_12px_rgba(6,182,212,0.05)]'
                    : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                }`}
              >
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} colorBy={colorBy} />
                  ))}
                  {dayEvents.length === 0 && (
                    <div className="flex h-20 items-center justify-center">
                      <span className="text-sm text-[var(--text-muted)] opacity-30">+</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

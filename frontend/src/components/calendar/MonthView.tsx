'use client';

import { CalendarEvent } from '@/lib/types';
import EventCard from './EventCard';

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
  onDayClick: (date: Date) => void;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(startDow).fill(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthView({ year, month, events, colorBy, onDayClick }: MonthViewProps) {
  const weeks = getCalendarGrid(year, month);
  const todayStr = formatDateStr(new Date());
  const MAX_PREVIEWS = 3;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mb-1 grid grid-cols-7 gap-px">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid gap-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((date, di) => {
              if (!date) {
                return <div key={`empty-${di}`} className="min-h-[90px] rounded-md bg-[var(--surface-card)] opacity-30" />;
              }
              const dateStr = formatDateStr(date);
              const isToday = dateStr === todayStr;
              const dayEvents = events.filter((e) => e.date === dateStr);

              return (
                <div
                  key={dateStr}
                  onClick={() => onDayClick(date)}
                  className={`min-h-[90px] cursor-pointer rounded-md border p-1.5 transition-colors hover:bg-[var(--glass-bg-hover)] ${
                    isToday
                      ? 'border-[var(--accent-primary-border)] bg-[rgba(6,182,212,0.03)]'
                      : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isToday
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="rounded-full bg-[var(--surface-raised)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_PREVIEWS).map((event) => (
                      <EventCard key={event.id} event={event} colorBy={colorBy} compact />
                    ))}
                    {dayEvents.length > MAX_PREVIEWS && (
                      <p className="text-[8px] font-medium text-[var(--text-muted)]">
                        +{dayEvents.length - MAX_PREVIEWS} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

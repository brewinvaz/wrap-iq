'use client';

import { CalendarEvent, Installer } from '@/lib/types';

interface MonthViewProps {
  year: number;
  month: number; // 0-indexed
  installers: Installer[];
  events: CalendarEvent[];
  activeInstallers: Set<string>;
  onDayClick: (date: Date) => void;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function colorWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Leading nulls
  for (let i = 0; i < startDow; i++) {
    currentWeek.push(null);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    currentWeek.push(new Date(year, month, d));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Trailing nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

export default function MonthView({
  year,
  month,
  installers,
  events,
  activeInstallers,
  onDayClick,
}: MonthViewProps) {
  const weeks = getCalendarGrid(year, month);
  const todayStr = formatDateStr(new Date());
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const activeInstallerSet = new Set(
    installers.filter((i) => activeInstallers.has(i.id)).map((i) => i.id),
  );

  return (
    <div className="flex-1 overflow-auto bg-white p-4">
      <div className="grid grid-cols-7 gap-px rounded-lg border border-[#e6e6eb] bg-[#e6e6eb]">
        {/* Day-of-week headers */}
        {dayHeaders.map((dh) => (
          <div
            key={dh}
            className="bg-gray-50 px-3 py-2 text-center text-xs font-medium text-[#a8a8b4]"
          >
            {dh}
          </div>
        ))}

        {/* Calendar cells */}
        {weeks.flat().map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="min-h-[100px] bg-gray-50/50" />;
          }

          const dateStr = formatDateStr(date);
          const isToday = dateStr === todayStr;
          const dayEvents = events.filter(
            (e) => e.date === dateStr && activeInstallerSet.has(e.installer),
          );

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              className={`group min-h-[100px] cursor-pointer p-2 text-left transition-colors hover:bg-blue-50/30 ${
                isToday ? 'bg-blue-50/40' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : 'text-[#18181b] group-hover:bg-gray-100'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-medium text-[#a8a8b4]">
                    {dayEvents.length} job{dayEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Event previews (max 3) */}
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((evt) => (
                  <div
                    key={evt.id}
                    className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: colorWithOpacity(evt.color, 0.1),
                      color: evt.color,
                      borderLeft: `2px solid ${evt.color}`,
                    }}
                  >
                    {evt.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1.5 text-[10px] text-[#a8a8b4]">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

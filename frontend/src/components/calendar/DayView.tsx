'use client';

import { CalendarEvent, Installer } from '@/lib/types';

interface DayViewProps {
  date: Date;
  dateStr: string;
  isToday: boolean;
  installers: Installer[];
  events: CalendarEvent[];
  activeInstallers: Set<string>;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM – 5 PM

function colorWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function getEventsForInstaller(
  events: CalendarEvent[],
  installerId: string,
  dateStr: string,
): CalendarEvent[] {
  return events.filter((e) => e.installer === installerId && e.date === dateStr);
}

export default function DayView({
  date,
  dateStr,
  isToday,
  installers,
  events,
  activeInstallers,
}: DayViewProps) {
  const filteredInstallers = installers.filter((inst) =>
    activeInstallers.has(inst.id),
  );

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayLabel = `${dayNames[date.getDay()]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Day header */}
      <div
        className={`border-b border-[#e6e6eb] px-6 py-3 ${isToday ? 'bg-blue-50/50' : 'bg-gray-50'}`}
      >
        <span
          className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-[#18181b]'}`}
        >
          {dayLabel}
        </span>
      </div>

      <div className="grid min-w-[600px] grid-cols-[80px_repeat(var(--cols),1fr)]" style={{ '--cols': filteredInstallers.length } as React.CSSProperties}>
        {/* Column headers: time + installer names */}
        <div className="sticky top-0 z-10 border-b border-r border-[#e6e6eb] bg-gray-50 px-2 py-3">
          <span className="text-xs font-medium text-[#a8a8b4]">Time</span>
        </div>
        {filteredInstallers.map((installer) => (
          <div
            key={installer.id}
            className="sticky top-0 z-10 border-b border-r border-[#e6e6eb] bg-gray-50 px-3 py-3 text-center last:border-r-0"
          >
            <div className="flex items-center justify-center gap-2">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: installer.color }}
              >
                {installer.initials}
              </div>
              <span className="text-xs font-medium text-[#18181b]">
                {installer.name}
              </span>
            </div>
          </div>
        ))}

        {/* Time rows */}
        {HOURS.map((hour) => (
          <TimeRow
            key={hour}
            hour={hour}
            installers={filteredInstallers}
            events={events}
            dateStr={dateStr}
          />
        ))}
      </div>

      {filteredInstallers.length === 0 && (
        <div className="flex h-48 items-center justify-center text-sm text-[#a8a8b4]">
          No installers selected. Use the filter chips above to show installers.
        </div>
      )}
    </div>
  );
}

function TimeRow({
  hour,
  installers,
  events,
  dateStr,
}: {
  hour: number;
  installers: Installer[];
  events: CalendarEvent[];
  dateStr: string;
}) {
  return (
    <>
      <div className="border-b border-r border-[#e6e6eb] px-2 py-3">
        <span className="text-[11px] font-medium text-[#a8a8b4]">
          {formatHour(hour)}
        </span>
      </div>
      {installers.map((installer) => {
        const installerEvents = getEventsForInstaller(events, installer.id, dateStr);
        const hourStr = String(hour).padStart(2, '0');
        const cellEvents = installerEvents.filter((e) => {
          const startHour = parseInt(e.startTime.split(':')[0], 10);
          const endHour = parseInt(e.endTime.split(':')[0], 10);
          return hour >= startHour && hour < endHour;
        });

        return (
          <div
            key={installer.id}
            className="group relative min-h-[50px] border-b border-r border-[#e6e6eb] p-1 last:border-r-0"
          >
            {cellEvents.map((evt) => {
              const startHour = parseInt(evt.startTime.split(':')[0], 10);
              // Only render the event block in the first hour it appears
              if (hour !== startHour) return null;
              const endHour = parseInt(evt.endTime.split(':')[0], 10);
              const span = Math.max(endHour - startHour, 1);
              return (
                <button
                  key={evt.id}
                  onClick={() => {}}
                  className="w-full cursor-pointer rounded-lg p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    backgroundColor: colorWithOpacity(evt.color, 0.1),
                    borderLeft: `3px solid ${evt.color}`,
                    height: span > 1 ? `${span * 50 - 8}px` : undefined,
                    position: span > 1 ? 'absolute' : undefined,
                    zIndex: span > 1 ? 5 : undefined,
                    left: span > 1 ? '4px' : undefined,
                    right: span > 1 ? '4px' : undefined,
                  }}
                >
                  <div
                    className="truncate text-[11px] font-bold leading-tight"
                    style={{ color: evt.color }}
                  >
                    {evt.title}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[#60606a]">
                    {evt.vehicle}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#a8a8b4]">
                    {evt.startTime} – {evt.endTime}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

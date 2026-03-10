'use client';

import { CalendarEvent, Installer } from '@/lib/types';

interface WeekViewProps {
  weekDays: { date: Date; label: string; dateStr: string; isToday: boolean }[];
  installers: Installer[];
  events: CalendarEvent[];
  activeInstallers: Set<string>;
}

function getEventsForCell(
  events: CalendarEvent[],
  installerId: string,
  dateStr: string,
): CalendarEvent[] {
  return events.filter((e) => e.installer === installerId && e.date === dateStr);
}

function colorWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function WeekView({
  weekDays,
  installers,
  events,
  activeInstallers,
}: WeekViewProps) {
  const filteredInstallers = installers.filter((inst) =>
    activeInstallers.has(inst.id),
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="grid min-w-[700px] grid-cols-[140px_repeat(5,1fr)]">
        {/* Header row */}
        <div className="sticky top-0 z-10 border-b border-r border-[#e6e6eb] bg-gray-50 px-4 py-3">
          <span className="text-xs font-medium text-[#a8a8b4]">Installer</span>
        </div>
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`sticky top-0 z-10 border-b border-r border-[#e6e6eb] px-3 py-3 text-center last:border-r-0 ${
              day.isToday ? 'bg-blue-50/50' : 'bg-gray-50'
            }`}
          >
            <div className="text-xs font-medium text-[#a8a8b4]">
              {dayNames[day.date.getDay()]}
            </div>
            <div
              className={`mt-0.5 text-sm font-semibold ${
                day.isToday ? 'text-blue-600' : 'text-[#18181b]'
              }`}
            >
              {day.date.getDate()}
            </div>
          </div>
        ))}

        {/* Installer rows */}
        {filteredInstallers.map((installer) => (
          <InstallerRow
            key={installer.id}
            installer={installer}
            weekDays={weekDays}
            events={events}
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

function InstallerRow({
  installer,
  weekDays,
  events,
}: {
  installer: Installer;
  weekDays: WeekViewProps['weekDays'];
  events: CalendarEvent[];
}) {
  return (
    <>
      {/* Installer name cell */}
      <div className="flex items-start gap-2 border-b border-r border-[#e6e6eb] px-3 py-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: installer.color }}
        >
          {installer.initials}
        </div>
        <span className="mt-0.5 text-xs font-medium text-[#18181b]">
          {installer.name}
        </span>
      </div>

      {/* Day cells */}
      {weekDays.map((day) => {
        const cellEvents = getEventsForCell(events, installer.id, day.dateStr);
        return (
          <DayCell
            key={day.dateStr}
            isToday={day.isToday}
            events={cellEvents}
          />
        );
      })}
    </>
  );
}

function DayCell({
  isToday,
  events,
}: {
  isToday: boolean;
  events: CalendarEvent[];
}) {
  return (
    <div
      className={`group relative min-h-[80px] border-b border-r border-[#e6e6eb] p-1.5 last:border-r-0 ${
        isToday ? 'bg-blue-50/30' : ''
      }`}
    >
      {events.map((evt) => (
        <EventBlock key={evt.id} event={evt} />
      ))}
      {events.length === 0 && (
        <button
          onClick={() => console.log('Add event')}
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-[#a8a8b4] transition-colors hover:bg-gray-200 hover:text-[#60606a]">
            +
          </span>
        </button>
      )}
    </div>
  );
}

function EventBlock({ event }: { event: CalendarEvent }) {
  return (
    <button
      onClick={() => console.log('Open project:', event.projectId, event)}
      className="mb-1 w-full cursor-pointer rounded-lg p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: colorWithOpacity(event.color, 0.1),
        borderLeft: `3px solid ${event.color}`,
      }}
    >
      <div
        className="truncate text-[11px] font-bold leading-tight"
        style={{ color: event.color }}
      >
        {event.title}
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-[#60606a]">
        {event.vehicle}
      </div>
      <div className="mt-0.5 text-[10px] text-[#a8a8b4]">
        {event.startTime} – {event.endTime}
      </div>
    </button>
  );
}

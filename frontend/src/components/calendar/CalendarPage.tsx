'use client';

import { useState, useMemo, useCallback } from 'react';
import CalendarHeader from './CalendarHeader';
import WeekView from './WeekView';
import { installers, calendarEvents } from '@/lib/mock-calendar-data';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (monday.getMonth() === friday.getMonth()) {
    return `${monthNames[monday.getMonth()]} ${monday.getDate()} \u2013 ${friday.getDate()}, ${monday.getFullYear()}`;
  }
  return `${monthNames[monday.getMonth()]} ${monday.getDate()} \u2013 ${monthNames[friday.getMonth()]} ${friday.getDate()}, ${friday.getFullYear()}`;
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [activeView, setActiveView] = useState<'day' | 'week' | 'month'>('week');
  const [activeInstallers, setActiveInstallers] = useState<Set<string>>(
    () => new Set(installers.map((i) => i.id)),
  );

  const weekDays = useMemo(() => {
    const today = formatDate(new Date());
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = formatDate(date);
      return {
        date,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        isToday: dateStr === today,
      };
    });
  }, [weekStart]);

  const weekLabel = useMemo(() => formatWeekLabel(weekStart), [weekStart]);

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const handleToday = useCallback(() => {
    setWeekStart(getMonday(new Date()));
  }, []);

  const handleToggleInstaller = useCallback((id: string) => {
    setActiveInstallers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Summary metrics
  const weekEvents = calendarEvents.filter((e) =>
    weekDays.some((d) => d.dateStr === e.date),
  );
  const totalJobs = weekEvents.length;
  const shopJobs = weekEvents.filter((e) => e.location === 'shop').length;
  const onsiteJobs = weekEvents.filter((e) => e.location === 'on-site').length;

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        weekLabel={weekLabel}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        activeView={activeView}
        onViewChange={setActiveView}
        installers={installers}
        activeInstallers={activeInstallers}
        onToggleInstaller={handleToggleInstaller}
      />

      <WeekView
        weekDays={weekDays}
        installers={installers}
        events={calendarEvents}
        activeInstallers={activeInstallers}
      />

      {/* Summary bar */}
      <div className="flex items-center gap-6 border-t border-[#e6e6eb] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a8a8b4]">This week:</span>
          <span className="text-sm font-semibold text-[#18181b]">{totalJobs} jobs</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-xs text-[#60606a]">{shopJobs} shop</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs text-[#60606a]">{onsiteJobs} on-site</span>
        </div>
      </div>
    </div>
  );
}

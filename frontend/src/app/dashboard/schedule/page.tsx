'use client';

import { useMemo, useState } from 'react';

interface ScheduleBlock {
  id: string;
  jobName: string;
  client: string;
  team: string;
  time: string;
  phase: 'design' | 'production' | 'install';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Returns the Monday of the week containing the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Build an array of 5 weekday labels (Mon–Fri) offset by `weekOffset` weeks
 * from the current week. Each entry contains the label string and a date key
 * used to look up mock schedule data.
 */
function getWeekDays(weekOffset: number): { label: string; key: string }[] {
  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayName = DAY_NAMES[d.getDay()];
    const month = d.getMonth() + 1;
    const date = d.getDate();
    return {
      label: `${dayName} ${month}/${date}`,
      key: `${dayName} ${month}/${date}`,
    };
  });
}

/**
 * Mock schedule data keyed by day-of-week index (0 = Monday .. 4 = Friday).
 * When weekOffset === 0 these appear under the current week; for other weeks
 * the columns still show correct dates but display "No jobs scheduled".
 */
const mockScheduleByDayIndex: Record<number, ScheduleBlock[]> = {
  0: [
    { id: '1', jobName: 'Trailer — Full Wrap', client: 'Skyline Moving', team: 'Marcus, Devon', time: '8:00 AM – 4:00 PM', phase: 'install' },
    { id: '2', jobName: 'Sprinter — Color Change', client: 'CleanCo Services', team: 'Sarah', time: '9:00 AM – 12:00 PM', phase: 'design' },
  ],
  1: [
    { id: '3', jobName: 'Fleet Van #12', client: 'Metro Plumbing', team: 'Marcus, Taylor', time: '7:00 AM – 3:00 PM', phase: 'install' },
    { id: '4', jobName: 'Box Truck — Partial', client: 'FastFreight Inc.', team: 'Alex', time: '8:00 AM – 2:00 PM', phase: 'production' },
    { id: '5', jobName: 'Sedan — Accent Kit', client: 'Elite Auto Group', team: 'Jordan', time: '10:00 AM – 12:00 PM', phase: 'design' },
  ],
  2: [
    { id: '6', jobName: 'Fleet Van #12', client: 'Metro Plumbing', team: 'Marcus, Taylor', time: '7:00 AM – 12:00 PM', phase: 'install' },
    { id: '7', jobName: 'Pickup — Tailgate', client: 'Summit Electric', team: 'Alex', time: '1:00 PM – 4:00 PM', phase: 'production' },
  ],
  3: [
    { id: '8', jobName: 'Box Truck — Partial', client: 'FastFreight Inc.', team: 'Marcus, Devon', time: '7:00 AM – 4:00 PM', phase: 'install' },
    { id: '9', jobName: 'SUV — Hood & Roof', client: 'Greenfield Lawn Care', team: 'Sarah', time: '9:00 AM – 11:00 AM', phase: 'design' },
  ],
  4: [
    { id: '10', jobName: 'Cargo Van — Fleet', client: 'BrightPath Logistics', team: 'Jordan', time: '9:00 AM – 5:00 PM', phase: 'design' },
  ],
};

const phaseColors: Record<ScheduleBlock['phase'], string> = {
  design: 'border-l-violet-500 bg-violet-50/50',
  production: 'border-l-amber-500 bg-amber-50/50',
  install: 'border-l-emerald-500 bg-emerald-50/50',
};

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `+${weekOffset} week${weekOffset > 1 ? 's' : ''}` : `${weekOffset} week${weekOffset < -1 ? 's' : ''}`;

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // Only show mock data for the current week (offset 0). Other weeks show
  // empty columns until a real API is wired up.
  const scheduleData = useMemo(() => {
    const data: Record<string, ScheduleBlock[]> = {};
    weekDays.forEach((day, index) => {
      data[day.key] = weekOffset === 0 ? (mockScheduleByDayIndex[index] ?? []) : [];
    });
    return data;
  }, [weekDays, weekOffset]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Schedule</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {weekLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-4">
          {weekDays.map((day) => (
            <div key={day.key}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#a8a8b4]">
                {day.label}
              </h3>
              <div className="space-y-2">
                {(scheduleData[day.key] ?? []).map((block) => (
                  <div
                    key={block.id}
                    className={`rounded-lg border-l-[3px] p-3 ${phaseColors[block.phase]}`}
                  >
                    <p className="text-xs font-semibold text-[#18181b]">{block.jobName}</p>
                    <p className="mt-0.5 text-[11px] text-[#60606a]">{block.client}</p>
                    <p className="mt-1 text-[10px] text-[#a8a8b4]">{block.time}</p>
                    <p className="mt-0.5 text-[10px] text-[#a8a8b4]">{block.team}</p>
                  </div>
                ))}
                {!(scheduleData[day.key]?.length) && (
                  <div className="rounded-lg border border-dashed border-[#e6e6eb] p-4 text-center text-xs text-[#a8a8b4]">
                    No jobs scheduled
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

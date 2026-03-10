'use client';

import { useState } from 'react';

interface ScheduleJob {
  id: string;
  clientName: string;
  vehicle: string;
  location: string;
  timeSlot: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  day: number; // 0=Mon, 1=Tue, ...
  notes?: string;
}

const STATUS_STYLES: Record<
  ScheduleJob['status'],
  { bg: string; text: string; label: string }
> = {
  scheduled: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Scheduled',
  },
  'in-progress': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'In Progress',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Cancelled',
  },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(
    now.getDate() - ((now.getDay() + 6) % 7) + offset * 7,
  );
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(dates: Date[]) {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} — ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

const MOCK_JOBS: ScheduleJob[] = [
  {
    id: '1',
    clientName: 'Marcus Rivera',
    vehicle: '2024 BMW M4 — Full Body',
    location: 'Bay 1',
    timeSlot: '8:00 AM – 12:00 PM',
    status: 'scheduled',
    day: 0,
  },
  {
    id: '2',
    clientName: 'Sophia Chen',
    vehicle: '2023 Tesla Model Y — Partial',
    location: 'Bay 2',
    timeSlot: '9:00 AM – 11:30 AM',
    status: 'in-progress',
    day: 0,
  },
  {
    id: '3',
    clientName: 'David Park',
    vehicle: '2024 Porsche 911 GT3 — Full Body',
    location: 'Bay 1',
    timeSlot: '1:00 PM – 5:00 PM',
    status: 'scheduled',
    day: 1,
  },
  {
    id: '4',
    clientName: 'Elena Vasquez',
    vehicle: '2023 Mercedes G-Wagon — Accents',
    location: 'Bay 3',
    timeSlot: '8:00 AM – 10:00 AM',
    status: 'completed',
    day: 2,
  },
  {
    id: '5',
    clientName: 'James Whitfield',
    vehicle: '2024 Audi RS6 — Full Body',
    location: 'Bay 1',
    timeSlot: '8:00 AM – 4:00 PM',
    status: 'scheduled',
    day: 3,
  },
  {
    id: '6',
    clientName: 'Aisha Patel',
    vehicle: '2025 Rivian R1S — Partial Hood/Fenders',
    location: 'Bay 2',
    timeSlot: '10:00 AM – 1:00 PM',
    status: 'cancelled',
    day: 4,
  },
];

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(0);

  const weekDates = getWeekDates(weekOffset);

  const jobsForDay = (day: number) =>
    MOCK_JOBS.filter((j) => j.day === day);

  const todayTotal = MOCK_JOBS.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">My Schedule</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {todayTotal} jobs this week
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#e6e6eb] bg-gray-50">
              <button
                onClick={() => setView('week')}
                className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'week'
                    ? 'bg-white text-[#18181b] shadow-sm'
                    : 'text-[#60606a] hover:text-[#18181b]'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('day')}
                className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'day'
                    ? 'bg-white text-[#18181b] shadow-sm'
                    : 'text-[#60606a] hover:text-[#18181b]'
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>
        {/* Week navigation */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-md border border-[#e6e6eb] p-1.5 text-[#60606a] transition-colors hover:bg-gray-50"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="font-mono text-sm font-medium text-[#18181b]">
            {formatWeekRange(weekDates)}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-md border border-[#e6e6eb] p-1.5 text-[#60606a] transition-colors hover:bg-gray-50"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="ml-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              Today
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'week' ? (
          <div className="grid grid-cols-6 gap-4">
            {DAY_LABELS.map((label, dayIndex) => {
              const dayJobs = jobsForDay(dayIndex);
              return (
                <div key={label} className="min-w-0">
                  <div className="mb-3 text-center">
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[#18181b]">
                      {formatDate(weekDates[dayIndex])}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayJobs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#e6e6eb] p-4 text-center">
                        <p className="text-xs text-[#a8a8b4]">No jobs</p>
                      </div>
                    ) : (
                      dayJobs.map((job) => {
                        const style = STATUS_STYLES[job.status];
                        return (
                          <div
                            key={job.id}
                            className="cursor-pointer rounded-lg border border-[#e6e6eb] bg-white p-3 transition-shadow hover:shadow-md"
                          >
                            <div className="mb-2 flex items-start justify-between">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                              >
                                {style.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[#18181b]">
                              {job.clientName}
                            </p>
                            <p className="mt-1 text-xs text-[#60606a]">
                              {job.vehicle}
                            </p>
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#a8a8b4]">
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                viewBox="0 0 16 16"
                              >
                                <circle
                                  cx="8"
                                  cy="8"
                                  r="6.5"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                />
                                <path
                                  d="M8 4.5V8l2.5 1.5"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                              {job.timeSlot}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#a8a8b4]">
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                viewBox="0 0 16 16"
                              >
                                <path
                                  d="M8 1.5a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4z"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                />
                                <circle
                                  cx="8"
                                  cy="5.5"
                                  r="1.5"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                />
                              </svg>
                              {job.location}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Day view */
          <div>
            {/* Day selector */}
            <div className="mb-6 flex gap-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                    selectedDay === i
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-[#e6e6eb] text-[#60606a] hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-mono text-[9.5px] uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    {formatDate(weekDates[i])}
                  </span>
                </button>
              ))}
            </div>

            {/* Day jobs */}
            <div className="space-y-3">
              {jobsForDay(selectedDay).length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e6e6eb] p-12 text-center">
                  <p className="text-sm text-[#a8a8b4]">
                    No jobs scheduled for this day
                  </p>
                </div>
              ) : (
                jobsForDay(selectedDay).map((job) => {
                  const style = STATUS_STYLES[job.status];
                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 rounded-lg border border-[#e6e6eb] bg-white p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="w-36 shrink-0 text-center">
                        <p className="font-mono text-sm font-medium text-[#18181b]">
                          {job.timeSlot.split('–')[0].trim()}
                        </p>
                        <p className="text-[11px] text-[#a8a8b4]">
                          to {job.timeSlot.split('–')[1]?.trim()}
                        </p>
                      </div>
                      <div className="h-10 w-px bg-[#e6e6eb]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#18181b]">
                            {job.clientName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#60606a]">
                          {job.vehicle}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-[#60606a]">
                          {job.location}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

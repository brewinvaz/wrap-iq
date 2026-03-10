'use client';

import { useState } from 'react';

interface ScheduleBlock {
  id: string;
  jobName: string;
  client: string;
  team: string;
  time: string;
  phase: 'design' | 'production' | 'install';
}

const days = ['Mon 3/9', 'Tue 3/10', 'Wed 3/11', 'Thu 3/12', 'Fri 3/13'];

const scheduleData: Record<string, ScheduleBlock[]> = {
  'Mon 3/9': [
    { id: '1', jobName: 'Trailer — Full Wrap', client: 'Skyline Moving', team: 'Marcus, Devon', time: '8:00 AM – 4:00 PM', phase: 'install' },
    { id: '2', jobName: 'Sprinter — Color Change', client: 'CleanCo Services', team: 'Sarah', time: '9:00 AM – 12:00 PM', phase: 'design' },
  ],
  'Tue 3/10': [
    { id: '3', jobName: 'Fleet Van #12', client: 'Metro Plumbing', team: 'Marcus, Taylor', time: '7:00 AM – 3:00 PM', phase: 'install' },
    { id: '4', jobName: 'Box Truck — Partial', client: 'FastFreight Inc.', team: 'Alex', time: '8:00 AM – 2:00 PM', phase: 'production' },
    { id: '5', jobName: 'Sedan — Accent Kit', client: 'Elite Auto Group', team: 'Jordan', time: '10:00 AM – 12:00 PM', phase: 'design' },
  ],
  'Wed 3/11': [
    { id: '6', jobName: 'Fleet Van #12', client: 'Metro Plumbing', team: 'Marcus, Taylor', time: '7:00 AM – 12:00 PM', phase: 'install' },
    { id: '7', jobName: 'Pickup — Tailgate', client: 'Summit Electric', team: 'Alex', time: '1:00 PM – 4:00 PM', phase: 'production' },
  ],
  'Thu 3/12': [
    { id: '8', jobName: 'Box Truck — Partial', client: 'FastFreight Inc.', team: 'Marcus, Devon', time: '7:00 AM – 4:00 PM', phase: 'install' },
    { id: '9', jobName: 'SUV — Hood & Roof', client: 'Greenfield Lawn Care', team: 'Sarah', time: '9:00 AM – 11:00 AM', phase: 'design' },
  ],
  'Fri 3/13': [
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

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Schedule</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              Week of Mar 9
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
          {days.map((day) => (
            <div key={day}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#a8a8b4]">
                {day}
              </h3>
              <div className="space-y-2">
                {(scheduleData[day] ?? []).map((block) => (
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
                {!(scheduleData[day]?.length) && (
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

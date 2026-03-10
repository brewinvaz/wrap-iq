'use client';

import { useState } from 'react';

const timeEntries = [
  { id: '1', date: '2026-03-10', job: 'MTA Bus Fleet Wrap', clockIn: '07:00', clockOut: '12:30', hours: 5.5 },
  { id: '2', date: '2026-03-10', job: 'Summit Electric Trucks', clockIn: '13:00', clockOut: '16:30', hours: 3.5 },
  { id: '3', date: '2026-03-09', job: 'Coastal Brewing Van', clockIn: '07:30', clockOut: '15:00', hours: 7.5 },
  { id: '4', date: '2026-03-08', job: 'MTA Bus Fleet Wrap', clockIn: '06:45', clockOut: '14:15', hours: 7.5 },
  { id: '5', date: '2026-03-07', job: 'Summit Electric Trucks', clockIn: '07:00', clockOut: '12:00', hours: 5.0 },
  { id: '6', date: '2026-03-07', job: 'Jade Garden Signage', clockIn: '12:30', clockOut: '16:00', hours: 3.5 },
  { id: '7', date: '2026-03-06', job: 'MTA Bus Fleet Wrap', clockIn: '07:00', clockOut: '15:30', hours: 8.5 },
  { id: '8', date: '2026-03-05', job: 'Coastal Brewing Van', clockIn: '08:00', clockOut: '16:00', hours: 8.0 },
  { id: '9', date: '2026-03-04', job: 'Summit Electric Trucks', clockIn: '07:00', clockOut: '11:30', hours: 4.5 },
  { id: '10', date: '2026-03-04', job: 'MTA Bus Fleet Wrap', clockIn: '12:00', clockOut: '16:00', hours: 4.0 },
];

function getWeekStart(): string {
  const now = new Date('2026-03-10');
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

const weekStart = getWeekStart();

export default function TimeLogPage() {
  const [isClockedIn, setIsClockedIn] = useState(false);

  const weeklyEntries = timeEntries.filter((e) => e.date >= weekStart);
  const weeklyHours = weeklyEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalEntries = timeEntries.length;
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const daysWorked = new Set(weeklyEntries.map((e) => e.date)).size;

  const stats = [
    { label: 'This Week', value: `${weeklyHours.toFixed(1)}h`, sub: `${daysWorked} days` },
    { label: 'Avg / Day', value: `${daysWorked > 0 ? (weeklyHours / daysWorked).toFixed(1) : '0.0'}h`, sub: 'this week' },
    { label: 'Total Logged', value: `${totalHours.toFixed(1)}h`, sub: `${totalEntries} entries` },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Time Log</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {timeEntries.length} entries
            </span>
          </div>
        </div>
      </header>

      {/* Clock In / Out */}
      <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
              Current Status
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}
              />
              <span className="text-sm font-medium text-[#18181b]">
                {isClockedIn ? 'Clocked In' : 'Clocked Out'}
              </span>
              {isClockedIn && (
                <span className="font-mono text-xs text-[#a8a8b4]">since 07:00 AM</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsClockedIn(!isClockedIn)}
            className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors ${
              isClockedIn
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isClockedIn ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="shrink-0 grid grid-cols-3 gap-px border-b border-[#e6e6eb] bg-[#e6e6eb]">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white px-6 py-4">
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
              {stat.label}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#18181b]">{stat.value}</p>
            <p className="mt-0.5 text-xs text-[#a8a8b4]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Time Entries Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-[#e6e6eb] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e6e6eb]">
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Date</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Job</th>
                <th className="px-4 py-3 text-center font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Clock In</th>
                <th className="px-4 py-3 text-center font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Clock Out</th>
                <th className="px-4 py-3 text-right font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-[#e6e6eb] last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-[#60606a]">{entry.date}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#18181b]">{entry.job}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-[#60606a]">{entry.clockIn}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm text-[#60606a]">{entry.clockOut}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#18181b]">
                    {entry.hours.toFixed(1)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

const hoursEntries = [
  { id: '1', date: '2026-03-10', job: 'MTA Bus Fleet Wrap', task: 'Template setup and measurements', hours: 3.5 },
  { id: '2', date: '2026-03-10', job: 'Coastal Brewing Van', task: 'Color proofing revisions', hours: 1.5 },
  { id: '3', date: '2026-03-09', job: 'Summit Electric Trucks', task: 'Final artwork adjustments', hours: 4.0 },
  { id: '4', date: '2026-03-09', job: 'Jade Garden Signage', task: 'Initial concept design', hours: 2.0 },
  { id: '5', date: '2026-03-08', job: 'MTA Bus Fleet Wrap', task: 'Panel layout and cut lines', hours: 5.0 },
  { id: '6', date: '2026-03-07', job: 'Coastal Brewing Van', task: 'Design mockup on vehicle template', hours: 6.0 },
  { id: '7', date: '2026-03-06', job: 'Summit Electric Trucks', task: 'Logo vectorization', hours: 2.5 },
  { id: '8', date: '2026-03-05', job: 'MTA Bus Fleet Wrap', task: 'Client revision round 2', hours: 3.0 },
  { id: '9', date: '2026-03-04', job: 'Jade Garden Signage', task: 'Dimensional drawings', hours: 4.5 },
  { id: '10', date: '2026-03-03', job: 'Coastal Brewing Van', task: 'Print file preparation', hours: 2.0 },
  { id: '11', date: '2026-02-28', job: 'Summit Electric Trucks', task: 'Design concept sketches', hours: 3.5 },
  { id: '12', date: '2026-02-27', job: 'MTA Bus Fleet Wrap', task: 'Brand guidelines review', hours: 1.5 },
];

function getWeekStart(): string {
  const now = new Date('2026-03-10');
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

function getMonthStart(): string {
  return '2026-03-01';
}

export default function HoursPage() {
  const [showLogModal, setShowLogModal] = useState(false);

  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  const weeklyHours = hoursEntries
    .filter((e) => e.date >= weekStart)
    .reduce((sum, e) => sum + e.hours, 0);
  const monthlyHours = hoursEntries
    .filter((e) => e.date >= monthStart)
    .reduce((sum, e) => sum + e.hours, 0);
  const totalHours = hoursEntries.reduce((sum, e) => sum + e.hours, 0);
  const avgDaily = totalHours / new Set(hoursEntries.map((e) => e.date)).size;

  const stats = [
    { label: 'This Week', value: `${weeklyHours.toFixed(1)}h`, sub: 'Mon-Sun' },
    { label: 'This Month', value: `${monthlyHours.toFixed(1)}h`, sub: 'March 2026' },
    { label: 'Total Logged', value: `${totalHours.toFixed(1)}h`, sub: `${hoursEntries.length} entries` },
    { label: 'Avg / Day', value: `${avgDaily.toFixed(1)}h`, sub: 'working days' },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Design Hours</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {hoursEntries.length} entries
            </span>
          </div>
          <button
            onClick={() => setShowLogModal(!showLogModal)}
            className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Log Hours
          </button>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="shrink-0 grid grid-cols-2 gap-px border-b border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--surface-card)] px-6 py-4">
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
              {stat.label}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Log Hours Form (toggle) */}
      {showLogModal && (
        <div className="shrink-0 border-b border-[var(--border)] bg-blue-50 px-6 py-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Log New Hours</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Date</label>
              <input type="date" defaultValue="2026-03-10" className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Job</label>
              <input type="text" placeholder="Job name" className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Task</label>
              <input type="text" placeholder="Task description" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Hours</label>
              <input type="number" step="0.5" defaultValue="1" className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <button className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Hours Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Date</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Job</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Task</th>
                <th className="px-4 py-3 text-right font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Hours</th>
              </tr>
            </thead>
            <tbody>
              {hoursEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-overlay)]">
                  <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{entry.date}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{entry.job}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{entry.task}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {entry.hours.toFixed(1)}
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

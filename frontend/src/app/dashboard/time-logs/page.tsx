'use client';

import { useState } from 'react';

interface TimeLog {
  id: string;
  member: string;
  initials: string;
  color: string;
  project: string;
  task: string;
  hours: number;
  date: string;
  status: 'submitted' | 'approved';
}

interface SummaryStat {
  label: string;
  value: string;
  accent: boolean;
}

function computeStats(logs: TimeLog[]): SummaryStat[] {
  const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);
  const pendingHours = logs
    .filter((l) => l.status === 'submitted')
    .reduce((sum, l) => sum + l.hours, 0);
  const approvedHours = logs
    .filter((l) => l.status === 'approved')
    .reduce((sum, l) => sum + l.hours, 0);
  const uniqueMembers = new Set(logs.map((l) => l.member)).size;

  return [
    { label: 'Total Hours (This Week)', value: totalHours > 0 ? totalHours.toFixed(1) : '0', accent: false },
    { label: 'Pending Approval', value: pendingHours > 0 ? `${pendingHours.toFixed(1)} hrs` : '0 hrs', accent: pendingHours > 0 },
    { label: 'Approved', value: approvedHours > 0 ? `${approvedHours.toFixed(1)} hrs` : '0 hrs', accent: false },
    { label: 'Team Members Logged', value: `${uniqueMembers}`, accent: false },
  ];
}

export default function TimeLogsPage() {
  const [timeLogs] = useState<TimeLog[]>([]);
  const summaryStats = computeStats(timeLogs);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Time Logs</h1>
          </div>
          <div className="relative group">
            <button
              disabled
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
            >
              Export CSV
            </button>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {summaryStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
              <p className="text-xs text-[#a8a8b4]">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.accent ? 'text-amber-600' : 'text-[#18181b]'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">All Time Entries</h2>
          </div>

          {timeLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#18181b]">No time logs yet</p>
              <p className="mt-1 max-w-sm text-sm text-[#a8a8b4]">
                Time entries will appear here as team members log their hours.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Team Member</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Task</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Hours</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Action</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${log.color}`}>
                          {log.initials}
                        </div>
                        <span className="font-medium text-[#18181b]">{log.member}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#60606a]">{log.project}</td>
                    <td className="px-4 py-3 text-[#60606a]">{log.task}</td>
                    <td className="px-4 py-3 font-medium text-[#18181b]">{log.hours}h</td>
                    <td className="px-4 py-3 text-[#60606a]">{log.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {log.status === 'approved' ? 'Approved' : 'Submitted'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === 'submitted' && (
                        <div className="relative group/approve">
                          <button
                            disabled
                            className="text-xs font-medium text-emerald-600 opacity-50 cursor-not-allowed"
                          >
                            Approve
                          </button>
                          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/approve:opacity-100">
                            Coming soon
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

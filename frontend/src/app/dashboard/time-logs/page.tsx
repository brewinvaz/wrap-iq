'use client';

import { useState, useCallback } from 'react';

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

const initialTimeLogs: TimeLog[] = [
  { id: '1', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Metro Plumbing Fleet #12', task: 'Installation', hours: 8.0, date: '2026-03-10', status: 'submitted' },
  { id: '2', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'FastFreight Box Truck', task: 'Design — Side Panels', hours: 4.5, date: '2026-03-10', status: 'submitted' },
  { id: '3', member: 'Alex Rivera', initials: 'AR', color: 'bg-emerald-500', project: 'CleanCo Sprinter', task: 'Print + Laminate', hours: 6.0, date: '2026-03-10', status: 'approved' },
  { id: '4', member: 'Jordan Lee', initials: 'JL', color: 'bg-amber-500', project: 'Elite Auto Sedan', task: 'Design — Revision 2', hours: 3.0, date: '2026-03-10', status: 'approved' },
  { id: '5', member: 'Taylor Wright', initials: 'TW', color: 'bg-rose-500', project: 'Skyline Trailer', task: 'Installation', hours: 8.0, date: '2026-03-09', status: 'approved' },
  { id: '6', member: 'Devon Patel', initials: 'DP', color: 'bg-teal-500', project: 'Skyline Trailer', task: 'Installation (assist)', hours: 8.0, date: '2026-03-09', status: 'approved' },
  { id: '7', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Summit Electric Pickup', task: 'Installation', hours: 3.0, date: '2026-03-09', status: 'approved' },
  { id: '8', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'Greenfield SUV', task: 'Design — Initial', hours: 5.0, date: '2026-03-09', status: 'submitted' },
];

function computeSummaryStats(logs: TimeLog[]) {
  const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);
  const pendingHours = logs.filter((l) => l.status === 'submitted').reduce((sum, l) => sum + l.hours, 0);
  const approvedHours = logs.filter((l) => l.status === 'approved').reduce((sum, l) => sum + l.hours, 0);
  const uniqueMembers = new Set(logs.map((l) => l.member)).size;

  return [
    { label: 'Total Hours (This Week)', value: totalHours.toFixed(1), accent: false },
    { label: 'Pending Approval', value: `${pendingHours.toFixed(1)} hrs`, accent: pendingHours > 0 },
    { label: 'Approved', value: `${approvedHours.toFixed(1)} hrs`, accent: false },
    { label: 'Team Members Logged', value: `${uniqueMembers} / 7`, accent: false },
  ];
}

function exportTimeLogsCsv(logs: TimeLog[]) {
  const headers = ['Team Member', 'Project', 'Task', 'Hours', 'Date', 'Status'];
  const rows = logs.map((log) => [
    log.member,
    log.project,
    log.task,
    log.hours.toString(),
    log.date,
    log.status === 'approved' ? 'Approved' : 'Submitted',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `time-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TimeLogsPage() {
  const [logs, setLogs] = useState<TimeLog[]>(initialTimeLogs);
  const [toast, setToast] = useState<string | null>(null);

  const summaryStats = computeSummaryStats(logs);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleApprove = useCallback(
    (id: string) => {
      setLogs((prev) =>
        prev.map((log) => (log.id === id ? { ...log, status: 'approved' as const } : log))
      );
      const entry = logs.find((l) => l.id === id);
      if (entry) {
        showToast(`Approved ${entry.hours}h for ${entry.member}`);
      }
    },
    [logs, showToast]
  );

  const handleExportCsv = useCallback(() => {
    exportTimeLogsCsv(logs);
    showToast('CSV exported successfully');
  }, [logs, showToast]);

  return (
    <div className="flex h-full flex-col">
      {toast && (
        <div className="fixed right-6 top-6 z-50 animate-fade-in rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          {toast}
        </div>
      )}

      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Time Logs</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              Week of Mar 9
            </span>
          </div>
          <button
            onClick={handleExportCsv}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Export CSV
          </button>
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
              {logs.map((log) => (
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
                      <button
                        onClick={() => handleApprove(log.id)}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                      >
                        Approve
                      </button>
                    )}
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

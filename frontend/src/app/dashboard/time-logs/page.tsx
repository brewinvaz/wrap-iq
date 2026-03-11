'use client';

import { useCallback, useMemo, useState } from 'react';

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

function buildCsv(logs: TimeLog[]): string {
  const header = 'Team Member,Project,Task,Hours,Date,Status';
  const rows = logs.map(
    (l) => `"${l.member}","${l.project}","${l.task}",${l.hours},${l.date},${l.status}`,
  );
  return [header, ...rows].join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TimeLogsPage() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(initialTimeLogs);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleApprove = useCallback(
    (id: string) => {
      setTimeLogs((prev) =>
        prev.map((log) => (log.id === id ? { ...log, status: 'approved' as const } : log)),
      );
      const entry = timeLogs.find((l) => l.id === id);
      showToast(`Approved ${entry?.hours ?? 0}h for ${entry?.member ?? 'team member'}`);
    },
    [timeLogs, showToast],
  );

  const handleExportCsv = useCallback(() => {
    const csv = buildCsv(timeLogs);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `time-logs-${dateStr}.csv`);
    showToast('CSV exported successfully');
  }, [timeLogs, showToast]);

  const summaryStats = useMemo(() => {
    const totalHours = timeLogs.reduce((sum, l) => sum + l.hours, 0);
    const pendingHours = timeLogs
      .filter((l) => l.status === 'submitted')
      .reduce((sum, l) => sum + l.hours, 0);
    const approvedHours = timeLogs
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + l.hours, 0);
    const uniqueMembers = new Set(timeLogs.map((l) => l.member)).size;

    return [
      { label: 'Total Hours (This Week)', value: totalHours.toFixed(1), accent: false },
      { label: 'Pending Approval', value: `${pendingHours.toFixed(1)} hrs`, accent: pendingHours > 0 },
      { label: 'Approved', value: `${approvedHours.toFixed(1)} hrs`, accent: false },
      { label: 'Team Members Logged', value: `${uniqueMembers} / 7`, accent: false },
    ];
  }, [timeLogs]);

  return (
    <div className="flex h-full flex-col">
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

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg transition-opacity ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <svg
            className={`h-5 w-5 shrink-0 ${toast.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {toast.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            )}
          </svg>
          <span className={`text-sm ${toast.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}

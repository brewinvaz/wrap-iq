'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface TimeLogUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface TimeLogWorkOrder {
  id: string;
  job_number: string;
}

interface TimeLog {
  id: string;
  user: TimeLogUser;
  work_order: TimeLogWorkOrder | null;
  task: string;
  hours: number;
  log_date: string;
  status: 'submitted' | 'approved';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TimeLogListResponse {
  items: TimeLog[];
  total: number;
}

interface TimeLogSummary {
  total_hours: number;
  pending_hours: number;
  approved_hours: number;
  unique_members: number;
}

// --- Avatar color assignment ---

const avatarColors = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- CSV export ---

function exportTimeLogsCsv(logs: TimeLog[]) {
  const headers = ['Team Member', 'Project', 'Task', 'Hours', 'Date', 'Status'];
  const rows = logs.map((log) => [
    log.user.full_name || log.user.email,
    log.work_order?.job_number || '—',
    log.task,
    log.hours.toString(),
    log.log_date,
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

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[#e6e6eb] bg-gray-100" />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] bg-[#f4f4f6] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-[#e6e6eb] px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main page ---

export default function TimeLogsPage() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<TimeLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TimeLogListResponse>('/api/time-logs?limit=100');
      setLogs(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load time logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.get<TimeLogSummary>('/api/time-logs/summary');
      setSummary(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [fetchLogs, fetchSummary]);

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await api.patch<TimeLog>(`/api/time-logs/${id}/approve`);
        const entry = logs.find((l) => l.id === id);
        if (entry) {
          showToast(`Approved ${entry.hours}h for ${entry.user.full_name || entry.user.email}`);
        }
        fetchLogs();
        fetchSummary();
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : 'Failed to approve');
      }
    },
    [logs, showToast, fetchLogs, fetchSummary]
  );

  const handleExportCsv = useCallback(() => {
    exportTimeLogsCsv(logs);
    showToast('CSV exported successfully');
  }, [logs, showToast]);

  if (loading && logs.length === 0) return <LoadingSkeleton />;

  const summaryStats = summary
    ? [
        { label: 'Total Hours', value: Number(summary.total_hours).toFixed(1), accent: false },
        { label: 'Pending Approval', value: `${Number(summary.pending_hours).toFixed(1)} hrs`, accent: Number(summary.pending_hours) > 0 },
        { label: 'Approved', value: `${Number(summary.approved_hours).toFixed(1)} hrs`, accent: false },
        { label: 'Team Members Logged', value: String(summary.unique_members), accent: false },
      ]
    : [
        { label: 'Total Hours', value: '0.0', accent: false },
        { label: 'Pending Approval', value: '0.0 hrs', accent: false },
        { label: 'Approved', value: '0.0 hrs', accent: false },
        { label: 'Team Members Logged', value: '0', accent: false },
      ];

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
              {total} total
            </span>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={fetchLogs} className="text-sm font-medium text-red-700 underline">
            Retry
          </button>
        </div>
      )}

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

          {logs.length === 0 && !loading ? (
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
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(log.user.id)}`}>
                          {getInitials(log.user.full_name, log.user.email)}
                        </div>
                        <span className="font-medium text-[#18181b]">{log.user.full_name || log.user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#60606a]">{log.work_order?.job_number || '—'}</td>
                    <td className="px-4 py-3 text-[#60606a]">{log.task}</td>
                    <td className="px-4 py-3 font-medium text-[#18181b]">{log.hours}h</td>
                    <td className="px-4 py-3 text-[#60606a]">{formatDate(log.log_date)}</td>
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
          )}
        </div>
      </div>
    </div>
  );
}

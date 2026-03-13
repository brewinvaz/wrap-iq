'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';
import LogTimeModal from '@/components/time-logs/LogTimeModal';

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
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-overlay)]" />
      </div>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]" />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-overlay)]" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border)] px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
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
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);

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
        <div className="fixed right-6 top-6 z-50 animate-fade-in rounded-lg border border-[var(--phase-install)] bg-[var(--phase-install)]/10 px-4 py-3 text-sm font-medium text-[var(--phase-install)] shadow-lg">
          {toast}
        </div>
      )}

      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Time Logs</h1>
            <span className="rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-secondary)]">
              {total} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowLogTimeModal(true)}
            >
              Log Time
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={logs.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <Button variant="danger" size="sm" onClick={fetchLogs} className="underline">
            Retry
          </Button>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {summaryStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              <p className={`mt-1 font-mono text-2xl font-bold ${s.accent ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">All Time Entries</h2>
          </div>

          {logs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <Clock className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No time logs yet</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Time entries will appear here as team members log their hours.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Team Member</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Project</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Task</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Hours</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(log.user.id)}`}>
                          {getInitials(log.user.full_name, log.user.email)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{log.user.full_name || log.user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{log.work_order?.job_number || '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{log.task}</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{log.hours}h</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatDate(log.log_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        log.status === 'approved'
                          ? 'bg-[var(--phase-install)]/10 text-[var(--phase-install)]'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {log.status === 'approved' ? 'Approved' : 'Submitted'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === 'submitted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(log.id)}
                          className="text-[var(--phase-install)] hover:opacity-80"
                        >
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <LogTimeModal
        isOpen={showLogTimeModal}
        onClose={() => setShowLogTimeModal(false)}
        onCreated={() => {
          fetchLogs();
          fetchSummary();
          showToast('Time entry logged successfully');
        }}
      />
    </div>
  );
}

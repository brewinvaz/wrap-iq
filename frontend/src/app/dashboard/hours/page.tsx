'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

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

export default function HoursPage() {
  const [entries, setEntries] = useState<TimeLog[]>([]);
  const [summary, setSummary] = useState<TimeLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [logsRes, summaryRes] = await Promise.all([
        api.get<TimeLogListResponse>('/api/time-logs?limit=100'),
        api.get<TimeLogSummary>('/api/time-logs/summary'),
      ]);
      setEntries(logsRes.items);
      setSummary(summaryRes);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load time logs');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const uniqueDays = new Set(entries.map((e) => e.log_date)).size;
  const avgDaily = uniqueDays > 0 ? totalHours / uniqueDays : 0;

  const stats = [
    { label: 'Total Hours', value: summary ? `${summary.total_hours.toFixed(1)}h` : '—' },
    { label: 'Approved', value: summary ? `${summary.approved_hours.toFixed(1)}h` : '—' },
    { label: 'Pending', value: summary ? `${summary.pending_hours.toFixed(1)}h` : '—' },
    { label: 'Avg / Day', value: `${avgDaily.toFixed(1)}h` },
  ];

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Design Hours</h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">Loading time logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Design Hours</h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchData} className="mt-2 text-[var(--accent-primary)]">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Design Hours</h1>
          <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {entries.length} entries
          </span>
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
          </div>
        ))}
      </div>

      {/* Hours Table */}
      <div className="flex-1 overflow-auto p-6">
        {entries.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
            No time entries logged yet.
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Date</th>
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Job</th>
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Task</th>
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-right font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">Hours</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-overlay)]">
                    <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{entry.log_date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                      {entry.work_order ? `Job #${entry.work_order.job_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{entry.task}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {entry.hours.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

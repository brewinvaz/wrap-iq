'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import DatePicker from '@/components/ui/DatePicker';

// --- API response types ---

interface AnalyticsSummary {
  total_hours: number;
  avg_effective_rate: number | null;
  avg_efficiency_pct: number | null;
  total_jobs_completed: number;
}

interface PhaseEfficiencyItem {
  phase: string;
  avg_actual_hours: number;
  avg_estimated_hours: number;
  efficiency_pct: number | null;
}

interface PhaseEfficiencyResponse {
  items: PhaseEfficiencyItem[];
}

interface MemberHoursItem {
  user_id: string;
  full_name: string | null;
  email: string;
  total_hours: number;
  phase_breakdown: Record<string, number>;
}

interface HoursByMemberResponse {
  items: MemberHoursItem[];
}

interface JobRankedItem {
  work_order_id: string;
  job_number: string;
  job_value: number;
  total_hours: number;
  estimated_hours: number | null;
  effective_rate: number | null;
  efficiency_pct: number | null;
}

interface JobsRankedResponse {
  items: JobRankedItem[];
}

// --- Helpers ---

function buildQueryString(startDate: string, endDate: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [efficiency, setEfficiency] = useState<PhaseEfficiencyItem[]>([]);
  const [members, setMembers] = useState<MemberHoursItem[]>([]);
  const [jobs, setJobs] = useState<JobRankedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = buildQueryString(startDate, endDate);
    try {
      const [summaryData, efficiencyData, membersData, jobsData] = await Promise.all([
        api.get<AnalyticsSummary>(`/api/analytics/summary${qs}`),
        api.get<PhaseEfficiencyResponse>(`/api/analytics/efficiency${qs}`),
        api.get<HoursByMemberResponse>(`/api/analytics/hours-by-member${qs}`),
        api.get<JobsRankedResponse>(`/api/analytics/jobs-ranked${qs}`),
      ]);
      setSummary(summaryData);
      setEfficiency(efficiencyData.items);
      setMembers(membersData.items);
      setJobs(jobsData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) return <LoadingSkeleton />;

  const summaryStats = summary
    ? [
        { label: 'Total Hours', value: Number(summary.total_hours).toFixed(1) },
        { label: 'Avg Effective Rate', value: summary.avg_effective_rate != null ? `$${Number(summary.avg_effective_rate).toFixed(2)}/hr` : '--' },
        { label: 'Avg Efficiency', value: summary.avg_efficiency_pct != null ? `${Number(summary.avg_efficiency_pct).toFixed(1)}%` : '--' },
        { label: 'Jobs Completed', value: String(summary.total_jobs_completed) },
      ]
    : [
        { label: 'Total Hours', value: '0.0' },
        { label: 'Avg Effective Rate', value: '--' },
        { label: 'Avg Efficiency', value: '--' },
        { label: 'Jobs Completed', value: '0' },
      ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Analytics</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">From</label>
              <DatePicker value={startDate} onChange={setStartDate} size="sm" placeholder="Start date" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">To</label>
              <DatePicker value={endDate} onChange={setEndDate} size="sm" placeholder="End date" />
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={fetchAll} className="text-sm font-medium text-red-400 underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {summaryStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Phase Efficiency table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Phase Efficiency</h2>
          </div>

          {efficiency.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <Clock className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No time logged yet</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Phase efficiency data will appear here as team members log their hours.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Phase</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Actual Hours</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Estimated Hours</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Efficiency %</th>
                </tr>
              </thead>
              <tbody>
                {efficiency.map((item) => {
                  const effPct = item.efficiency_pct != null ? Number(item.efficiency_pct) : null;
                  const isOverBudget = effPct != null && effPct > 100;
                  return (
                    <tr key={item.phase} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{capitalize(item.phase)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(item.avg_actual_hours).toFixed(1)}h</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(item.avg_estimated_hours).toFixed(1)}h</td>
                      <td className="px-4 py-3">
                        {effPct != null ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isOverBudget
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-[var(--phase-install)]/10 text-[var(--phase-install)]'
                          }`}>
                            {effPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Hours by Team Member table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Hours by Team Member</h2>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <Clock className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No time logged yet</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Team member hours will appear here as they log their time.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Member</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Design</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Production</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Install</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Other</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.user_id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{member.full_name || member.email}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(member.phase_breakdown.design || 0).toFixed(1)}h</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(member.phase_breakdown.production || 0).toFixed(1)}h</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(member.phase_breakdown.install || 0).toFixed(1)}h</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(member.phase_breakdown.other || 0).toFixed(1)}h</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{Number(member.total_hours).toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Jobs by Effective Rate table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Jobs by Effective Rate</h2>
          </div>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <BarChart3 className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No completed jobs with time logged</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Job rankings will appear here once jobs are completed with time entries.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Job #</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Value</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Hours</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Estimated</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">$/hr</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Efficiency %</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const effPct = job.efficiency_pct != null ? Number(job.efficiency_pct) : null;
                  const isOverBudget = effPct != null && effPct > 100;
                  return (
                    <tr key={job.work_order_id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{job.job_number}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatCurrency(job.job_value)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{Number(job.total_hours).toFixed(1)}h</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                        {job.estimated_hours != null ? `${Number(job.estimated_hours).toFixed(1)}h` : '--'}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">
                        {job.effective_rate != null ? `$${Number(job.effective_rate).toFixed(2)}` : '--'}
                      </td>
                      <td className="px-4 py-3">
                        {effPct != null ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isOverBudget
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-[var(--phase-install)]/10 text-[var(--phase-install)]'
                          }`}>
                            {effPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

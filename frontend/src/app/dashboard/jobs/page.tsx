'use client';

import { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';

type PhaseFilter = 'all' | 'work-order' | 'design' | 'production' | 'install';

interface ApiKanbanStage {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface ApiVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface ApiWorkOrder {
  id: string;
  job_number: string;
  job_type: string;
  job_value: number;
  priority: string;
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  status: ApiKanbanStage | null;
  vehicles: ApiVehicle[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiWorkOrderListResponse {
  items: ApiWorkOrder[];
  total: number;
}

interface Job {
  id: string;
  jobNumber: string;
  jobType: string;
  clientName: string;
  vehicle: string;
  phase: PhaseFilter;
  status: string;
  statusColor: string;
  dueDate: string | null;
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '—';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function derivePhase(wo: ApiWorkOrder): PhaseFilter {
  const statusName = wo.status?.name?.toLowerCase() ?? '';
  const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';

  // Check for install-related statuses
  if (statusName.includes('install') || statusName.includes('scheduled')) return 'install';
  if (systemStatus === 'completed') return 'install';

  // Check for production-related statuses
  if (statusName.includes('print') || statusName.includes('laminat') || statusName.includes('production')) return 'production';

  // Check for design-related statuses
  if (statusName.includes('design') || statusName.includes('proof') || statusName.includes('revis') || statusName.includes('art')) return 'design';

  // Check for work-order statuses
  if (statusName.includes('new') || statusName.includes('estimate') || systemStatus === 'lead') return 'work-order';

  // Fallback based on system_status
  if (systemStatus === 'in_progress') return 'design';
  return 'work-order';
}

function toJob(wo: ApiWorkOrder): Job {
  return {
    id: wo.id,
    jobNumber: wo.job_number,
    jobType: wo.job_type,
    clientName: wo.client_name ?? '—',
    vehicle: vehicleLabel(wo.vehicles),
    phase: derivePhase(wo),
    status: wo.status?.name ?? 'Unknown',
    statusColor: wo.status?.color ?? '#6b7280',
    dueDate: wo.estimated_completion_date,
  };
}

const phaseStyles: Record<PhaseFilter, { bg: string; text: string; label: string }> = {
  'all': { bg: '', text: '', label: '' },
  'work-order': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Work Order' },
  design: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Design' },
  production: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Production' },
  install: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Install' },
};

const tabs: { key: PhaseFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'work-order', label: 'Work Orders' },
  { key: 'design', label: 'Design' },
  { key: 'production', label: 'Production' },
  { key: 'install', label: 'Install' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-40 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--surface-app)]" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-app)] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border)] px-4 py-3">
              <div className="h-5 w-full animate-pulse rounded bg-[var(--surface-app)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async (cancelled = false) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
      if (!cancelled) setWorkOrders(resp?.items ?? []);
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof ApiError ? err.message : 'Failed to load jobs');
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchJobs(cancelled);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jobs = useMemo(() => workOrders.map(toJob), [workOrders]);

  const filtered = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((j) => j.phase === filter)),
    [jobs, filter],
  );

  const counts = useMemo(() => {
    const c: Record<PhaseFilter, number> = { all: jobs.length, 'work-order': 0, design: 0, production: 0, install: 0 };
    jobs.forEach((j) => { c[j.phase]++; });
    return c;
  }, [jobs]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load jobs</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={() => fetchJobs()}
          className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">All Jobs Board</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {jobs.length} jobs
            </span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + New Job
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-60">{counts[tab.key]}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <svg className="mb-3 h-10 w-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-secondary)]">No jobs found</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Jobs will appear here as work orders are created.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-app)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Job</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Phase</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const phase = phaseStyles[job.phase];
                  return (
                    <tr key={job.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-overlay)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        {job.jobNumber}
                        {job.jobType && (
                          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{job.jobType}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{job.clientName}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{job.vehicle}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${phase.bg} ${phase.text}`}>
                          {phase.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${job.statusColor}15`,
                            color: job.statusColor,
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(job.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateWorkOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={() => { fetchJobs(); }}
      />
    </div>
  );
}

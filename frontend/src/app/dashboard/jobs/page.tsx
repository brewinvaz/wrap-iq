'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';

// --- API response types ---

interface KanbanStageResponse {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface WorkOrder {
  id: string;
  job_number: string;
  job_type: 'commercial' | 'personal';
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  status: KanbanStageResponse | null;
  vehicles: { id: string; make: string | null; model: string | null; year: number | null; vin: string | null }[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkOrderListResponse {
  items: WorkOrder[];
  total: number;
}

// --- Phase mapping ---

type Phase = 'work-order' | 'design' | 'production' | 'install';
type PhaseFilter = 'all' | Phase;

/**
 * Map a kanban stage name to a UI phase for tab filtering.
 * Stage names are freeform; we match known keywords.
 */
function stageToPhase(stage: KanbanStageResponse | null): Phase {
  if (!stage) return 'work-order';
  const name = stage.name.toLowerCase();
  if (name.includes('design') || name.includes('proof') || name.includes('revision')) return 'design';
  if (name.includes('print') || name.includes('production') || name.includes('laminate')) return 'production';
  if (name.includes('install') || name.includes('schedule')) return 'install';
  return 'work-order';
}

const phaseStyles: Record<Phase, { bg: string; text: string; label: string }> = {
  'work-order': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Work Order' },
  design: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Design' },
  production: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Production' },
  install: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Install' },
};

const tabs: { key: PhaseFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'work-order', label: 'Work Orders' },
  { key: 'design', label: 'Design' },
  { key: 'production', label: 'Production' },
  { key: 'install', label: 'Install' },
];

// --- Helpers ---

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function vehicleSummary(wo: WorkOrder): string {
  if (wo.vehicles.length === 0) return '—';
  return wo.vehicles
    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown vehicle')
    .join(', ');
}

// --- Skeleton rows ---

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-[#e6e6eb] last:border-0">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function JobsPage() {
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<WorkOrderListResponse>('/api/work-orders?limit=100');
      setWorkOrders(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Client-side phase filtering
  const filtered =
    filter === 'all'
      ? workOrders
      : workOrders.filter((wo) => stageToPhase(wo.status) === filter);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">All Jobs Board</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {total} jobs
            </span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
                filter === tab.key ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchJobs}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-[#18181b] transition-colors hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Job</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Phase</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Due</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-[#60606a]">
                      {filter === 'all'
                        ? 'No jobs found. Create one to get started.'
                        : `No jobs in the "${phaseStyles[filter].label}" phase.`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((wo) => {
                    const phase = stageToPhase(wo.status);
                    const ps = phaseStyles[phase];
                    return (
                      <tr key={wo.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                        <td className="px-4 py-3 font-medium text-[#18181b]">
                          {wo.job_number}
                        </td>
                        <td className="px-4 py-3 text-[#60606a]">{wo.client_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#60606a]">{vehicleSummary(wo)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ps.bg} ${ps.text}`}>
                            {ps.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#60606a]">{wo.status?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#60606a]">{formatDate(wo.estimated_completion_date)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateWorkOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={() => {
          setShowCreateModal(false);
          fetchJobs();
        }}
      />
    </div>
  );
}

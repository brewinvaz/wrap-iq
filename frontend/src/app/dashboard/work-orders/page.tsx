'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

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

// --- Styling maps ---

const priorityStyles: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700' },
  low: { bg: 'bg-green-50', text: 'text-green-700' },
};

const jobTypeLabels: Record<string, string> = {
  commercial: 'Commercial',
  personal: 'Personal',
};

// --- Helper ---

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function vehicleSummary(vehicles: WorkOrder['vehicles']): string {
  if (vehicles.length === 0) return '—';
  return vehicles
    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown')
    .join(', ');
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] bg-[#f4f4f6] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
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

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchStages = useCallback(async () => {
    try {
      const data = await api.get<KanbanStageResponse[]>('/api/kanban-stages');
      setStages(data);
    } catch {
      // non-critical — tabs won't render but data still loads
    }
  }, []);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(page * limit), limit: String(limit) });
      if (activeStage) params.set('status_id', activeStage);
      const data = await api.get<WorkOrderListResponse>(`/api/work-orders?${params}`);
      setWorkOrders(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [page, activeStage]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Client-side search filter
  const filtered = search
    ? workOrders.filter(
        (wo) =>
          wo.job_number.toLowerCase().includes(search.toLowerCase()) ||
          (wo.client_name ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : workOrders;

  const totalPages = Math.ceil(total / limit);

  if (loading && workOrders.length === 0) return <LoadingSkeleton />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Work Orders</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {total} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by job # or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] px-3 text-sm text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        {/* Status tabs */}
        {stages.length > 0 && (
          <div className="mt-3 flex gap-1">
            <button
              onClick={() => { setActiveStage(null); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeStage === null ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => { setActiveStage(stage.id); setPage(0); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeStage === stage.id ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
                }`}
              >
                {stage.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={fetchWorkOrders} className="text-sm font-medium text-red-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 && !loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[#e6e6eb] bg-white">
            <p className="text-sm font-medium text-[#18181b]">No work orders found</p>
            <p className="mt-1 text-xs text-[#60606a]">
              {search ? 'Try a different search term' : 'Create your first work order to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Job #</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Value</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => {
                  const pStyle = priorityStyles[wo.priority] ?? priorityStyles.medium;
                  return (
                    <tr key={wo.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                      <td className="px-4 py-3 font-medium text-[#18181b]">{wo.job_number}</td>
                      <td className="px-4 py-3 text-[#60606a]">{wo.client_name ?? '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[#60606a]">{vehicleSummary(wo.vehicles)}</td>
                      <td className="px-4 py-3 text-[#60606a]">{jobTypeLabels[wo.job_type] ?? wo.job_type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pStyle.bg} ${pStyle.text}`}>
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {wo.status ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: `${wo.status.color}20`, color: wo.status.color }}
                          >
                            {wo.status.name}
                          </span>
                        ) : (
                          <span className="text-[#a8a8b4]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{wo.job_value ? formatCurrency(wo.job_value) : '—'}</td>
                      <td className="px-4 py-3 text-[#60606a]">{formatDate(wo.estimated_completion_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#60606a]">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

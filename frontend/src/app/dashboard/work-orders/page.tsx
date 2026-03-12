'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
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

// --- Styling maps ---

const priorityStyles: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400' },
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
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-app)] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
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

export default function WorkOrdersPage() {
  const searchParams = useSearchParams();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await api.get<WorkOrderListResponse>(`/api/work-orders?${params}`);
      setWorkOrders(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [page, activeStage, debouncedSearch]);

  // Sync search state when query param changes (e.g. from topbar search)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearch(q);
    setDebouncedSearch(q);
    setPage(0);
  }, [searchParams]);

  // Debounce local search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const totalPages = Math.ceil(total / limit);

  if (loading && workOrders.length === 0) return <LoadingSkeleton />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">Work Orders</h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {total} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by job # or client..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-9 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-app)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/40 focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
            />
            <Link
              href="/dashboard/work-orders/import"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Import CSV
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
            >
              + New Work Order
            </button>
          </div>
        </div>
        {/* Status tabs */}
        {stages.length > 0 && (
          <div className="mt-3 flex gap-1">
            <button
              onClick={() => { setActiveStage(null); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeStage === null ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              All
            </button>
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => { setActiveStage(stage.id); setPage(0); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeStage === stage.id ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
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
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={fetchWorkOrders} className="text-sm font-medium text-red-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {workOrders.length === 0 && !loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <p className="text-sm font-medium text-[var(--text-primary)]">No work orders found</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {search ? 'Try a different search term' : 'Create your first work order to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-app)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Job #</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Value</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Due</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => {
                  const pStyle = priorityStyles[wo.priority] ?? priorityStyles.medium;
                  return (
                    <tr key={wo.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="px-4 py-3 font-medium font-mono text-[var(--text-primary)]">{wo.job_number}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{wo.client_name ?? '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[var(--text-secondary)]">{vehicleSummary(wo.vehicles)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{jobTypeLabels[wo.job_type] ?? wo.job_type}</td>
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
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{wo.job_value ? formatCurrency(wo.job_value) : '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(wo.estimated_completion_date)}</td>
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
            <p className="text-xs text-[var(--text-secondary)]">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateWorkOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={() => { fetchWorkOrders(); }}
      />
    </div>
  );
}

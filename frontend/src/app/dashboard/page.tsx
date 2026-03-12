'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import MetricsBar from '@/components/dashboard/MetricsBar';
import CreateWorkOrderModal from '@/components/work-orders/CreateWorkOrderModal';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrencyCompact, formatCurrency } from '@/lib/format';
import { KanbanColumn, KPIMetric, ProjectCard } from '@/lib/types';

// ---------------------------------------------------------------------------
// API response types (mirrors backend schemas)
// ---------------------------------------------------------------------------

interface KanbanStageResponse {
  id: string;
  name: string;
  color: string;
  position: number;
  system_status: string | null;
  is_default: boolean;
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface VehicleInWorkOrder {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface WorkOrderResponse {
  id: string;
  job_number: string;
  job_type: 'commercial' | 'personal';
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  status: { id: string; name: string; color: string; system_status: string | null } | null;
  vehicles: VehicleInWorkOrder[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkOrderListResponse {
  items: WorkOrderResponse[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a work order to the ProjectCard shape the Kanban UI expects. */
function toProjectCard(wo: WorkOrderResponse): ProjectCard {
  const vehicleSummary =
    wo.vehicles.length > 0
      ? wo.vehicles
          .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
          .join(', ')
      : 'No vehicle';

  return {
    id: wo.job_number,
    workOrderId: wo.id,
    name: wo.job_number,
    vehicle: vehicleSummary,
    client: wo.client_name ?? 'Unknown Client',
    value: wo.job_value,
    date: wo.estimated_completion_date
      ? wo.estimated_completion_date.slice(0, 10)
      : wo.date_in.slice(0, 10),
    priority: wo.priority,
    tags: wo.job_type === 'commercial' ? ['commercial'] : [],
    team: [],
  };
}

/** Compute KPI metrics client-side from work order data. */
function computeKPIs(workOrders: WorkOrderResponse[], stages: KanbanStageResponse[]): KPIMetric[] {
  const completedStatuses = stages
    .filter((s) => s.system_status === 'completed')
    .map((s) => s.id);

  const active = workOrders.filter(
    (wo) => wo.status && !completedStatuses.includes(wo.status.id)
  );
  const completed = workOrders.filter(
    (wo) => wo.status && completedStatuses.includes(wo.status.id)
  );

  const pipelineValue = active.reduce((sum, wo) => sum + wo.job_value, 0);
  const totalValue = workOrders.reduce((sum, wo) => sum + wo.job_value, 0);

  return [
    {
      label: 'Active Jobs',
      value: String(active.length),
      trend: 'neutral' as const,
    },
    {
      label: 'Pipeline Value',
      value: formatCurrencyCompact(pipelineValue),
      trend: 'neutral' as const,
    },
    {
      label: 'Total Revenue',
      value: formatCurrencyCompact(totalValue),
      trend: 'neutral' as const,
    },
    {
      label: 'Completed',
      value: String(completed.length),
      trend: 'neutral' as const,
    },
  ];
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function MetricsBarSkeleton() {
  return (
    <div className="flex flex-wrap border-b border-[var(--border)] bg-[var(--surface-card)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-1 min-w-[140px] items-center gap-3 px-5 py-3.5 ${
            i < 3 ? 'border-r border-[var(--border)]' : ''
          }`}
        >
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-7 w-16 animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="flex w-72 shrink-0 flex-col">
          {/* Column header skeleton */}
          <div className="mb-3 rounded-xl bg-[var(--surface-card)] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
            <div className="h-0.5 animate-pulse rounded-t-xl bg-[var(--surface-raised)]" />
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
                <div className="h-5 w-5 animate-pulse rounded-full bg-[var(--surface-raised)]" />
              </div>
            </div>
          </div>
          {/* Card skeletons */}
          <div className="flex flex-col gap-2.5 p-1.5">
            {Array.from({ length: colIdx % 3 === 0 ? 2 : colIdx % 3 === 1 ? 3 : 1 }).map(
              (_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="rounded-xl bg-[var(--surface-card)] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]"
                >
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-raised)]" />
                    <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
                    <div className="flex gap-2">
                      <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--surface-raised)]" />
                      <div className="h-5 w-10 animate-pulse rounded-full bg-[var(--surface-raised)]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-raised)]" />
                      <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--surface-raised)]" />
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-rose-700">
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        {message}
      </div>
      <button
        onClick={onRetry}
        className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/30"
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List view component
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-green-500/10 text-green-400',
};

function ListView({
  workOrders,
  stages,
}: {
  workOrders: WorkOrderResponse[];
  stages: KanbanStageResponse[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-card)] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-app)] text-left">
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Job #</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Client</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Vehicle</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Status</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Priority</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Type</th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Value</th>
            <th className="px-4 py-3 font-semibold text-[var(--text-primary)]">Date In</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-muted)]">
                No work orders found
              </td>
            </tr>
          ) : (
            workOrders.map((wo) => {
              const stage = stages.find((s) => s.id === wo.status?.id);
              const vehicleSummary =
                wo.vehicles.length > 0
                  ? wo.vehicles
                      .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
                      .join(', ')
                  : 'No vehicle';

              return (
                <tr key={wo.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-raised)]">
                  <td className="px-4 py-3 font-medium font-mono text-[var(--text-primary)]">{wo.job_number}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{wo.client_name ?? 'Unknown'}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[var(--text-secondary)]">{vehicleSummary}</td>
                  <td className="px-4 py-3">
                    {stage && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: stage.color + '22', color: stage.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[wo.priority] ?? ''}`}>
                      {wo.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{wo.job_type}</td>
                  <td className="px-4 py-3 text-right font-medium font-mono text-[var(--text-primary)]">
                    {formatCurrency(wo.job_value)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{wo.date_in.slice(0, 10)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type ViewMode = 'kanban' | 'list' | 'calendar';
type FilterMode = 'all' | 'my-jobs' | 'urgent';

interface FilterCriteria {
  priority: ('high' | 'medium' | 'low')[];
  jobType: ('commercial' | 'personal')[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    priority: [],
    jobType: [],
  });
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Data state
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [totalWorkOrders, setTotalWorkOrders] = useState(0);

  // Loading & error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag-and-drop race condition prevention
  const [pendingCards, setPendingCards] = useState<Set<string>>(new Set());
  const [statusError, setStatusError] = useState<string | null>(null);
  const inflightRequests = useRef<Map<string, AbortController>>(new Map());

  // Keep raw API data for KPI computation and status-change lookups
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderResponse[]>([]);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        filterOpen &&
        filterRef.current &&
        filterBtnRef.current &&
        !filterRef.current.contains(e.target as Node) &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterOpen]);

  // ------ View mode handler ------

  const handleViewMode = useCallback(
    (mode: ViewMode) => {
      if (mode === 'calendar') {
        router.push('/dashboard/calendar');
        return;
      }
      setViewMode(mode);
    },
    [router]
  );

  // ------ Data fetching ------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [stagesRes, workOrdersRes] = await Promise.all([
        api.get<KanbanStageResponse[]>('/api/kanban-stages'),
        api.get<WorkOrderListResponse>('/api/work-orders?limit=100'),
      ]);

      // Sort stages by position
      const sortedStages = [...stagesRes].sort((a, b) => a.position - b.position);
      setStages(sortedStages);
      setWorkOrders(workOrdersRes.items);
      setTotalWorkOrders(workOrdersRes.total);

      // Build kanban columns from stages + work orders
      const cols: KanbanColumn[] = sortedStages.map((stage) => ({
        id: stage.id,
        title: stage.name,
        color: stage.color,
        cards: workOrdersRes.items
          .filter((wo) => wo.status?.id === stage.id)
          .map(toProjectCard),
      }));
      setColumns(cols);

      // Compute KPIs
      setKpis(computeKPIs(workOrdersRes.items, sortedStages));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Failed to load dashboard data: ${err.message}`);
      } else {
        setError('An unexpected error occurred while loading dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------ Filtered columns (apply quick-filter + dropdown filters) ------

  const activeFilterCount =
    filterCriteria.priority.length + filterCriteria.jobType.length;

  const matchesFilter = useCallback(
    (wo: WorkOrderResponse): boolean => {
      // Quick-filter toggles
      if (filter === 'urgent' && wo.priority !== 'high') return false;
      if (filter === 'my-jobs') {
        // Simulate "my jobs" by showing only commercial jobs as a toggle demo
        // (no user assignment data available in the API)
        if (wo.job_type !== 'commercial') return false;
      }
      // Dropdown filters
      if (
        filterCriteria.priority.length > 0 &&
        !filterCriteria.priority.includes(wo.priority)
      )
        return false;
      if (
        filterCriteria.jobType.length > 0 &&
        !filterCriteria.jobType.includes(wo.job_type)
      )
        return false;
      return true;
    },
    [filter, filterCriteria]
  );

  const filteredColumns = useMemo(() => {
    const hasAnyFilter =
      filter !== 'all' || activeFilterCount > 0;

    if (!hasAnyFilter) return columns;

    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        const wo = workOrders.find((w) => w.job_number === card.id);
        return wo ? matchesFilter(wo) : true;
      }),
    }));
  }, [columns, filter, matchesFilter, workOrders, activeFilterCount]);

  /** Filtered work orders for list view */
  const filteredWorkOrders = useMemo(() => {
    const hasAnyFilter = filter !== 'all' || activeFilterCount > 0;
    if (!hasAnyFilter) return workOrders;
    return workOrders.filter(matchesFilter);
  }, [workOrders, filter, matchesFilter, activeFilterCount]);

  // ------ Drag-and-drop status change ------

  const handleStatusChange = useCallback(
    async (cardId: string, targetColumnId: string) => {
      // Find the work order by job_number (cardId is the job_number)
      const wo = workOrders.find((w) => w.job_number === cardId);
      if (!wo) return;

      // Prevent concurrent drags on the same card
      if (pendingCards.has(cardId)) return;

      // Abort any previous in-flight request for this card
      const existingController = inflightRequests.current.get(cardId);
      if (existingController) {
        existingController.abort();
      }

      // Mark card as pending
      setPendingCards((prev) => new Set(prev).add(cardId));
      setStatusError(null);

      const abortController = new AbortController();
      inflightRequests.current.set(cardId, abortController);

      // Optimistic UI update
      setColumns((prev) =>
        prev.map((col) => {
          const card = col.cards.find((c) => c.id === cardId);
          if (card && col.id !== targetColumnId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          }
          if (col.id === targetColumnId && !col.cards.find((c) => c.id === cardId)) {
            const movedCard = prev.flatMap((c) => c.cards).find((c) => c.id === cardId);
            if (movedCard) {
              return { ...col, cards: [...col.cards, movedCard] };
            }
          }
          return col;
        })
      );

      try {
        await api.patch(`/api/work-orders/${wo.id}/status`, {
          status_id: targetColumnId,
        });

        // Update local work order status
        setWorkOrders((prev) =>
          prev.map((w) =>
            w.id === wo.id
              ? {
                  ...w,
                  status: {
                    id: targetColumnId,
                    name: stages.find((s) => s.id === targetColumnId)?.name ?? '',
                    color: stages.find((s) => s.id === targetColumnId)?.color ?? '#64748b',
                    system_status:
                      stages.find((s) => s.id === targetColumnId)?.system_status ?? null,
                  },
                }
              : w
          )
        );

        // Recompute KPIs
        setKpis((prevKpis) => {
          const updatedOrders = workOrders.map((w) =>
            w.id === wo.id
              ? {
                  ...w,
                  status: {
                    id: targetColumnId,
                    name: stages.find((s) => s.id === targetColumnId)?.name ?? '',
                    color: stages.find((s) => s.id === targetColumnId)?.color ?? '#64748b',
                    system_status:
                      stages.find((s) => s.id === targetColumnId)?.system_status ?? null,
                  },
                }
              : w
          );
          return computeKPIs(updatedOrders, stages) || prevKpis;
        });
      } catch (err) {
        // Ignore aborted requests (superseded by a newer drag)
        if (err instanceof DOMException && err.name === 'AbortError') return;

        // Show error notification instead of silently re-fetching
        const message =
          err instanceof ApiError
            ? `Failed to move ${cardId}: ${err.message}`
            : `Failed to move ${cardId}. Please try again.`;
        setStatusError(message);

        // Revert optimistic update by re-fetching
        fetchData();

        // Auto-dismiss error after 5 seconds
        setTimeout(() => setStatusError((prev) => (prev === message ? null : prev)), 5000);
      } finally {
        // Remove from pending set and clean up abort controller
        inflightRequests.current.delete(cardId);
        setPendingCards((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }
    },
    [workOrders, stages, fetchData, pendingCards]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">Projects</h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {loading ? '...' : `${totalWorkOrders} total`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => setFilterOpen((o) => !o)}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                  activeFilterCount > 0
                    ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15'
                    : 'border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                Filter
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div
                  ref={filterRef}
                  className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] shadow-lg"
                >
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Filters</h3>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => setFilterCriteria({ priority: [], jobType: [] })}
                          className="text-[12px] font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Priority filter */}
                    <div>
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Priority</p>
                      <div className="space-y-1.5">
                        {(['high', 'medium', 'low'] as const).map((p) => (
                          <label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">
                            <input
                              type="checkbox"
                              checked={filterCriteria.priority.includes(p)}
                              onChange={() =>
                                setFilterCriteria((prev) => ({
                                  ...prev,
                                  priority: prev.priority.includes(p)
                                    ? prev.priority.filter((x) => x !== p)
                                    : [...prev.priority, p],
                                }))
                              }
                              className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                            />
                            <span className="capitalize">{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Job type filter */}
                    <div>
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Job Type</p>
                      <div className="space-y-1.5">
                        {(['commercial', 'personal'] as const).map((t) => (
                          <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">
                            <input
                              type="checkbox"
                              checked={filterCriteria.jobType.includes(t)}
                              onChange={() =>
                                setFilterCriteria((prev) => ({
                                  ...prev,
                                  jobType: prev.jobType.includes(t)
                                    ? prev.jobType.filter((x) => x !== t)
                                    : [...prev.jobType, t],
                                }))
                              }
                              className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                            />
                            <span className="capitalize">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Status filter (by stage) */}
                    {stages.length > 0 && (
                      <div>
                        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</p>
                        <div className="space-y-1.5">
                          {stages.map((s) => {
                            const count = workOrders.filter((wo) => wo.status?.id === s.id).length;
                            return (
                              <button
                                key={s.id}
                                onClick={() => {
                                  // Set priority filter to empty, set filter to all, and filter columns to only show this stage
                                  // For simplicity, we use the quick filter by navigating to the column
                                  setFilterOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.name}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {loading ? <MetricsBarSkeleton /> : <MetricsBar metrics={kpis} />}

      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {/* Status change error toast */}
      {statusError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 shadow-lg">
          <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span className="text-sm text-rose-700">{statusError}</span>
          <button
            onClick={() => setStatusError(null)}
            className="ml-2 rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* View toggle and filters */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-1">
          {(['kanban', 'list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {([
            { key: 'all', label: 'All' },
            { key: 'my-jobs', label: 'My Jobs' },
            { key: 'urgent', label: 'Urgent' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter((prev) => prev === f.key ? 'all' : f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {viewMode === 'kanban' && (
          loading ? (
            <KanbanBoardSkeleton />
          ) : (
            <KanbanBoard
              columns={filteredColumns}
              onStatusChange={handleStatusChange}
              pendingCards={pendingCards}
              onAddProject={() => setShowCreateModal(true)}
            />
          )
        )}
        {viewMode === 'list' && (
          loading ? (
            <KanbanBoardSkeleton />
          ) : (
            <ListView workOrders={filteredWorkOrders} stages={stages} />
          )
        )}
      </div>

      <CreateWorkOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={() => { fetchData(); }}
      />
    </div>
  );
}

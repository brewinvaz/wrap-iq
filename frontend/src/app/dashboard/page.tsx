'use client';

import { useState, useEffect, useCallback } from 'react';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import MetricsBar from '@/components/dashboard/MetricsBar';
import { api, ApiError } from '@/lib/api-client';
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

  const formatCurrency = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toLocaleString()}`;
  };

  return [
    {
      label: 'Active Jobs',
      value: String(active.length),
      trend: 'neutral' as const,
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(pipelineValue),
      trend: 'neutral' as const,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalValue),
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
    <div className="flex flex-wrap border-b border-[#e6e6eb] bg-white">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-1 min-w-[140px] items-center gap-3 px-5 py-3.5 ${
            i < 3 ? 'border-r border-[#e6e6eb]' : ''
          }`}
        >
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-7 w-16 animate-pulse rounded bg-gray-200" />
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
          <div className="mb-3 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,.06)]">
            <div className="h-0.5 animate-pulse rounded-t-xl bg-gray-200" />
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-5 animate-pulse rounded-full bg-gray-100" />
              </div>
            </div>
          </div>
          {/* Card skeletons */}
          <div className="flex flex-col gap-2.5 p-1.5">
            {Array.from({ length: colIdx % 3 === 0 ? 2 : colIdx % 3 === 1 ? 3 : 1 }).map(
              (_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]"
                >
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                    <div className="flex gap-2">
                      <div className="h-5 w-14 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-5 w-10 animate-pulse rounded-full bg-gray-100" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                      <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200" />
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
    <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
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
        className="rounded-md bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-200"
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type ViewMode = 'kanban' | 'list' | 'calendar';
type FilterMode = 'all' | 'my-jobs' | 'urgent';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filter, setFilter] = useState<FilterMode>('all');

  // Data state
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [totalWorkOrders, setTotalWorkOrders] = useState(0);

  // Loading & error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep raw API data for KPI computation and status-change lookups
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderResponse[]>([]);

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

  // ------ Drag-and-drop status change ------

  const handleStatusChange = useCallback(
    async (cardId: string, targetColumnId: string) => {
      // Find the work order by job_number (cardId is the job_number)
      const wo = workOrders.find((w) => w.job_number === cardId);
      if (!wo) return;

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
      } catch {
        // Revert optimistic update by re-fetching
        fetchData();
      }
    },
    [workOrders, stages, fetchData]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Projects</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {loading ? '...' : `${totalWorkOrders} total`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-[#e6e6eb] bg-white px-3.5 py-2 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filter
            </button>
            <button className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {loading ? <MetricsBarSkeleton /> : <MetricsBar metrics={kpis} />}

      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {/* View toggle and filters */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-[#e6e6eb] bg-white p-1">
          {(['kanban', 'list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-[#60606a] hover:bg-gray-50'
              } ${mode !== 'kanban' ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={mode !== 'kanban'}
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
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[#18181b] text-white'
                  : 'bg-white text-[#60606a] border border-[#e6e6eb] hover:bg-gray-50'
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
            <KanbanBoard columns={columns} onStatusChange={handleStatusChange} />
          )
        )}
        {viewMode === 'list' && (
          <div className="flex items-center justify-center py-20 text-sm text-[#a8a8b4]">
            List view coming soon
          </div>
        )}
        {viewMode === 'calendar' && (
          <div className="flex items-center justify-center py-20 text-sm text-[#a8a8b4]">
            Calendar view coming soon
          </div>
        )}
      </div>
    </div>
  );
}

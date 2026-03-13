'use client';

import { useState, useEffect, useMemo } from 'react';
import { Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { api, ApiError } from '@/lib/api-client';

type FilterTab = 'all' | 'in_design' | 'in_revision' | 'proof_sent' | 'approved';

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

interface DesignQueueItem {
  id: string;
  jobNumber: string;
  clientName: string;
  vehicle: string;
  priority: 'high' | 'medium' | 'low';
  dateIn: string;
  dueDate: string | null;
  status: string;
  statusColor: string;
  phase: FilterTab;
}

function deriveDesignPhase(wo: ApiWorkOrder): FilterTab {
  const statusName = wo.status?.name?.toLowerCase() ?? '';
  if (statusName.includes('proof') && statusName.includes('sent')) return 'proof_sent';
  if (statusName.includes('approv')) return 'approved';
  if (statusName.includes('revis')) return 'in_revision';
  if (statusName.includes('design') || statusName.includes('art')) return 'in_design';
  // Default: treat lead/in-progress as in_design
  const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';
  if (systemStatus === 'lead' || systemStatus === 'in_progress') return 'in_design';
  return 'approved';
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '—';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function toDesignItem(wo: ApiWorkOrder): DesignQueueItem {
  return {
    id: wo.id,
    jobNumber: wo.job_number,
    clientName: wo.client_name ?? '—',
    vehicle: vehicleLabel(wo.vehicles),
    priority: (wo.priority as 'high' | 'medium' | 'low') || 'medium',
    dateIn: wo.date_in,
    dueDate: wo.estimated_completion_date,
    status: wo.status?.name ?? 'Unknown',
    statusColor: wo.status?.color ?? '#6b7280',
    phase: deriveDesignPhase(wo),
  };
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_design', label: 'In Design' },
  { key: 'in_revision', label: 'Revision' },
  { key: 'proof_sent', label: 'Proof Sent' },
  { key: 'approved', label: 'Approved' },
];

const priorityBadge: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-rose-500/20', text: 'text-rose-700 dark:text-rose-400' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

const designQueueColumns: Column<DesignQueueItem>[] = [
  {
    key: 'jobNumber',
    header: 'Job #',
    className: 'font-mono font-medium text-[var(--text-primary)]',
    render: (item) => item.jobNumber,
  },
  {
    key: 'client',
    header: 'Client',
    className: 'text-[var(--text-secondary)]',
    render: (item) => item.clientName,
  },
  {
    key: 'vehicle',
    header: 'Vehicle',
    className: 'text-[var(--text-secondary)]',
    render: (item) => item.vehicle,
  },
  {
    key: 'priority',
    header: 'Priority',
    render: (item) => {
      const pb = priorityBadge[item.priority] ?? priorityBadge.medium;
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pb.bg} ${pb.text}`}>
          {item.priority}
        </span>
      );
    },
  },
  {
    key: 'dateIn',
    header: 'Date In',
    className: 'font-mono text-[var(--text-secondary)]',
    render: (item) => formatDate(item.dateIn),
  },
  {
    key: 'due',
    header: 'Due',
    render: (item) => (
      <span className={`font-mono ${isOverdue(item.dueDate) ? 'font-medium text-rose-400' : 'text-[var(--text-secondary)]'}`}>
        {formatDate(item.dueDate)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => (
      <span
        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${item.statusColor}20`, color: item.statusColor }}
      >
        {item.status}
      </span>
    ),
  },
];

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-overlay)]" />
        <div className="mt-1 h-3 w-64 animate-pulse rounded bg-[var(--surface-raised)]" />
      </header>
      <div className="flex gap-2 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-3 h-14 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        ))}
      </div>
    </div>
  );
}

export default function DesignQueuePage() {
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
        if (!cancelled) {
          // Filter to non-completed/cancelled work orders for the design queue
          const active = (resp?.items ?? []).filter((wo) => {
            const s = wo.status?.system_status?.toLowerCase() ?? '';
            return s !== 'completed' && s !== 'cancelled';
          });
          setWorkOrders(active);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load design queue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const items = useMemo(() => workOrders.map(toDesignItem), [workOrders]);

  const filtered = useMemo(
    () => (activeTab === 'all' ? items : items.filter((i) => i.phase === activeTab)),
    [items, activeTab],
  );

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: items.length, in_design: 0, in_revision: 0, proof_sent: 0, approved: 0 };
    items.forEach((i) => { c[i.phase]++; });
    return c;
  }, [items]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load design queue</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Design Queue</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Track design progress across all active jobs
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="rounded-full bg-[var(--phase-design)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--phase-design)]">
              {items.length} jobs
            </span>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 opacity-60">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Paintbrush className="mb-3 h-10 w-10 text-[var(--text-muted)]" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No items in this view</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Design queue items will appear here as jobs come in.</p>
          </div>
        ) : (
          <DataTable
            columns={designQueueColumns}
            data={filtered}
            rowKey={(item) => item.id}
            stickyHeader
          />
        )}
      </div>
    </div>
  );
}

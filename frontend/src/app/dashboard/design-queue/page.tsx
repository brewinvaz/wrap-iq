'use client';

import { useState, useEffect, useMemo } from 'react';
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

const priorityStyles: Record<string, string> = {
  high: 'text-rose-600 font-medium',
  medium: 'text-[#60606a]',
  low: 'text-[#a8a8b4]',
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

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-1 h-3 w-64 animate-pulse rounded bg-gray-100" />
      </header>
      <div className="flex gap-2 border-b border-[#e6e6eb] bg-white px-6 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-3 h-14 animate-pulse rounded-lg bg-gray-100" />
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
        <p className="text-sm font-medium text-[#18181b]">Failed to load design queue</p>
        <p className="text-xs text-[#60606a]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#18181b]">Design Queue</h1>
            <p className="mt-0.5 text-xs text-[#a8a8b4]">
              Track design progress across all active jobs
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#60606a]">
            <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700">
              {items.length} jobs
            </span>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#e6e6eb] bg-white px-6 py-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#18181b] text-white'
                : 'text-[#60606a] hover:bg-gray-50'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 opacity-60">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <svg className="mb-3 h-10 w-10 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            <p className="text-sm font-medium text-[#60606a]">No items in this view</p>
            <p className="mt-1 text-xs text-[#a8a8b4]">Design queue items will appear here as jobs come in.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#fafafa]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#a8a8b4]">
                <th className="px-6 py-2.5 font-medium">Job #</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Vehicle</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Date In</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f5]">
              {filtered.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-[#fafafa]">
                  <td className="px-6 py-3 text-sm font-medium text-[#18181b]">
                    {item.jobNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#60606a]">{item.clientName}</td>
                  <td className="px-4 py-3 text-sm text-[#60606a]">{item.vehicle}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium capitalize ${priorityStyles[item.priority] ?? ''}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#60606a]">{formatDate(item.dateIn)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${isOverdue(item.dueDate) ? 'font-medium text-rose-600' : 'text-[#60606a]'}`}>
                      {formatDate(item.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${item.statusColor}15`,
                        color: item.statusColor,
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

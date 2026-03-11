'use client';

import { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';

type ViewMode = 'list' | 'week';
type FilterTab = 'all' | 'upcoming' | 'in_progress' | 'completed';

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

interface InstallItem {
  id: string;
  jobNumber: string;
  clientName: string;
  vehicle: string;
  priority: 'high' | 'medium' | 'low';
  dateIn: string;
  dueDate: string | null;
  completionDate: string | null;
  status: string;
  statusColor: string;
  systemStatus: string;
  phase: FilterTab;
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '—';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function deriveInstallPhase(wo: ApiWorkOrder): FilterTab {
  const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';
  if (systemStatus === 'completed') return 'completed';
  if (systemStatus === 'in_progress') return 'in_progress';
  return 'upcoming';
}

function toInstallItem(wo: ApiWorkOrder): InstallItem {
  return {
    id: wo.id,
    jobNumber: wo.job_number,
    clientName: wo.client_name ?? '—',
    vehicle: vehicleLabel(wo.vehicles),
    priority: (wo.priority as 'high' | 'medium' | 'low') || 'medium',
    dateIn: wo.date_in,
    dueDate: wo.estimated_completion_date,
    completionDate: wo.completion_date,
    status: wo.status?.name ?? 'Unknown',
    statusColor: wo.status?.color ?? '#6b7280',
    systemStatus: wo.status?.system_status ?? '',
    phase: deriveInstallPhase(wo),
  };
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const priorityBadge: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-rose-50', text: 'text-rose-700' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isOverdue(dueDate: string | null, completionDate: string | null): boolean {
  if (completionDate || !dueDate) return false;
  return new Date(dueDate) < new Date();
}

function getWeekDays(): { label: string; date: string; dayName: string }[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: d.toISOString().slice(0, 10),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return days;
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-1 h-3 w-64 animate-pulse rounded bg-gray-100" />
      </header>
      <div className="flex gap-2 border-b border-[#e6e6eb] bg-white px-6 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-gray-200" />
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

// --- Week view ---
function WeekView({ items }: { items: InstallItem[] }) {
  const weekDays = useMemo(() => getWeekDays(), []);
  const today = new Date().toISOString().slice(0, 10);

  const itemsByDay = useMemo(() => {
    const map: Record<string, InstallItem[]> = {};
    weekDays.forEach((d) => { map[d.date] = []; });
    items.forEach((item) => {
      const dueDate = item.dueDate?.slice(0, 10);
      if (dueDate && map[dueDate]) {
        map[dueDate].push(item);
      }
    });
    return map;
  }, [items, weekDays]);

  return (
    <div className="grid h-full grid-cols-7 divide-x divide-[#e6e6eb]">
      {weekDays.map((day) => (
        <div key={day.date} className="flex flex-col">
          <div className={`border-b border-[#e6e6eb] px-3 py-2 text-center ${day.date === today ? 'bg-blue-50' : 'bg-[#fafafa]'}`}>
            <div className="text-[10px] uppercase tracking-wider text-[#a8a8b4]">{day.dayName}</div>
            <div className={`text-sm font-medium ${day.date === today ? 'text-blue-600' : 'text-[#18181b]'}`}>
              {day.label}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {(itemsByDay[day.date] ?? []).map((item) => {
              const pb = priorityBadge[item.priority] ?? priorityBadge.medium;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#e6e6eb] bg-white p-2 shadow-sm"
                >
                  <div className="text-xs font-medium text-[#18181b]">{item.jobNumber}</div>
                  <div className="mt-0.5 text-[10px] text-[#60606a] truncate">{item.clientName}</div>
                  <div className="mt-0.5 text-[10px] text-[#a8a8b4] truncate">{item.vehicle}</div>
                  <div className="mt-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${pb.bg} ${pb.text}`}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              );
            })}
            {(itemsByDay[day.date] ?? []).length === 0 && (
              <div className="flex h-full items-center justify-center">
                <span className="text-[10px] text-[#a8a8b4]">No installs</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstallSchedulePage() {
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
        if (!cancelled) setWorkOrders(resp?.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load install schedule');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const items = useMemo(() => workOrders.map(toInstallItem), [workOrders]);

  const filtered = useMemo(
    () => (activeTab === 'all' ? items : items.filter((i) => i.phase === activeTab)),
    [items, activeTab],
  );

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: items.length, upcoming: 0, in_progress: 0, completed: 0 };
    items.forEach((i) => { c[i.phase]++; });
    return c;
  }, [items]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[#18181b]">Failed to load install schedule</p>
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
            <h1 className="text-xl font-bold text-[#18181b]">Install Schedule</h1>
            <p className="mt-0.5 text-xs text-[#a8a8b4]">
              Manage and track installation appointments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#e6e6eb] bg-white p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-[#18181b] text-white' : 'text-[#60606a] hover:bg-gray-50'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'week' ? 'bg-[#18181b] text-white' : 'text-[#60606a] hover:bg-gray-50'
                }`}
              >
                Week
              </button>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {items.length} installs
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'week' ? (
          <WeekView items={filtered} />
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <svg className="mb-3 h-10 w-10 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p className="text-sm font-medium text-[#60606a]">No installs scheduled</p>
            <p className="mt-1 text-xs text-[#a8a8b4]">Installations will appear here as jobs are scheduled.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#fafafa]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#a8a8b4]">
                <th className="px-6 py-2.5 font-medium">Job #</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Vehicle</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Scheduled</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f5]">
              {filtered.map((item) => {
                const pb = priorityBadge[item.priority] ?? priorityBadge.medium;
                const overdue = isOverdue(item.dueDate, item.completionDate);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafafa]">
                    <td className="px-6 py-3 text-sm font-medium text-[#18181b]">
                      {item.jobNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#60606a]">{item.clientName}</td>
                    <td className="px-4 py-3 text-sm text-[#60606a]">{item.vehicle}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pb.bg} ${pb.text}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#60606a]">{formatDate(item.dateIn)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${overdue ? 'font-medium text-rose-600' : 'text-[#60606a]'}`}>
                        {formatDate(item.dueDate)}
                        {overdue && <span className="ml-1 text-[10px]">OVERDUE</span>}
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

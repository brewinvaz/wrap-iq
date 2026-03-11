'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';

// --- API response types (matches backend WorkOrderResponse) ---

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

// --- Schedule block derived from a work order ---

interface ScheduleBlock {
  id: string;
  jobName: string;
  client: string;
  phase: 'design' | 'production' | 'install';
  priority: 'high' | 'medium' | 'low';
  jobNumber: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Returns the Monday of the week containing the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Build an array of 5 weekday dates (Mon-Fri) offset by `weekOffset` weeks.
 */
function getWeekDays(weekOffset: number): { label: string; dateKey: string }[] {
  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayName = DAY_NAMES[d.getDay()];
    const month = d.getMonth() + 1;
    const date = d.getDate();
    // dateKey is YYYY-MM-DD for matching against estimated_completion_date
    const dateKey = `${d.getFullYear()}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return {
      label: `${dayName} ${month}/${date}`,
      dateKey,
    };
  });
}

/**
 * Map a kanban stage name to a phase for color-coding.
 */
function stageToPhase(status: KanbanStageResponse | null): ScheduleBlock['phase'] {
  if (!status) return 'production';
  const name = status.system_status?.toLowerCase() ?? status.name.toLowerCase();
  if (name.includes('design') || name.includes('proof') || name.includes('artwork')) return 'design';
  if (name.includes('install') || name.includes('complete') || name.includes('done')) return 'install';
  return 'production';
}

/**
 * Build a vehicle summary string for the job name.
 */
function vehicleSummary(vehicles: WorkOrder['vehicles']): string {
  if (vehicles.length === 0) return '';
  return vehicles
    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle')
    .join(', ');
}

const phaseColors: Record<ScheduleBlock['phase'], string> = {
  design: 'border-l-violet-500 bg-violet-50/50',
  production: 'border-l-amber-500 bg-amber-50/50',
  install: 'border-l-emerald-500 bg-emerald-50/50',
};

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col}>
          <div className="mb-3 h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, row) => (
              <div key={row} className="h-20 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekLabel =
    weekOffset === 0
      ? 'This Week'
      : weekOffset > 0
        ? `+${weekOffset} week${weekOffset > 1 ? 's' : ''}`
        : `${weekOffset} week${weekOffset < -1 ? 's' : ''}`;

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch a large page to capture all work orders for the visible week.
      // The backend does not support date-range filtering, so we fetch broadly
      // and filter client-side by estimated_completion_date.
      const data = await api.get<WorkOrderListResponse>('/api/work-orders?limit=100');
      setWorkOrders(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Group work orders by estimated_completion_date into the week columns
  const scheduleData = useMemo(() => {
    const dateSet = new Set(weekDays.map((d) => d.dateKey));
    const grouped: Record<string, ScheduleBlock[]> = {};

    for (const day of weekDays) {
      grouped[day.dateKey] = [];
    }

    for (const wo of workOrders) {
      if (!wo.estimated_completion_date) continue;
      // estimated_completion_date is ISO date string; take the date portion
      const dateStr = wo.estimated_completion_date.slice(0, 10);
      if (!dateSet.has(dateStr)) continue;

      const vehicle = vehicleSummary(wo.vehicles);
      const jobName = vehicle ? `${vehicle} — ${wo.job_type}` : wo.job_number;

      grouped[dateStr].push({
        id: wo.id,
        jobName,
        client: wo.client_name ?? 'No client',
        phase: stageToPhase(wo.status),
        priority: wo.priority,
        jobNumber: wo.job_number,
      });
    }

    return grouped;
  }, [workOrders, weekDays]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Schedule</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {weekLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={fetchWorkOrders}
              className="ml-2 font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {weekDays.map((day) => (
              <div key={day.dateKey}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#a8a8b4]">
                  {day.label}
                </h3>
                <div className="space-y-2">
                  {(scheduleData[day.dateKey] ?? []).map((block) => (
                    <div
                      key={block.id}
                      className={`rounded-lg border-l-[3px] p-3 ${phaseColors[block.phase]}`}
                    >
                      <p className="text-xs font-semibold text-[#18181b]">{block.jobName}</p>
                      <p className="mt-0.5 text-[11px] text-[#60606a]">{block.client}</p>
                      <p className="mt-1 text-[10px] text-[#a8a8b4]">{block.jobNumber}</p>
                    </div>
                  ))}
                  {!(scheduleData[day.dateKey]?.length) && (
                    <div className="rounded-lg border border-dashed border-[#e6e6eb] p-4 text-center text-xs text-[#a8a8b4]">
                      No jobs scheduled
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

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

interface ScheduleBlock {
  id: string;
  jobName: string;
  client: string;
  vehicle: string;
  priority: string;
  phase: 'design' | 'production' | 'install';
  statusName: string;
  statusColor: string;
  scheduledDate: string; // YYYY-MM-DD
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
 * Build an array of 5 weekday labels (Mon-Fri) offset by `weekOffset` weeks
 * from the current week. Each entry contains the label string and a date key
 * (YYYY-MM-DD) used to look up schedule data.
 */
function getWeekDays(weekOffset: number): { label: string; key: string }[] {
  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayName = DAY_NAMES[d.getDay()];
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const yyyy = d.getFullYear();
    const mm = String(month).padStart(2, '0');
    const dd = String(date).padStart(2, '0');
    return {
      label: `${dayName} ${month}/${date}`,
      key: `${yyyy}-${mm}-${dd}`,
    };
  });
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '';
}

function derivePhase(wo: ApiWorkOrder): ScheduleBlock['phase'] {
  const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';
  if (systemStatus === 'completed' || systemStatus === 'in_progress') return 'install';
  // Use job_type to infer phase when possible
  const jobType = wo.job_type?.toLowerCase() ?? '';
  if (jobType.includes('design')) return 'design';
  if (jobType.includes('print') || jobType.includes('production')) return 'production';
  return 'install';
}

function toScheduleBlock(wo: ApiWorkOrder): ScheduleBlock | null {
  // Use estimated_completion_date as the scheduled date; fall back to date_in
  const dateStr = wo.estimated_completion_date ?? wo.date_in;
  if (!dateStr) return null;
  const scheduledDate = dateStr.slice(0, 10); // YYYY-MM-DD

  const vehicle = vehicleLabel(wo.vehicles);
  const jobName = [wo.job_number, wo.job_type].filter(Boolean).join(' — ');

  return {
    id: wo.id,
    jobName,
    client: wo.client_name ?? '—',
    vehicle,
    priority: wo.priority ?? 'medium',
    phase: derivePhase(wo),
    statusName: wo.status?.name ?? 'Unknown',
    statusColor: wo.status?.color ?? '#6b7280',
    scheduledDate,
  };
}

const phaseColors: Record<ScheduleBlock['phase'], string> = {
  design: 'border-l-violet-500 bg-violet-500/10',
  production: 'border-l-amber-500 bg-amber-500/10',
  install: 'border-l-emerald-500 bg-emerald-500/10',
};

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-app)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col}>
              <div className="mb-3 h-4 w-16 animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, row) => (
                  <div key={row} className="h-20 animate-pulse rounded-lg bg-[var(--surface-app)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekLabel =
    weekOffset === 0
      ? 'This Week'
      : weekOffset > 0
        ? `+${weekOffset} week${weekOffset > 1 ? 's' : ''}`
        : `${weekOffset} week${weekOffset < -1 ? 's' : ''}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
        if (!cancelled) setWorkOrders(resp?.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load schedule');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleBlocks = useMemo(
    () => workOrders.map(toScheduleBlock).filter((b): b is ScheduleBlock => b !== null),
    [workOrders],
  );

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const scheduleData = useMemo(() => {
    const data: Record<string, ScheduleBlock[]> = {};
    weekDays.forEach((day) => {
      data[day.key] = [];
    });
    scheduleBlocks.forEach((block) => {
      if (data[block.scheduledDate]) {
        data[block.scheduledDate].push(block);
      }
    });
    return data;
  }, [weekDays, scheduleBlocks]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load schedule</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Schedule</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {weekLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
              ← Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
              Next →
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-4">
          {weekDays.map((day) => (
            <div key={day.key}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {day.label}
              </h3>
              <div className="space-y-2">
                {(scheduleData[day.key] ?? []).map((block) => (
                  <div
                    key={block.id}
                    className={`rounded-lg border-l-[3px] p-3 ${phaseColors[block.phase]}`}
                  >
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{block.jobName}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{block.client}</p>
                    {block.vehicle && (
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{block.vehicle}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          backgroundColor: `${block.statusColor}15`,
                          color: block.statusColor,
                        }}
                      >
                        {block.statusName}
                      </span>
                    </div>
                  </div>
                ))}
                {!(scheduleData[day.key]?.length) && (
                  <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-muted)]">
                    No jobs scheduled
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

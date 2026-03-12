'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface ApiChecklistItem {
  label: string;
  done: boolean;
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
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  checklist: ApiChecklistItem[] | null;
  status: { id: string; name: string; color: string; system_status: string | null } | null;
  vehicles: ApiVehicle[];
  client_name: string | null;
}

interface ApiWorkOrderListResponse {
  items: ApiWorkOrder[];
  total: number;
}

type ChecklistStatus = 'in-progress' | 'completed' | 'not-started';

const STATUS_STYLES: Record<ChecklistStatus, { bg: string; text: string; label: string }> = {
  'in-progress': { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'In Progress' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Completed' },
  'not-started': { bg: 'bg-[var(--surface-raised)]', text: 'text-[var(--text-muted)]', label: 'Not Started' },
};

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (vehicles.length === 0) return 'No vehicle';
  return vehicles
    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
    .join(', ');
}

function deriveStatus(items: ApiChecklistItem[]): ChecklistStatus {
  if (items.length === 0) return 'not-started';
  const allDone = items.every((i) => i.done);
  const someDone = items.some((i) => i.done);
  if (allDone) return 'completed';
  if (someDone) return 'in-progress';
  return 'not-started';
}

export default function ChecklistsPage() {
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkOrders = useCallback(async () => {
    try {
      const data = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
      setWorkOrders(data.items.filter((wo) => wo.checklist && wo.checklist.length > 0));
    } catch {
      setError('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  async function toggleItem(workOrderId: string, itemIndex: number) {
    const wo = workOrders.find((w) => w.id === workOrderId);
    if (!wo || !wo.checklist) return;

    const updatedChecklist = wo.checklist.map((item, idx) =>
      idx === itemIndex ? { ...item, done: !item.done } : item,
    );

    // Optimistic update
    setWorkOrders((prev) =>
      prev.map((w) => (w.id === workOrderId ? { ...w, checklist: updatedChecklist } : w)),
    );

    try {
      await api.patch(`/api/work-orders/${workOrderId}`, { checklist: updatedChecklist });
    } catch {
      setWorkOrders((prev) =>
        prev.map((w) => (w.id === workOrderId ? { ...w, checklist: wo.checklist } : w)),
      );
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">Loading checklists…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Installation Checklists
            </h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
              {workOrders.length} jobs
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {workOrders.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">No jobs with checklists found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workOrders.map((wo) => {
              const items = wo.checklist ?? [];
              const completed = items.filter((i) => i.done).length;
              const total = items.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const status = deriveStatus(items);
              const style = STATUS_STYLES[status];
              const dateLabel = wo.estimated_completion_date
                ? new Date(wo.estimated_completion_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No date';

              return (
                <div
                  key={wo.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]"
                >
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {wo.client_name ?? 'Unknown Client'} — #{wo.job_number}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {vehicleLabel(wo.vehicles)} &middot; {dateLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                          {pct}%
                        </p>
                        <p className="font-mono text-[10px] text-[var(--text-secondary)]">
                          {completed}/{total} done
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)]">
                    {items.map((item, idx) => (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-overlay)] ${
                          idx < items.length - 1 ? 'border-b border-[var(--border)]' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleItem(wo.id, idx)}
                          className="h-4 w-4 shrink-0 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className={`text-sm ${
                            item.done
                              ? 'text-[var(--text-secondary)] line-through'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

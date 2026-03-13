'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import LogTimeModal from '@/components/time-logs/LogTimeModal';

// --- API response types ---

interface KanbanStageResponse {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface VehicleInWorkOrder {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface WorkOrderDetail {
  id: string;
  job_number: string;
  job_type: 'commercial' | 'personal';
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  checklist: ChecklistItem[] | null;
  status_timestamps: Record<string, string> | null;
  status: KanbanStageResponse | null;
  vehicles: VehicleInWorkOrder[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  photo_type: string | null;
  caption: string | null;
  url: string;
  created_at: string;
}

interface TimeLogUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface TimeLogWorkOrder {
  id: string;
  job_number: string;
}

interface TimeLogEntry {
  id: string;
  user: TimeLogUser;
  work_order: TimeLogWorkOrder | null;
  task: string;
  hours: number;
  log_date: string;
  status: 'submitted' | 'approved';
  phase: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TimeLogListResponse {
  items: TimeLogEntry[];
  total: number;
}

// --- Styling maps ---

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-rose-500/20', text: 'text-rose-700 dark:text-rose-500', label: 'High' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-700 dark:text-amber-500', label: 'Medium' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-500', label: 'Low' },
};

const jobTypeLabels: Record<string, string> = {
  commercial: 'Commercial',
  personal: 'Personal',
};

// --- Helpers ---

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Reusable components ---

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-sm text-[var(--text-primary)]">{value ?? '—'}</span>
    </div>
  );
}

// --- Delete confirmation modal ---

function DeleteModal({
  jobNumber,
  onConfirm,
  onCancel,
  loading,
}: {
  jobNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Work Order</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Are you sure you want to delete <span className="font-mono font-medium text-[var(--text-primary)]">{jobNumber}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
        </div>
      </header>
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--border)]" />
        ))}
      </div>
    </div>
  );
}

// --- Error state ---

function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-red-500/10 p-3">
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-[var(--text-primary)]">Failed to load work order</p>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">
          Back to Work Orders
        </button>
        <button onClick={onRetry} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90">
          Retry
        </button>
      </div>
    </div>
  );
}

// --- Time & Efficiency section ---

function TimeEfficiencySection({ timeLogs, jobValue }: { timeLogs: TimeLogEntry[]; jobValue: number }) {
  if (timeLogs.length === 0) return null;

  const actualHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);

  // Group hours by phase
  const phaseHours: Record<string, number> = {};
  for (const log of timeLogs) {
    const phase = log.phase || 'other';
    phaseHours[phase] = (phaseHours[phase] || 0) + log.hours;
  }

  const maxPhaseHours = Math.max(...Object.values(phaseHours), 1);

  // Effective rate: job_value is in cents
  const effectiveRate = actualHours > 0 ? (jobValue / 100) / actualHours : null;

  const phaseColors: Record<string, string> = {
    design: 'bg-violet-500',
    production: 'bg-amber-500',
    install: 'bg-[var(--phase-install)]',
    other: 'bg-blue-500',
  };

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatLogDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <InfoCard title="Time & Efficiency">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Actual Hours</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{actualHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Effective Rate</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
            {effectiveRate != null ? `$${effectiveRate.toFixed(2)}/hr` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Time Entries</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{timeLogs.length}</p>
        </div>
      </div>

      {/* Phase breakdown bars */}
      {Object.keys(phaseHours).length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Phase Breakdown</p>
          {Object.entries(phaseHours)
            .sort((a, b) => b[1] - a[1])
            .map(([phase, hours]) => {
              const pct = (hours / maxPhaseHours) * 100;
              return (
                <div key={phase} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-[var(--text-secondary)]">{capitalize(phase)}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)] h-2">
                    <div
                      className={`h-full rounded-full ${phaseColors[phase] || 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-[var(--text-secondary)]">{hours.toFixed(1)}h</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Collapsible time entries list */}
      <details className="pt-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          Time Entries ({timeLogs.length})
        </summary>
        <div className="mt-2 divide-y divide-[var(--border-subtle)]">
          {timeLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">{log.task}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {log.user.full_name || log.user.email} &middot; {formatLogDate(log.log_date)}
                  {log.phase && <> &middot; {capitalize(log.phase)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-[var(--text-primary)]">{log.hours}h</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  log.status === 'approved'
                    ? 'bg-[var(--phase-install)]/10 text-[var(--phase-install)]'
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {log.status === 'approved' ? 'Approved' : 'Submitted'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </InfoCard>
  );
}

// --- Tab content components ---

function OverviewTab({ wo, timeLogs }: { wo: WorkOrderDetail; timeLogs: TimeLogEntry[] }) {
  return (
    <div className="space-y-6">
      <InfoCard title="Job Details">
        <FieldRow label="Job Number" value={<span className="font-mono">{wo.job_number}</span>} />
        <FieldRow label="Job Type" value={jobTypeLabels[wo.job_type] ?? wo.job_type} />
        <FieldRow label="Priority" value={
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[wo.priority]?.bg} ${priorityStyles[wo.priority]?.text}`}>
            {priorityStyles[wo.priority]?.label ?? wo.priority}
          </span>
        } />
        <FieldRow label="Job Value" value={wo.job_value ? formatCurrency(wo.job_value) : '—'} />
      </InfoCard>

      <InfoCard title="Client & Vehicles">
        <FieldRow label="Client" value={wo.client_name} />
        {wo.vehicles.length > 0 ? (
          wo.vehicles.map((v) => (
            <FieldRow
              key={v.id}
              label="Vehicle"
              value={
                <div>
                  <span>{[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown'}</span>
                  {v.vin && <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">{v.vin}</span>}
                </div>
              }
            />
          ))
        ) : (
          <FieldRow label="Vehicle" value="No vehicles assigned" />
        )}
      </InfoCard>

      <InfoCard title="Dates">
        <FieldRow label="Date In" value={formatDate(wo.date_in)} />
        <FieldRow label="Est. Completion" value={formatDate(wo.estimated_completion_date)} />
        <FieldRow label="Completed" value={formatDate(wo.completion_date)} />
      </InfoCard>

      {wo.internal_notes && (
        <InfoCard title="Internal Notes">
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{wo.internal_notes}</p>
        </InfoCard>
      )}

      <TimeEfficiencySection timeLogs={timeLogs} jobValue={wo.job_value} />
    </div>
  );
}

function ChecklistTab({ checklist }: { checklist: ChecklistItem[] | null }) {
  if (!checklist || checklist.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No checklist items</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">This work order has no checklist configured</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] divide-y divide-[var(--border)]">
      {checklist.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            item.done
              ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
              : 'border-[var(--border)] text-transparent'
          }`}>
            {item.done && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm ${item.done ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhotosTab({ workOrderId }: { workOrderId: string }) {
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ photos: PhotoResponse[] }>(`/api/work-orders/${workOrderId}/photos`);
      setPhotos(data.photos ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError('Photos are not available in this environment');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load photos');
      }
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-[var(--border)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No photos</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">No photos have been uploaded for this work order</p>
      </div>
    );
  }

  const beforePhotos = photos.filter((p) => p.photo_type === 'before');
  const afterPhotos = photos.filter((p) => p.photo_type === 'after');
  const otherPhotos = photos.filter((p) => p.photo_type !== 'before' && p.photo_type !== 'after');

  const renderGroup = (title: string, items: PhotoResponse[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
              <img src={photo.url} alt={photo.caption || photo.filename} className="h-full w-full object-cover" />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
                  <p className="text-xs text-white truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderGroup('Before', beforePhotos)}
      {renderGroup('After', afterPhotos)}
      {renderGroup('Other', otherPhotos)}
    </div>
  );
}

function TimelineTab({ statusTimestamps, stages }: { statusTimestamps: Record<string, string> | null; stages: KanbanStageResponse[] }) {
  if (!statusTimestamps || Object.keys(statusTimestamps).length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No timeline data</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Status changes will appear here as the work order progresses</p>
      </div>
    );
  }

  // Build timeline entries from status_timestamps (keyed by stage UUID)
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const entries = Object.entries(statusTimestamps)
    .map(([stageId, timestamp]) => ({
      stage: stageMap.get(stageId),
      stageId,
      timestamp,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4">
      <div className="relative space-y-0">
        {entries.map((entry, i) => (
          <div key={entry.stageId} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {i < entries.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-[var(--border)]" />
            )}
            {/* Dot */}
            <div
              className="mt-1 h-6 w-6 shrink-0 rounded-full border-2"
              style={{
                borderColor: entry.stage?.color ?? 'var(--border)',
                backgroundColor: `${entry.stage?.color ?? 'var(--border)'}20`,
              }}
            />
            {/* Content */}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {entry.stage?.name ?? 'Unknown Stage'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main page ---

type Tab = 'overview' | 'checklist' | 'photos' | 'timeline';

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [wo, setWo] = useState<WorkOrderDetail | null>(null);
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);

  const fetchWorkOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<WorkOrderDetail>(`/api/work-orders/${id}`);
      setWo(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load work order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchStages = useCallback(async () => {
    try {
      const data = await api.get<KanbanStageResponse[]>('/api/kanban-stages');
      setStages(data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchTimeLogs = useCallback(async () => {
    try {
      const data = await api.get<TimeLogListResponse>(`/api/time-logs?work_order_id=${id}&limit=100`);
      setTimeLogs(data.items);
    } catch {
      // non-critical
    }
  }, [id]);

  useEffect(() => { fetchWorkOrder(); fetchStages(); fetchTimeLogs(); }, [fetchWorkOrder, fetchStages, fetchTimeLogs]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/work-orders/${id}`);
      router.push('/dashboard/work-orders');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError('Cannot delete — this work order has linked invoices');
      } else {
        setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete work order');
      }
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error || !wo) return <ErrorState message={error ?? 'Work order not found'} onRetry={fetchWorkOrder} onBack={() => router.push('/dashboard/work-orders')} />;

  const pStyle = priorityStyles[wo.priority] ?? priorityStyles.medium;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'photos', label: 'Photos' },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <button
          onClick={() => router.push('/dashboard/work-orders')}
          className="mb-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          &larr; Work Orders
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] tracking-[-0.4px] font-mono text-[var(--text-primary)]">{wo.job_number}</h1>
            {wo.status && (
              <span
                className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${wo.status.color}20`, color: wo.status.color }}
              >
                {wo.status.name}
              </span>
            )}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pStyle.bg} ${pStyle.text}`}>
              {pStyle.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowLogTimeModal(true)}
              size="sm"
            >
              Log Time
            </Button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      {/* Delete error toast */}
      {deleteError && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-sm font-medium text-red-400 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'overview' && <OverviewTab wo={wo} timeLogs={timeLogs} />}
        {activeTab === 'checklist' && <ChecklistTab checklist={wo.checklist} />}
        {activeTab === 'photos' && <PhotosTab workOrderId={wo.id} />}
        {activeTab === 'timeline' && <TimelineTab statusTimestamps={wo.status_timestamps} stages={stages} />}
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          jobNumber={wo.job_number}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      <LogTimeModal
        isOpen={showLogTimeModal}
        onClose={() => setShowLogTimeModal(false)}
        onCreated={() => { setShowLogTimeModal(false); fetchTimeLogs(); }}
        workOrderId={wo.id}
        workOrderJobNumber={wo.job_number}
      />
    </div>
  );
}

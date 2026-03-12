'use client';

import { useState, useEffect, useMemo } from 'react';
import { Printer, X, Check } from 'lucide-react';
import Select from '@/components/ui/Select';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

type PrintStatus = 'all' | 'queued' | 'printing' | 'laminating' | 'done';

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

interface PrintJob {
  id: string;
  jobName: string;
  client: string;
  material: string;
  size: string;
  status: 'queued' | 'printing' | 'laminating' | 'done';
  dueDate: string;
  priority: 'high' | 'normal' | 'low';
  notes?: string;
}

function derivePrintStatus(wo: ApiWorkOrder): PrintJob['status'] {
  const statusName = wo.status?.name?.toLowerCase() ?? '';
  const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';

  if (statusName.includes('laminat')) return 'laminating';
  if (statusName.includes('print')) return 'printing';
  if (systemStatus === 'completed' || statusName.includes('done') || statusName.includes('complete')) return 'done';
  return 'queued';
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '';
}

function toPrintJob(wo: ApiWorkOrder): PrintJob {
  const vehicle = vehicleLabel(wo.vehicles);
  const jobName = vehicle
    ? `${wo.job_number} — ${vehicle}`
    : wo.job_number;

  return {
    id: wo.id,
    jobName,
    client: wo.client_name ?? '—',
    material: wo.job_type || '—',
    size: '—',
    status: derivePrintStatus(wo),
    dueDate: wo.estimated_completion_date ?? wo.date_in,
    priority: wo.priority === 'high' ? 'high' : wo.priority === 'low' ? 'low' : 'normal',
    notes: wo.internal_notes ?? undefined,
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const MATERIAL_OPTIONS = [
  { value: '', label: 'Select material...' },
  { value: '3M IJ180Cv3', label: '3M IJ180Cv3 (Cast Vinyl)' },
  { value: 'Avery MPI 1105', label: 'Avery MPI 1105 (Calendered)' },
  { value: 'Avery SW900', label: 'Avery SW900 (Supreme Wrapping)' },
  { value: 'Oracal 3951RA', label: 'Oracal 3951RA (RapidAir)' },
  { value: '3M 1080', label: '3M 1080 (Wrap Film)' },
  { value: 'Oracal 970RA', label: 'Oracal 970RA (Premium)' },
  { value: 'Laminate - Avery DOL 1060', label: 'Laminate - Avery DOL 1060' },
  { value: 'Laminate - 3M 8518', label: 'Laminate - 3M 8518' },
];

const statusStyles: Record<PrintJob['status'], { bg: string; text: string; label: string }> = {
  queued: { bg: 'bg-[var(--text-muted)]/10', text: 'text-[var(--text-secondary)]', label: 'Queued' },
  printing: { bg: 'bg-[var(--phase-production)]/10', text: 'text-[var(--phase-production)]', label: 'Printing' },
  laminating: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Laminating' },
  done: { bg: 'bg-[var(--phase-install)]/10', text: 'text-[var(--phase-install)]', label: 'Done' },
};

const priorityStyles: Record<PrintJob['priority'], string> = {
  high: 'text-rose-600',
  normal: 'text-[var(--text-secondary)]',
  low: 'text-[var(--text-muted)]',
};

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
      <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
      {message}
      <button onClick={onDismiss} className="ml-2 rounded p-0.5 hover:bg-emerald-500">
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-56 animate-pulse rounded bg-[var(--surface-overlay)]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--surface-raised)]" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-overlay)]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border)] px-4 py-3">
              <div className="h-5 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add-to-Queue Modal                                                 */
/* ------------------------------------------------------------------ */

interface AddToQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (job: PrintJob) => void;
}

function AddToQueueModal({ isOpen, onClose, onAdd }: AddToQueueModalProps) {
  const [jobName, setJobName] = useState('');
  const [material, setMaterial] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function resetForm() {
    setJobName('');
    setMaterial('');
    setWidth('');
    setHeight('');
    setPriority('normal');
    setNotes('');
    setValidationErrors({});
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!jobName.trim()) errors.jobName = 'Job name is required';
    if (!material) errors.material = 'Material type is required';
    if (!width.trim()) {
      errors.width = 'Width is required';
    } else if (isNaN(Number(width)) || Number(width) <= 0) {
      errors.width = 'Width must be a positive number';
    }
    if (!height.trim()) {
      errors.height = 'Height is required';
    } else if (isNaN(Number(height)) || Number(height) <= 0) {
      errors.height = 'Height must be a positive number';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Simulate a short network delay so the loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newJob: PrintJob = {
      id: `local-${Date.now()}`,
      jobName: jobName.trim(),
      client: '(unassigned)',
      material,
      size: `${width}' x ${height}'`,
      status: 'queued',
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      priority: priority === 'high' ? 'high' : 'normal',
      notes: notes.trim() || undefined,
    };

    onAdd(newJob);
    resetForm();
    setIsSubmitting(false);
    onClose();
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]';
  const errorInputClass =
    'w-full rounded-xl border border-red-300 bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-queue-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="add-queue-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Add to Print Queue
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Job Name */}
          <div>
            <label htmlFor="queue-job-name" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Job Name <span className="text-red-500">*</span>
            </label>
            <input
              id="queue-job-name"
              type="text"
              value={jobName}
              onChange={(e) => { setJobName(e.target.value); setValidationErrors((v) => ({ ...v, jobName: '' })); }}
              placeholder="e.g., Fleet Van #14 — Full Wrap"
              className={validationErrors.jobName ? errorInputClass : inputClass}
            />
            {validationErrors.jobName && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.jobName}</p>
            )}
          </div>

          {/* Material Type */}
          <div>
            <label htmlFor="queue-material" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Material Type <span className="text-red-500">*</span>
            </label>
            <Select
              id="queue-material"
              value={material}
              onChange={(v) => { setMaterial(v); setValidationErrors((ve) => ({ ...ve, material: '' })); }}
              options={MATERIAL_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              error={!!validationErrors.material}
            />
            {validationErrors.material && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.material}</p>
            )}
          </div>

          {/* Width & Height */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="queue-width" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Width (ft) <span className="text-red-500">*</span>
              </label>
              <input
                id="queue-width"
                type="text"
                inputMode="decimal"
                value={width}
                onChange={(e) => { setWidth(e.target.value); setValidationErrors((v) => ({ ...v, width: '' })); }}
                placeholder="e.g., 4"
                className={validationErrors.width ? errorInputClass : inputClass}
              />
              {validationErrors.width && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.width}</p>
              )}
            </div>
            <div>
              <label htmlFor="queue-height" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Height (ft) <span className="text-red-500">*</span>
              </label>
              <input
                id="queue-height"
                type="text"
                inputMode="decimal"
                value={height}
                onChange={(e) => { setHeight(e.target.value); setValidationErrors((v) => ({ ...v, height: '' })); }}
                placeholder="e.g., 25"
                className={validationErrors.height ? errorInputClass : inputClass}
              />
              {validationErrors.height && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.height}</p>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="queue-priority" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Priority
            </label>
            <Select
              id="queue-priority"
              value={priority}
              onChange={(v) => setPriority(v as 'normal' | 'high')}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'Rush' },
              ]}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="queue-notes" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Notes
            </label>
            <textarea
              id="queue-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className={inputClass}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrintPage() {
  const [filter, setFilter] = useState<PrintStatus>('all');
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [localJobs, setLocalJobs] = useState<PrintJob[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
        if (!cancelled) {
          setWorkOrders(resp?.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load print queue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchKey]);

  const apiJobs = useMemo(() => workOrders.map(toPrintJob), [workOrders]);
  const jobs = useMemo(() => [...localJobs, ...apiJobs], [localJobs, apiJobs]);

  const filtered = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)),
    [jobs, filter],
  );

  const counts = useMemo(() => {
    const c: Record<PrintStatus, number> = { all: jobs.length, queued: 0, printing: 0, laminating: 0, done: 0 };
    jobs.forEach((j) => { c[j.status]++; });
    return c;
  }, [jobs]);

  function handleAddJob(job: PrintJob) {
    setLocalJobs((prev) => [job, ...prev]);
    setToast(`"${job.jobName}" added to queue`);
  }

  const tabs: { key: PrintStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'queued', label: 'Queued' },
    { key: 'printing', label: 'Printing' },
    { key: 'laminating', label: 'Laminating' },
    { key: 'done', label: 'Done' },
  ];

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load print queue</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={() => setFetchKey((k) => k + 1)}
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Print / Lamination Queue</h1>
            <span className="rounded-full bg-[var(--phase-production)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--phase-production)]">
              {jobs.length} jobs
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-80"
          >
            + Add to Queue
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Printer className="mb-3 h-10 w-10 text-[var(--text-muted)]" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No items in this view</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Print queue items will appear here as jobs come in.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Job</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Client</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Material</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Size</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Priority</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const style = statusStyles[job.status];
                  return (
                    <tr key={job.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{job.jobName}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{job.client}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{job.material}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{job.size}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-[10px] font-bold uppercase ${priorityStyles[job.priority]}`}>
                        {job.priority}
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatDate(job.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddToQueueModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAddJob} />

      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

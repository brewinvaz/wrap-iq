'use client';

import { useState, useEffect, useMemo } from 'react';
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
  queued: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Queued' },
  printing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Printing' },
  laminating: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Laminating' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Done' },
};

const priorityStyles: Record<PrintJob['priority'], string> = {
  high: 'text-rose-600',
  normal: 'text-[#60606a]',
  low: 'text-[#a8a8b4]',
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
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {message}
      <button onClick={onDismiss} className="ml-2 rounded p-0.5 hover:bg-emerald-500">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
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
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] bg-[#f4f4f6] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-[#e6e6eb] px-4 py-3">
              <div className="h-5 w-full animate-pulse rounded bg-gray-100" />
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
    'w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const errorInputClass =
    'w-full rounded-lg border border-red-300 px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-queue-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="add-queue-title" className="text-lg font-semibold text-[#18181b]">
            Add to Print Queue
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Job Name */}
          <div>
            <label htmlFor="queue-job-name" className="mb-1.5 block text-sm font-medium text-[#18181b]">
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
            <label htmlFor="queue-material" className="mb-1.5 block text-sm font-medium text-[#18181b]">
              Material Type <span className="text-red-500">*</span>
            </label>
            <select
              id="queue-material"
              value={material}
              onChange={(e) => { setMaterial(e.target.value); setValidationErrors((v) => ({ ...v, material: '' })); }}
              className={validationErrors.material ? errorInputClass : inputClass}
            >
              {MATERIAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {validationErrors.material && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.material}</p>
            )}
          </div>

          {/* Width & Height */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="queue-width" className="mb-1.5 block text-sm font-medium text-[#18181b]">
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
              <label htmlFor="queue-height" className="mb-1.5 block text-sm font-medium text-[#18181b]">
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
            <label htmlFor="queue-priority" className="mb-1.5 block text-sm font-medium text-[#18181b]">
              Priority
            </label>
            <select
              id="queue-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
              className={inputClass}
            >
              <option value="normal">Normal</option>
              <option value="high">Rush</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="queue-notes" className="mb-1.5 block text-sm font-medium text-[#18181b]">
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
              className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
        <p className="text-sm font-medium text-[#18181b]">Failed to load print queue</p>
        <p className="text-xs text-[#60606a]">{error}</p>
        <button
          onClick={() => setFetchKey((k) => k + 1)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Print / Lamination Queue</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {jobs.length} jobs
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-[#60606a] hover:bg-gray-50'
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
            <svg className="mb-3 h-10 w-10 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.159l-.351.089" />
            </svg>
            <p className="text-sm font-medium text-[#60606a]">No items in this view</p>
            <p className="mt-1 text-xs text-[#a8a8b4]">Print queue items will appear here as jobs come in.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Job</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Material</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const style = statusStyles[job.status];
                  return (
                    <tr key={job.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                      <td className="px-4 py-3 font-medium text-[#18181b]">{job.jobName}</td>
                      <td className="px-4 py-3 text-[#60606a]">{job.client}</td>
                      <td className="px-4 py-3 text-[#60606a]">{job.material}</td>
                      <td className="px-4 py-3 text-[#60606a]">{job.size}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium capitalize ${priorityStyles[job.priority]}`}>
                        {job.priority}
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{formatDate(job.dueDate)}</td>
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

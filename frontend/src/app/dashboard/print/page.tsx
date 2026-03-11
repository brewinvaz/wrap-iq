'use client';

import { useState, useEffect } from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

type PrintStatus = 'all' | 'queued' | 'printing' | 'laminating' | 'done';

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

const SEED_JOBS: PrintJob[] = [
  { id: '1', jobName: 'Fleet Van #12 — Full Wrap', client: 'Metro Plumbing', material: '3M IJ180Cv3', size: '4\' x 25\'', status: 'printing', dueDate: '2026-03-11', priority: 'high' },
  { id: '2', jobName: 'Box Truck — Partial Wrap', client: 'FastFreight Inc.', material: 'Avery MPI 1105', size: '5\' x 20\'', status: 'queued', dueDate: '2026-03-12', priority: 'high' },
  { id: '3', jobName: 'Sprinter — Color Change', client: 'CleanCo Services', material: 'Avery SW900', size: '5\' x 30\'', status: 'laminating', dueDate: '2026-03-12', priority: 'normal' },
  { id: '4', jobName: 'Sedan — Accent Kit', client: 'Elite Auto Group', material: '3M IJ180Cv3', size: '2\' x 8\'', status: 'queued', dueDate: '2026-03-13', priority: 'normal' },
  { id: '5', jobName: 'Trailer — Full Wrap', client: 'Skyline Moving', material: 'Oracal 3951RA', size: '8\' x 50\'', status: 'done', dueDate: '2026-03-10', priority: 'low' },
  { id: '6', jobName: 'SUV — Hood & Roof', client: 'Greenfield Lawn Care', material: '3M IJ180Cv3', size: '3\' x 12\'', status: 'queued', dueDate: '2026-03-14', priority: 'normal' },
  { id: '7', jobName: 'Pickup — Tailgate Wrap', client: 'Summit Electric', material: 'Avery MPI 1105', size: '2\' x 6\'', status: 'done', dueDate: '2026-03-09', priority: 'low' },
];

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

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Jobs added here are stored locally in your browser. They will persist until you refresh the page. Backend integration is coming soon.
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
  const [jobs, setJobs] = useState<PrintJob[]>(SEED_JOBS);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleAddJob(job: PrintJob) {
    setJobs((prev) => [job, ...prev]);
    setToast(`"${job.jobName}" added to queue`);
  }

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
  const tabs: { key: PrintStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: jobs.length },
    { key: 'queued', label: 'Queued', count: jobs.filter((j) => j.status === 'queued').length },
    { key: 'printing', label: 'Printing', count: jobs.filter((j) => j.status === 'printing').length },
    { key: 'laminating', label: 'Laminating', count: jobs.filter((j) => j.status === 'laminating').length },
    { key: 'done', label: 'Done', count: jobs.filter((j) => j.status === 'done').length },
  ];

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
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
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
                    <td className="px-4 py-3 text-[#60606a]">{job.dueDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddToQueueModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAddJob} />

      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

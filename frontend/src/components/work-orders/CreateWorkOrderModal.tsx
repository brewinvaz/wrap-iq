'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateWorkOrderModal({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkOrderModalProps) {
  const [jobType, setJobType] = useState<'personal' | 'commercial'>('personal');
  const [jobValue, setJobValue] = useState<number | ''>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dateIn, setDateIn] = useState(todayString());
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function resetForm() {
    setJobType('personal');
    setJobValue('');
    setPriority('medium');
    setDateIn(todayString());
    setEstimatedCompletionDate('');
    setInternalNotes('');
    setClientId('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateIn) return;

    setIsSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        job_type: jobType,
        job_value: jobValue !== '' ? Math.round(Number(jobValue) * 100) : 0,
        priority,
        date_in: dateIn,
      };

      if (estimatedCompletionDate) {
        payload.estimated_completion_date = estimatedCompletionDate;
      }
      if (internalNotes.trim()) {
        payload.internal_notes = internalNotes.trim();
      }
      if (clientId.trim()) {
        if (!isValidUUID(clientId.trim())) {
          setError('Client ID must be a valid UUID.');
          setIsSubmitting(false);
          return;
        }
        payload.client_id = clientId.trim();
      }

      await api.post('/api/work-orders', payload);
      resetForm();
      onCreate();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#18181b]">
            Create Work Order
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="job-type"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Job Type
              </label>
              <select
                id="job-type"
                value={jobType}
                onChange={(e) =>
                  setJobType(e.target.value as 'personal' | 'commercial')
                }
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="personal">Personal</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="priority"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'low' | 'medium' | 'high')
                }
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="job-value"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Job Value ($)
            </label>
            <input
              id="job-value"
              type="number"
              min={0}
              step="0.01"
              value={jobValue}
              onChange={(e) =>
                setJobValue(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="0.00"
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="date-in"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Date In
              </label>
              <input
                id="date-in"
                type="date"
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                required
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="estimated-completion"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Est. Completion
              </label>
              <input
                id="estimated-completion"
                type="date"
                value={estimatedCompletionDate}
                onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="client-id"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Client ID
            </label>
            <input
              id="client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="UUID (optional)"
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="internal-notes"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Internal Notes
            </label>
            <textarea
              id="internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

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
              {isSubmitting ? 'Creating...' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

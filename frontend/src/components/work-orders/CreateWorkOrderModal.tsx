'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface Client {
  id: string;
  name: string;
}

interface ClientListResponse {
  items: Client[];
  total: number;
}

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useModalAccessibility(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingClients(true);
    api
      .get<ClientListResponse>('/api/clients?limit=500')
      .then((data) => {
        if (!cancelled) setClients(data.items);
      })
      .catch(() => {
        /* clients will remain empty; user can still type a UUID */
      })
      .finally(() => {
        if (!cancelled) setIsLoadingClients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
      if (clientId) {
        payload.client_id = clientId;
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

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-work-order-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="create-work-order-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Create Work Order
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
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
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="job-type"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Job Type
              </label>
              <Select
                id="job-type"
                value={jobType}
                onChange={(v) => setJobType(v as 'personal' | 'commercial')}
                options={[
                  { value: 'personal', label: 'Personal' },
                  { value: 'commercial', label: 'Commercial' },
                ]}
              />
            </div>
            <div>
              <label
                htmlFor="priority"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Priority
              </label>
              <Select
                id="priority"
                value={priority}
                onChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="job-value"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
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
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="date-in"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Date In
              </label>
              <input
                id="date-in"
                type="date"
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="estimated-completion"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Est. Completion
              </label>
              <input
                id="estimated-completion"
                type="date"
                value={estimatedCompletionDate}
                onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="client-id"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Client
            </label>
            <Select
              id="client-id"
              value={clientId}
              onChange={setClientId}
              disabled={isLoadingClients}
              placeholder={isLoadingClients ? 'Loading clients...' : 'None (optional)'}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div>
            <label
              htmlFor="internal-notes"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Internal Notes
            </label>
            <textarea
              id="internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="flex-1"
            >
              Create Work Order
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

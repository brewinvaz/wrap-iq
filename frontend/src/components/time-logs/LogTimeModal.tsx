'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface WorkOrderOption {
  id: string;
  job_number: string;
}

interface LogTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  workOrderId?: string;
  workOrderJobNumber?: string;
  defaultPhase?: string;
}

const PHASE_OPTIONS = [
  { value: '', label: 'Select phase...' },
  { value: 'design', label: 'Design' },
  { value: 'production', label: 'Production' },
  { value: 'install', label: 'Install' },
  { value: 'other', label: 'Other' },
];

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function LogTimeModal({
  isOpen,
  onClose,
  onCreated,
  workOrderId,
  workOrderJobNumber,
  defaultPhase,
}: LogTimeModalProps) {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(workOrderId ?? '');
  const [selectedWorkOrderLabel, setSelectedWorkOrderLabel] = useState(workOrderJobNumber ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkOrderOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [phase, setPhase] = useState(defaultPhase ?? '');
  const [task, setTask] = useState('');
  const [hours, setHours] = useState('');
  const [logDate, setLogDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useModalAccessibility(isOpen, onClose);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLockedWorkOrder = Boolean(workOrderId);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedWorkOrderId(workOrderId ?? '');
      setSelectedWorkOrderLabel(workOrderJobNumber ?? '');
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      setPhase(defaultPhase ?? '');
      setTask('');
      setHours('');
      setLogDate(todayISO());
      setNotes('');
      setError(null);
    }
  }, [isOpen, workOrderId, workOrderJobNumber, defaultPhase]);

  // Debounced work order search
  const searchWorkOrders = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await api.get<{ items: WorkOrderOption[] }>(
        `/api/work-orders?search=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(data.items);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchWorkOrders(value), 300);
  }

  function handleSelectWorkOrder(wo: WorkOrderOption) {
    setSelectedWorkOrderId(wo.id);
    setSelectedWorkOrderLabel(wo.job_number);
    setSearchQuery('');
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearWorkOrder() {
    setSelectedWorkOrderId('');
    setSelectedWorkOrderLabel('');
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showDropdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) return;
    if (!phase) return;
    if (!hours || Number(hours) <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/time-logs', {
        work_order_id: selectedWorkOrderId || undefined,
        phase,
        task: task.trim(),
        hours: Number(hours),
        log_date: logDate,
        notes: notes.trim() || undefined,
      });
      onCreated();
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

  if (!isOpen) return null;

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
        aria-labelledby="log-time-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="log-time-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Log Time
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
          {/* Work Order */}
          <div>
            <label
              htmlFor="log-work-order"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Work Order <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            {isLockedWorkOrder ? (
              <div className="flex w-full items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]">
                <span className="font-mono">{selectedWorkOrderLabel}</span>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {selectedWorkOrderId ? (
                  <div className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm">
                    <span className="font-mono text-[var(--text-primary)]">{selectedWorkOrderLabel}</span>
                    <button
                      type="button"
                      onClick={clearWorkOrder}
                      className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <input
                    id="log-work-order"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by job number..."
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                )}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] shadow-lg">
                    {searchResults.map((wo) => (
                      <button
                        key={wo.id}
                        type="button"
                        onClick={() => handleSelectWorkOrder(wo)}
                        className="flex w-full items-center px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/10"
                      >
                        <span className="font-mono">{wo.job_number}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && searchResults.length === 0 && !searchLoading && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3.5 py-2 shadow-lg">
                    <span className="text-sm text-[var(--text-muted)]">No work orders found</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phase */}
          <div>
            <label
              htmlFor="log-phase"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Phase
            </label>
            <Select
              id="log-phase"
              value={phase}
              onChange={setPhase}
              options={PHASE_OPTIONS}
            />
          </div>

          {/* Task */}
          <div>
            <label
              htmlFor="log-task"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Task
            </label>
            <input
              id="log-task"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g., Vehicle wrap installation"
              required
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          {/* Hours and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="log-hours"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Hours
              </label>
              <input
                id="log-hours"
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0.00"
                required
                min="0.25"
                step="0.25"
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="log-date"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Date
              </label>
              <input
                id="log-date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="log-notes"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Notes <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          {/* Buttons */}
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
              disabled={!task.trim() || !phase || !hours || Number(hours) <= 0}
              className="flex-1"
            >
              Log Time
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

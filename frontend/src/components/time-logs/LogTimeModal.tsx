'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { Button } from '@/components/ui/Button';
import WorkOrderSearch from './WorkOrderSearch';
import QuickHours from './QuickHours';
import TaskSelector from './TaskSelector';

interface LogTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  workOrderId?: string;
  workOrderJobNumber?: string;
  defaultPhase?: string;
}

const PHASES = [
  { value: 'design', label: 'Design', color: 'var(--phase-design, #8b5cf6)' },
  { value: 'production', label: 'Production', color: 'var(--phase-production, #f59e0b)' },
  { value: 'install', label: 'Install', color: 'var(--phase-install, #22c55e)' },
  { value: 'other', label: 'Other', color: 'var(--phase-other, #3b82f6)' },
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

  const [phase, setPhase] = useState(defaultPhase ?? '');
  const [task, setTask] = useState('');
  const [hours, setHours] = useState('');
  const [logDate, setLogDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useModalAccessibility(isOpen, onClose);
  const isLockedWorkOrder = Boolean(workOrderId);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedWorkOrderId(workOrderId ?? '');
      setSelectedWorkOrderLabel(workOrderJobNumber ?? '');
      setPhase(defaultPhase ?? '');
      setTask('');
      setHours('');
      setLogDate(todayISO());
      setNotes('');
      setError(null);
    }
  }, [isOpen, workOrderId, workOrderJobNumber, defaultPhase]);

  function handlePhaseChange(newPhase: string) {
    setPhase(newPhase);
    setTask(''); // Reset task when phase changes
  }

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
              Job <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <WorkOrderSearch
              selectedId={selectedWorkOrderId}
              selectedLabel={selectedWorkOrderLabel}
              onSelect={(id, label) => {
                setSelectedWorkOrderId(id);
                setSelectedWorkOrderLabel(label);
              }}
              onClear={() => {
                setSelectedWorkOrderId('');
                setSelectedWorkOrderLabel('');
              }}
              isLocked={isLockedWorkOrder}
            />
          </div>

          {/* Phase — segmented buttons */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Phase
            </label>
            <div className="flex gap-2">
              {PHASES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePhaseChange(p.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    phase === p.value
                      ? 'font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    phase === p.value
                      ? {
                          borderColor: `color-mix(in srgb, ${p.color} 40%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${p.color} 12%, transparent)`,
                          color: p.color,
                        }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Task — phase-based presets */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Task
            </label>
            <TaskSelector phase={phase} value={task} onChange={setTask} />
          </div>

          {/* Hours — quick-select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Hours
            </label>
            <QuickHours value={hours} onChange={setHours} />
          </div>

          {/* Date */}
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

'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { ProjectDetail, Note, WorkOrderPhoto } from '@/lib/types';
import PhotoUploadZone from '@/components/PhotoUploadZone';
import Select from '@/components/ui/Select';

// --- API response types ---

interface ApiKanbanStage {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface ApiVehicleInWorkOrder {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface ApiWorkOrderResponse {
  id: string;
  job_number: string;
  job_type: string;
  job_value: number;
  priority: string;
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  checklist: { label: string; done: boolean }[] | null;
  status: ApiKanbanStage | null;
  vehicles: ApiVehicleInWorkOrder[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

// --- Transform API response to ProjectDetail ---

function transformWorkOrderToProject(wo: ApiWorkOrderResponse): ProjectDetail {
  const vehicle = wo.vehicles[0];
  const vehicleStr = vehicle
    ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
    : 'No vehicle assigned';

  const statusName = wo.status?.name ?? 'Unknown';

  // Build a minimal statusHistory from what we know
  const statusHistory = [
    { status: statusName, timestamp: wo.created_at, changedBy: 'System' },
  ];

  // Map priority string to expected type
  const priority = (['high', 'medium', 'low'].includes(wo.priority) ? wo.priority : 'medium') as 'high' | 'medium' | 'low';

  return {
    id: wo.job_number,
    name: `${wo.job_type.charAt(0).toUpperCase() + wo.job_type.slice(1)} — ${vehicleStr}`,
    vehicle: vehicleStr,
    vehicleSummary: vehicleStr,
    client: wo.client_name ?? 'Unknown Client',
    value: wo.job_value,
    date: wo.date_in.split('T')[0],
    priority,
    tags: [],
    team: [],
    progress: wo.completion_date ? 100 : 0,
    tasks: wo.checklist ?? [],
    vehicleDetails: {
      vin: vehicle?.vin ?? 'N/A',
      year: vehicle?.year ? String(vehicle.year) : 'N/A',
      make: vehicle?.make ?? 'N/A',
      model: vehicle?.model ?? 'N/A',
      vehicleType: 'N/A',
    },
    wrapDetails: {
      coverage: 'N/A',
      roofCoverage: 'N/A',
      windowCoverage: 'N/A',
      bumperCoverage: 'N/A',
      doorHandles: 'N/A',
      miscItems: [],
    },
    designDetails: {
      designHours: 0,
      versionCount: 0,
      revisionCount: 0,
    },
    productionDetails: {
      equipment: 'N/A',
      mediaBrand: 'N/A',
      mediaWidth: 'N/A',
      laminateBrand: 'N/A',
      printLength: 0,
    },
    installDetails: {
      location: 'N/A',
      difficulty: 'N/A',
      startDate: wo.estimated_completion_date?.split('T')[0] ?? 'TBD',
      endDate: wo.completion_date?.split('T')[0] ?? 'TBD',
      timeLogs: [],
    },
    statusHistory,
    notes: wo.internal_notes
      ? [{ id: 'n1', text: wo.internal_notes, author: 'System', timestamp: wo.created_at }]
      : [],
    photos: [],
    estimatedHours: 0,
    actualHours: 0,
    revenue: wo.job_value,
    cost: 0,
  };
}

type Tab = 'overview' | 'checklist' | 'notes' | 'photos' | 'timeline';

const priorityColors: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const priorityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const statusColors: Record<string, string> = {
  Quoted: '#2563eb',
  Confirmed: '#7c3aed',
  Design: '#d97706',
  Production: '#059669',
  Install: '#e11d48',
  Complete: '#6b7280',
};


function formatDate(dateStr: string): string {
  if (dateStr === 'TBD' || dateStr === 'N/A') return dateStr;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---- Save Status Types ----
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
        status === 'saving'
          ? 'bg-amber-500/10 text-amber-400'
          : status === 'saved'
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
      }`}
    >
      {status === 'saving' && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save failed'}
    </span>
  );
}

// ---- Debounced save hook ----
function useDebouncedSave(
  workOrderId: string,
  field: string,
  delayMs = 1000,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (value: unknown) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSaveStatus('saving');

      timerRef.current = setTimeout(async () => {
        try {
          await api.patch(`/api/work-orders/${workOrderId}`, {
            [field]: value,
          });
          setSaveStatus('saved');
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('error');
        }
      }, delayMs);
    },
    [workOrderId, field, delayMs],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return { saveStatus, save };
}

// ---- Loading Skeleton ----
function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="mb-3">
          <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-64 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
          <div className="text-right space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-6 w-20 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <div className="h-0.5 w-6 bg-[var(--surface-raised)]" />}
              <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
          ))}
        </div>
      </header>
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--border)]" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--border)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Error State ----
function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-red-500/10 p-3">
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-[var(--text-primary)]">Failed to load project</p>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          Back to Dashboard
        </button>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ---- Field Row Component ----
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-36 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

// ---- Info Card Component ----
function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

// ---- Steps Indicator ----
function StepsIndicator({ history }: { history: ProjectDetail['statusHistory'] }) {
  const steps = ['Quoted', 'Confirmed', 'Design', 'Production', 'Install', 'Complete'];
  const lastStatus = history[history.length - 1]?.status ?? '';
  const currentIndex = steps.indexOf(lastStatus);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const dotColor = statusColors[step] ?? '#6b7280';

        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-6 ${
                  isCompleted ? 'bg-[#18181b]' : 'bg-[var(--surface-raised)]'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold ${
                  isCompleted || isCurrent
                    ? 'text-white'
                    : 'border border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-tertiary)]'
                }`}
                style={
                  isCompleted || isCurrent
                    ? { backgroundColor: dotColor }
                    : undefined
                }
              >
                {isCompleted ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[9px] font-medium ${
                  isCompleted || isCurrent
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)]'
                }`}
              >
                {step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Overview Tab ----
function OverviewTab({ project }: { project: ProjectDetail }) {
  const margin = project.revenue - project.cost;
  const marginPct =
    project.revenue > 0
      ? ((margin / project.revenue) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Profit Box */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Revenue
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
            {formatCurrency(project.revenue)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Cost
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
            {formatCurrency(project.cost)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            Margin
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {formatCurrency(margin)}{' '}
            <span className="text-sm font-medium">({marginPct}%)</span>
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vehicle Info */}
        <InfoCard title="Vehicle Information">
          <FieldRow label="VIN" value={project.vehicleDetails.vin} />
          <FieldRow
            label="Year / Make / Model"
            value={`${project.vehicleDetails.year} ${project.vehicleDetails.make} ${project.vehicleDetails.model}`}
          />
          <FieldRow label="Type" value={project.vehicleDetails.vehicleType} />
          {project.vehicleDetails.unitNumber && (
            <FieldRow label="Unit #" value={project.vehicleDetails.unitNumber} />
          )}
        </InfoCard>

        {/* Wrap Details */}
        {project.wrapDetails.coverage !== 'N/A' && (
          <InfoCard title="Wrap Details">
            <FieldRow label="Coverage" value={project.wrapDetails.coverage} />
            <FieldRow label="Roof" value={project.wrapDetails.roofCoverage} />
            <FieldRow label="Windows" value={project.wrapDetails.windowCoverage} />
            <FieldRow label="Bumpers" value={project.wrapDetails.bumperCoverage} />
            <FieldRow label="Door Handles" value={project.wrapDetails.doorHandles} />
            {project.wrapDetails.miscItems.length > 0 && (
              <FieldRow
                label="Misc Items"
                value={project.wrapDetails.miscItems.join(', ')}
              />
            )}
            {project.wrapDetails.specialInstructions && (
              <FieldRow
                label="Special Notes"
                value={project.wrapDetails.specialInstructions}
              />
            )}
          </InfoCard>
        )}

        {/* Design */}
        {project.designDetails.designHours > 0 && (
          <InfoCard title="Design">
            <FieldRow
              label="Design Hours"
              value={`${project.designDetails.designHours}h`}
            />
            <FieldRow
              label="Versions"
              value={String(project.designDetails.versionCount)}
            />
            <FieldRow
              label="Revisions"
              value={String(project.designDetails.revisionCount)}
            />
          </InfoCard>
        )}

        {/* Production */}
        {project.productionDetails.equipment !== 'N/A' && (
          <InfoCard title="Production">
            <FieldRow label="Equipment" value={project.productionDetails.equipment} />
            <FieldRow label="Media" value={project.productionDetails.mediaBrand} />
            <FieldRow label="Media Width" value={project.productionDetails.mediaWidth} />
            <FieldRow label="Laminate" value={project.productionDetails.laminateBrand} />
            <FieldRow
              label="Print Length"
              value={`${project.productionDetails.printLength} ft`}
            />
          </InfoCard>
        )}

        {/* Install */}
        <InfoCard title="Install">
          <FieldRow label="Location" value={project.installDetails.location} />
          <FieldRow label="Difficulty" value={project.installDetails.difficulty} />
          <FieldRow
            label="Start Date"
            value={formatDate(project.installDetails.startDate)}
          />
          <FieldRow
            label="End Date"
            value={formatDate(project.installDetails.endDate)}
          />
          {project.installDetails.timeLogs.length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Time Logs
              </p>
              <div className="space-y-1.5">
                {project.installDetails.timeLogs.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {log.installer}
                    </span>
                    <span className="text-[var(--text-secondary)]">{log.task}</span>
                    <span className="font-mono text-[var(--text-primary)]">{log.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </InfoCard>

        {/* Hours */}
        {(project.estimatedHours > 0 || project.actualHours > 0) && (
          <InfoCard title="Hours Tracking">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  Estimated
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {project.estimatedHours}h
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  Actual
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {project.actualHours}h
                </p>
              </div>
            </div>
            {project.estimatedHours > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-[var(--text-secondary)]">
                  <span>Progress</span>
                  <span>
                    {Math.round((project.actualHours / project.estimatedHours) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (project.actualHours / project.estimatedHours) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </InfoCard>
        )}
      </div>

      {/* Team */}
      {project.team.length > 0 && (
        <InfoCard title="Assigned Team">
          <div className="flex gap-3">
            {project.team.map((member) => (
              <div key={member.initials} className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">{member.initials}</span>
              </div>
            ))}
          </div>
        </InfoCard>
      )}
    </div>
  );
}

// ---- Checklist Tab ----
function ChecklistTab({ project, workOrderId }: { project: ProjectDetail; workOrderId: string }) {
  const [tasks, setTasks] = useState(project.tasks ?? []);
  const { saveStatus, save } = useDebouncedSave(workOrderId, 'checklist', 500);
  const completedCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleTask = (index: number) => {
    setTasks((prev) => {
      const updated = prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
      save(updated);
      return updated;
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress header */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {completedCount} of {totalCount} tasks completed
            </span>
            <SaveIndicator status={saveStatus} />
          </div>
          <span className="font-mono text-sm font-medium text-[var(--text-secondary)]">
            {progress}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <button
            key={i}
            onClick={() => toggleTask(i)}
            className={`flex w-full items-center gap-3 rounded-xl border px-5 py-3.5 text-left transition-all duration-200 ${
              task.done
                ? 'border-[var(--border)] bg-[var(--surface-raised)]'
                : 'border-[var(--border)] bg-[var(--surface-card)] hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                task.done
                  ? 'border-blue-500 bg-[var(--accent-primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-card)]'
              }`}
            >
              {task.done && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-sm ${
                task.done
                  ? 'text-[var(--text-tertiary)] line-through'
                  : 'font-medium text-[var(--text-primary)]'
              }`}
            >
              {task.label}
            </span>
          </button>
        ))}
      </div>

      {totalCount === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          No tasks have been added to this project yet.
        </div>
      )}
    </div>
  );
}

// ---- Notes Tab ----
function NotesTab({ project, workOrderId }: { project: ProjectDetail; workOrderId: string }) {
  const [notes] = useState<Note[]>(project.notes);
  const [newNote, setNewNote] = useState('');
  const [addSaveStatus, setAddSaveStatus] = useState<SaveStatus>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The internal_notes field is a single text string on the backend.
  // We concatenate notes with a separator so they persist as one field.
  // For the primary use-case, we treat internal_notes as the editable content area.
  const [internalNotes, setInternalNotes] = useState(
    project.notes.map((n) => n.text).join('\n\n') || '',
  );
  const { saveStatus: autoSaveStatus, save: autoSave } = useDebouncedSave(
    workOrderId,
    'internal_notes',
    1000,
  );

  const handleNotesChange = (value: string) => {
    setInternalNotes(value);
    autoSave(value);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const separator = internalNotes.trim() ? '\n\n' : '';
    const updatedNotes = newNote.trim() + separator + internalNotes;
    setInternalNotes(updatedNotes);
    setNewNote('');
    setAddSaveStatus('saving');

    try {
      await api.patch(`/api/work-orders/${workOrderId}`, {
        internal_notes: updatedNotes,
      });
      setAddSaveStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setAddSaveStatus('idle'), 2000);
    } catch {
      setAddSaveStatus('error');
    }
  };

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const displayStatus = addSaveStatus !== 'idle' ? addSaveStatus : autoSaveStatus;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Add note input */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none rounded-lg border-0 bg-[var(--surface-raised)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
        />
        <div className="mt-2 flex items-center justify-between">
          <SaveIndicator status={displayStatus} />
          <button
            onClick={addNote}
            disabled={!newNote.trim() || addSaveStatus === 'saving'}
            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add Note
          </button>
        </div>
      </div>

      {/* Editable notes area (auto-saved) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Internal Notes
          </span>
          <SaveIndicator status={autoSaveStatus} />
        </div>
        <textarea
          value={internalNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Type your notes here... changes are auto-saved."
          rows={8}
          className="w-full resize-none rounded-lg border-0 bg-[var(--surface-raised)] p-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
        />
      </div>

      {/* Legacy notes display (read-only, from initial load) */}
      {notes.length > 0 && notes[0].author !== 'System' && (
        <>
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Previous Notes
            </span>
          </div>
          {notes
            .filter((n) => n.author !== 'System')
            .map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-semibold text-blue-400">
                    {note.author.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {note.author}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {formatTimestamp(note.timestamp)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{note.text}</p>
              </div>
            ))}
        </>
      )}

      {notes.length === 0 && !internalNotes && (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          No notes yet. Add the first one above.
        </div>
      )}
    </div>
  );
}

// ---- Photo Section ----
function PhotoSection({
  label,
  photos,
  onCategoryChange,
  onCaptionChange,
  onDelete,
}: {
  label: string;
  photos: WorkOrderPhoto[];
  onCategoryChange: (id: string, type: 'before' | 'after' | null) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="aspect-square">
              <img
                src={photo.url}
                alt={photo.filename}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-2">
              <p className="truncate text-xs text-[var(--text-secondary)]">{photo.filename}</p>
              <Select
                value={photo.photo_type ?? ''}
                onChange={(v) => onCategoryChange(photo.id, (v || null) as 'before' | 'after' | null)}
                options={[
                  { value: '', label: 'Uncategorized' },
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                ]}
                size="sm"
              />
              <input
                type="text"
                defaultValue={photo.caption ?? ''}
                placeholder="Add caption..."
                onBlur={(e) => onCaptionChange(photo.id, e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                maxLength={500}
              />
            </div>
            <button
              onClick={() => onDelete(photo.id)}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Photos Tab ----
function PhotosTab({ workOrderId }: { workOrderId: string }) {
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = useCallback(async () => {
    try {
      const data = await api.get<{ photos: WorkOrderPhoto[] }>(
        `/api/work-orders/${workOrderId}/photos`,
      );
      setPhotos(data.photos);
    } catch {
      // Silently fail — empty state is fine
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const beforePhotos = photos.filter((p) => p.photo_type === 'before');
  const afterPhotos = photos.filter((p) => p.photo_type === 'after');
  const uncategorizedPhotos = photos.filter((p) => p.photo_type === null);

  const handleCategoryChange = async (photoId: string, photoType: 'before' | 'after' | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, photo_type: photoType } : p)));
    try {
      await api.patch(`/api/work-orders/${workOrderId}/photos/${photoId}`, { photo_type: photoType });
    } catch {
      fetchPhotos();
    }
  };

  const handleCaptionChange = async (photoId: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)));
    try {
      await api.patch(`/api/work-orders/${workOrderId}/photos/${photoId}`, { caption });
    } catch {
      fetchPhotos();
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    try {
      await api.delete(`/api/work-orders/${workOrderId}/photos/${photoId}`);
    } catch {
      fetchPhotos();
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">Loading photos...</div>;
  }

  return (
    <div className="space-y-8">
      <PhotoUploadZone workOrderId={workOrderId} onUploadComplete={fetchPhotos} />

      {beforePhotos.length > 0 && (
        <PhotoSection
          label="Before"
          photos={beforePhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}
      {afterPhotos.length > 0 && (
        <PhotoSection
          label="After"
          photos={afterPhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}
      {uncategorizedPhotos.length > 0 && (
        <PhotoSection
          label="Uncategorized"
          photos={uncategorizedPhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}

      {photos.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          No photos uploaded yet.
        </div>
      )}
    </div>
  );
}

// ---- Timeline Tab ----
function TimelineTab({ project }: { project: ProjectDetail }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-[var(--surface-raised)]" />

        <div className="space-y-6">
          {[...project.statusHistory].reverse().map((entry, i) => {
            const dotColor = statusColors[entry.status] ?? '#6b7280';
            return (
              <div key={i} className="relative flex gap-4 pl-0">
                <div
                  className="z-10 mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-4 border-[var(--border-subtle)]"
                  style={{ backgroundColor: dotColor }}
                >
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {entry.status}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Changed by{' '}
                    <span className="font-medium text-[var(--text-primary)]">
                      {entry.changedBy}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {project.statusHistory.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          No status history available.
        </div>
      )}
    </div>
  );
}

// ---- Main Page Component ----
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wo = await api.get<ApiWorkOrderResponse>(`/api/work-orders/${id}`);
      setWorkOrderId(wo.id);
      setProject(transformWorkOrderToProject(wo));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Project not found');
      } else {
        const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) return <LoadingSkeleton />;

  if (error || !project) {
    return (
      <ErrorState
        message={error ?? `No detail data available for project ${id}`}
        onRetry={fetchProject}
        onBack={() => router.push('/dashboard')}
      />
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'notes', label: 'Notes' },
    { key: 'photos', label: 'Photos' },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Projects
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{project.name}</h1>
            <span className="rounded-md bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
              {project.id}
            </span>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${priorityColors[project.priority]}`}
              title={`${priorityLabels[project.priority]} priority`}
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--text-secondary)]">{project.client}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {formatCurrency(project.value)}
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="mt-4">
          <StepsIndicator history={project.statusHistory} />
        </div>
      </header>

      {/* Tab navigation */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'checklist' && <ChecklistTab project={project} workOrderId={workOrderId} />}
        {activeTab === 'notes' && <NotesTab project={project} workOrderId={workOrderId} />}
        {activeTab === 'photos' && <PhotosTab workOrderId={workOrderId} />}
        {activeTab === 'timeline' && <TimelineTab project={project} />}
      </div>
    </div>
  );
}

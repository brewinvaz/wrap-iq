'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { mockProjectDetails } from '@/lib/mock-project-detail';
import { ProjectDetail, Note, ProjectPhoto } from '@/lib/types';

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
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

// ---- Field Row Component ----
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-36 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
        {label}
      </span>
      <span className="text-sm text-[#18181b]">{value}</span>
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
    <div className="rounded-xl border border-[#e6e6eb] bg-white">
      <div className="border-b border-[#e6e6eb] px-5 py-3">
        <h3 className="text-sm font-semibold text-[#18181b]">{title}</h3>
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
                  isCompleted ? 'bg-[#18181b]' : 'bg-[#e6e6eb]'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold ${
                  isCompleted || isCurrent
                    ? 'text-white'
                    : 'border border-[#e6e6eb] bg-white text-[#a8a8b4]'
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
                    ? 'text-[#18181b]'
                    : 'text-[#a8a8b4]'
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
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
            Revenue
          </p>
          <p className="mt-1 text-2xl font-bold text-[#18181b]">
            {formatCurrency(project.revenue)}
          </p>
        </div>
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
            Cost
          </p>
          <p className="mt-1 text-2xl font-bold text-[#18181b]">
            {formatCurrency(project.cost)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600">
            Margin
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
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

        {/* Design */}
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

        {/* Production */}
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
          <div className="mt-3 border-t border-[#e6e6eb] pt-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
              Time Logs
            </p>
            <div className="space-y-1.5">
              {project.installDetails.timeLogs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-[#18181b]">
                    {log.installer}
                  </span>
                  <span className="text-[#60606a]">{log.task}</span>
                  <span className="font-mono text-[#18181b]">{log.hours}h</span>
                </div>
              ))}
            </div>
          </div>
        </InfoCard>

        {/* Hours */}
        <InfoCard title="Hours Tracking">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
                Estimated
              </p>
              <p className="mt-1 text-xl font-bold text-[#18181b]">
                {project.estimatedHours}h
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
                Actual
              </p>
              <p className="mt-1 text-xl font-bold text-[#18181b]">
                {project.actualHours}h
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-[#60606a]">
              <span>Progress</span>
              <span>
                {Math.round((project.actualHours / project.estimatedHours) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    (project.actualHours / project.estimatedHours) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Team */}
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
              <span className="text-[11px] text-[#60606a]">{member.initials}</span>
            </div>
          ))}
        </div>
      </InfoCard>
    </div>
  );
}

// ---- Checklist Tab ----
function ChecklistTab({ project }: { project: ProjectDetail }) {
  const [tasks, setTasks] = useState(project.tasks ?? []);
  const completedCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleTask = (index: number) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t))
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress header */}
      <div className="mb-6 rounded-xl border border-[#e6e6eb] bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#18181b]">
            {completedCount} of {totalCount} tasks completed
          </span>
          <span className="font-mono text-sm font-medium text-[#60606a]">
            {progress}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
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
                ? 'border-[#e6e6eb] bg-gray-50'
                : 'border-[#e6e6eb] bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                task.done
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-[#e6e6eb] bg-white'
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
                  ? 'text-[#a8a8b4] line-through'
                  : 'font-medium text-[#18181b]'
              }`}
            >
              {task.label}
            </span>
          </button>
        ))}
      </div>

      {totalCount === 0 && (
        <div className="py-12 text-center text-sm text-[#a8a8b4]">
          No tasks have been added to this project yet.
        </div>
      )}
    </div>
  );
}

// ---- Notes Tab ----
function NotesTab({ project }: { project: ProjectDetail }) {
  const [notes, setNotes] = useState<Note[]>(project.notes);
  const [newNote, setNewNote] = useState('');

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: `n${Date.now()}`,
      text: newNote.trim(),
      author: 'You',
      timestamp: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setNewNote('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Add note input */}
      <div className="rounded-xl border border-[#e6e6eb] bg-white p-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none rounded-lg border-0 bg-gray-50 p-3 text-sm text-[#18181b] placeholder-[#a8a8b4] outline-none focus:ring-2 focus:ring-blue-200"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={!newNote.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-xl border border-[#e6e6eb] bg-white p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
              {note.author.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[#18181b]">
              {note.author}
            </span>
            <span className="text-xs text-[#a8a8b4]">
              {formatTimestamp(note.timestamp)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#60606a]">{note.text}</p>
        </div>
      ))}

      {notes.length === 0 && (
        <div className="py-12 text-center text-sm text-[#a8a8b4]">
          No notes yet. Add the first one above.
        </div>
      )}
    </div>
  );
}

// ---- Photo Grid ----
function PhotoGrid({
  photos,
  label,
}: {
  photos: ProjectPhoto[];
  label: string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#a8a8b4]">
        {label}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <div
            key={i}
            className="group overflow-hidden rounded-xl border border-[#e6e6eb] bg-white"
          >
            <div className="flex h-40 items-center justify-center bg-gray-100 text-sm text-[#a8a8b4]">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
            {photo.caption && (
              <div className="px-3 py-2">
                <p className="text-xs text-[#60606a]">{photo.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Photos Tab ----
function PhotosTab({ project }: { project: ProjectDetail }) {
  const beforePhotos = project.photos.filter((p) => p.type === 'before');
  const afterPhotos = project.photos.filter((p) => p.type === 'after');

  return (
    <div className="space-y-8">
      {beforePhotos.length > 0 && (
        <PhotoGrid photos={beforePhotos} label="Before" />
      )}
      {afterPhotos.length > 0 && (
        <PhotoGrid photos={afterPhotos} label="After" />
      )}

      {/* Upload zone placeholder */}
      <div className="rounded-xl border-2 border-dashed border-[#e6e6eb] bg-white p-10 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/30">
        <svg
          className="mx-auto mb-3 h-10 w-10 text-[#a8a8b4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        <p className="text-sm font-medium text-[#60606a]">
          Drop photos here or click to upload
        </p>
        <p className="mt-1 text-xs text-[#a8a8b4]">
          PNG, JPG up to 10MB
        </p>
      </div>

      {project.photos.length === 0 && (
        <div className="py-12 text-center text-sm text-[#a8a8b4]">
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
        <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-[#e6e6eb]" />

        <div className="space-y-6">
          {[...project.statusHistory].reverse().map((entry, i) => {
            const dotColor = statusColors[entry.status] ?? '#6b7280';
            return (
              <div key={i} className="relative flex gap-4 pl-0">
                <div
                  className="z-10 mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-4 border-[#f4f4f6]"
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
                <div className="rounded-xl border border-[#e6e6eb] bg-white px-5 py-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#18181b]">
                      {entry.status}
                    </span>
                    <span className="text-xs text-[#a8a8b4]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#60606a]">
                    Changed by{' '}
                    <span className="font-medium text-[#18181b]">
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
        <div className="py-12 text-center text-sm text-[#a8a8b4]">
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

  const project = mockProjectDetails[id];

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#18181b]">Project not found</p>
        <p className="text-sm text-[#60606a]">
          No detail data available for project {id}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
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
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[#60606a] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
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
            <h1 className="text-xl font-bold text-[#18181b]">{project.name}</h1>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-[#60606a]">
              {project.id}
            </span>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${priorityColors[project.priority]}`}
              title={`${priorityLabels[project.priority]} priority`}
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-[#60606a]">{project.client}</p>
            <p className="text-lg font-bold text-[#18181b]">
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
      <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600'
                  : 'text-[#60606a] hover:text-[#18181b]'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'checklist' && <ChecklistTab project={project} />}
        {activeTab === 'notes' && <NotesTab project={project} />}
        {activeTab === 'photos' && <PhotosTab project={project} />}
        {activeTab === 'timeline' && <TimelineTab project={project} />}
      </div>
    </div>
  );
}

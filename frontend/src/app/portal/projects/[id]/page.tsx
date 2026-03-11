'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const PHASES = [
  { key: 'lead', label: 'Lead / Quote', color: 'blue' },
  { key: 'design', label: 'Design', color: 'violet' },
  { key: 'production', label: 'Production', color: 'amber' },
  { key: 'install', label: 'Installation', color: 'emerald' },
  { key: 'completed', label: 'Completed', color: 'gray' },
];

interface TimelineEntry {
  phase: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
}

interface ProjectDetail {
  id: string;
  job_number: string;
  status: string;
  vehicle_summary: string;
  date_in: string | null;
  estimated_completion: string | null;
  progress_pct: number;
  status_timeline: TimelineEntry[];
  notes: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPhaseColorClasses(color: string, active: boolean, completed: boolean) {
  if (completed) {
    const map: Record<string, string> = {
      blue: 'border-blue-500 bg-blue-500',
      violet: 'border-violet-500 bg-violet-500',
      amber: 'border-amber-500 bg-amber-500',
      emerald: 'border-emerald-500 bg-emerald-500',
      gray: 'border-gray-400 bg-gray-400',
    };
    return map[color] ?? 'border-gray-400 bg-gray-400';
  }
  if (active) {
    const map: Record<string, string> = {
      blue: 'border-blue-500 bg-white',
      violet: 'border-violet-500 bg-white',
      amber: 'border-amber-500 bg-white',
      emerald: 'border-emerald-500 bg-white',
      gray: 'border-gray-400 bg-white',
    };
    return map[color] ?? 'border-gray-400 bg-white';
  }
  return 'border-[#e6e6eb] bg-white';
}

function getLineColor(completed: boolean) {
  return completed ? 'bg-blue-500' : 'bg-[#e6e6eb]';
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api
      .get<ProjectDetail>(`/api/portal/projects/${params.id}`)
      .then((data) => setProject(data))
      .catch((err) => {
        if (err.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message || 'Failed to load project');
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-500" />
      </div>
    );
  }

  if (notFound || (!project && !error)) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[#18181b]">Project not found</h2>
        <p className="mt-2 text-[14px] text-[#60606a]">
          The project you are looking for does not exist.
        </p>
        <Link href="/portal" className="mt-4 inline-block text-[14px] text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[#18181b]">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-[#60606a]">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-[14px] text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Build timeline using the backend data, with fallback to PHASES constant
  const timeline = project!.status_timeline.length > 0
    ? project!.status_timeline
    : PHASES.map((p) => ({ phase: p.key, label: p.label, completed: false, completed_at: null }));

  // Find current phase: first non-completed phase
  const currentPhaseIndex = timeline.findIndex((t) => !t.completed);
  const currentPhaseKey = currentPhaseIndex >= 0
    ? timeline[currentPhaseIndex].phase
    : timeline[timeline.length - 1]?.phase;

  return (
    <div>
      {/* Back link */}
      <Link
        href="/portal"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#60606a] hover:text-[#18181b]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to projects
      </Link>

      {/* Title */}
      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#a8a8b4]">
          {project!.job_number}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#18181b]">{project!.job_number}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column -- timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-[15px] font-semibold text-[#18181b]">Status Timeline</h2>
            <div className="space-y-0">
              {timeline.map((entry, idx) => {
                const phaseConfig = PHASES.find((p) => p.key === entry.phase);
                const color = phaseConfig?.color ?? 'gray';
                const isActive = entry.phase === currentPhaseKey;
                const isLast = idx === timeline.length - 1;

                return (
                  <div key={entry.phase} className="flex gap-4">
                    {/* Stepper dot and line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${getPhaseColorClasses(color, isActive, entry.completed)}`}
                      >
                        {entry.completed && (
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        {isActive && !entry.completed && (
                          <div className={`h-2.5 w-2.5 rounded-full ${color === 'blue' ? 'bg-blue-500' : color === 'violet' ? 'bg-violet-500' : color === 'amber' ? 'bg-amber-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`h-10 w-0.5 ${getLineColor(entry.completed && idx < (currentPhaseIndex >= 0 ? currentPhaseIndex : timeline.length))}`} />
                      )}
                    </div>

                    {/* Label and date */}
                    <div className="pb-10">
                      <p
                        className={`text-[14px] font-medium ${isActive || entry.completed ? 'text-[#18181b]' : 'text-[#a8a8b4]'}`}
                      >
                        {entry.label}
                      </p>
                      {entry.completed_at && (
                        <p className="mt-0.5 text-[12px] text-[#a8a8b4]">
                          {formatDate(entry.completed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column -- info cards */}
        <div className="space-y-4">
          {/* Vehicle info */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
              Vehicle
            </h3>
            <p className="text-[15px] font-medium text-[#18181b]">{project!.vehicle_summary}</p>
          </div>

          {/* Key dates */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
              Key Dates
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#60606a]">Date In</span>
                <span className="text-[13px] font-medium text-[#18181b]">{formatDate(project!.date_in)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#60606a]">Est. Completion</span>
                <span className="text-[13px] font-medium text-[#18181b]">{formatDate(project!.estimated_completion)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {project!.notes && (
            <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
                Notes
              </h3>
              <p className="text-[13px] leading-relaxed text-[#60606a]">{project!.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e6e6eb] bg-white px-4 py-3 text-[13px] font-medium text-[#60606a] shadow-sm transition-colors hover:bg-[#f4f4f6]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View Proofs
            </button>
            <button
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e6e6eb] bg-white px-4 py-3 text-[13px] font-medium text-[#60606a] shadow-sm transition-colors hover:bg-[#f4f4f6]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              View Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

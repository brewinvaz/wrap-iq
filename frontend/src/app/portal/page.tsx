'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

const PHASE_COLORS: Record<string, string> = {
  'Work Order': 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]',
  Design: 'bg-[var(--phase-design)]/15 text-[var(--phase-design)]',
  Production: 'bg-[var(--phase-production)]/15 text-[var(--phase-production)]',
  Install: 'bg-[var(--phase-install)]/15 text-[var(--phase-install)]',
  Complete: 'bg-[var(--phase-done)]/15 text-[var(--phase-done)]',
  'Lead / Quote': 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]',
  Installation: 'bg-[var(--phase-install)]/15 text-[var(--phase-install)]',
  Completed: 'bg-[var(--phase-done)]/15 text-[var(--phase-done)]',
};

const PROGRESS_COLORS: Record<string, string> = {
  'Work Order': 'bg-[var(--accent-primary)]',
  Design: 'bg-[var(--phase-design)]',
  Production: 'bg-[var(--phase-production)]',
  Install: 'bg-[var(--phase-install)]',
  Complete: 'bg-[var(--phase-done)]',
  'Lead / Quote': 'bg-[var(--accent-primary)]',
  Installation: 'bg-[var(--phase-install)]',
  Completed: 'bg-[var(--phase-done)]',
};

interface PortalProject {
  id: string;
  job_number: string;
  status: string;
  vehicle_summary: string;
  date_in: string | null;
  estimated_completion: string | null;
  progress_pct: number;
}

interface PortalProjectListResponse {
  items: PortalProject[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PortalDashboard() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PortalProjectListResponse>('/api/portal/projects')
      .then((data) => setProjects(data.items))
      .catch((err) => setError(err.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          Track the progress of your vehicle wrap projects.
        </p>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">No projects yet</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Your projects will appear here once they are created.
          </p>
        </div>
      )}

      {/* Project Cards */}
      {projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projects/${project.id}`}
              className="group rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    {project.job_number}
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                    {project.job_number}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PHASE_COLORS[project.status] ?? 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'}`}
                >
                  {project.status}
                </span>
              </div>

              {/* Vehicle */}
              <p className="mb-3 text-[13px] text-[var(--text-secondary)]">{project.vehicle_summary}</p>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Progress</span>
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">{project.progress_pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                  <div
                    className={`h-full rounded-full transition-all ${PROGRESS_COLORS[project.status] ?? 'bg-[var(--phase-done)]'}`}
                    style={{ width: `${project.progress_pct}%` }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                <span>In: {formatDate(project.date_in)}</span>
                <span>Est. Complete: {formatDate(project.estimated_completion)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

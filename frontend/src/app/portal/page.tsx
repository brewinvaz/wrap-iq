'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

const PHASE_COLORS: Record<string, string> = {
  'Work Order': 'bg-blue-100 text-blue-700',
  Design: 'bg-violet-100 text-violet-700',
  Production: 'bg-amber-100 text-amber-700',
  Install: 'bg-emerald-100 text-emerald-700',
  Complete: 'bg-gray-100 text-gray-600',
  // Backend may return different casing
  'Lead / Quote': 'bg-blue-100 text-blue-700',
  Installation: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-gray-100 text-gray-600',
};

const PROGRESS_COLORS: Record<string, string> = {
  'Work Order': 'bg-blue-500',
  Design: 'bg-violet-500',
  Production: 'bg-amber-500',
  Install: 'bg-emerald-500',
  Complete: 'bg-gray-400',
  'Lead / Quote': 'bg-blue-500',
  Installation: 'bg-emerald-500',
  Completed: 'bg-gray-400',
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-[#18181b]">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-[#60606a]">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181b]">Welcome back</h1>
        <p className="mt-1 text-[14px] text-[#60606a]">
          Track the progress of your vehicle wrap projects.
        </p>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium text-[#60606a]">No projects yet</p>
          <p className="mt-1 text-[13px] text-[#a8a8b4]">
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
              className="group rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#a8a8b4]">
                    {project.job_number}
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold text-[#18181b] group-hover:text-blue-600">
                    {project.job_number}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PHASE_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {project.status}
                </span>
              </div>

              {/* Vehicle */}
              <p className="mb-3 text-[13px] text-[#60606a]">{project.vehicle_summary}</p>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-[#a8a8b4]">Progress</span>
                  <span className="text-[11px] font-medium text-[#60606a]">{project.progress_pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f4f4f6]">
                  <div
                    className={`h-full rounded-full transition-all ${PROGRESS_COLORS[project.status] ?? 'bg-gray-400'}`}
                    style={{ width: `${project.progress_pct}%` }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-4 text-[11px] text-[#a8a8b4]">
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

import Link from 'next/link';

const PHASE_COLORS: Record<string, string> = {
  'Work Order': 'bg-blue-100 text-blue-700',
  Design: 'bg-violet-100 text-violet-700',
  Production: 'bg-amber-100 text-amber-700',
  Install: 'bg-emerald-100 text-emerald-700',
  Complete: 'bg-gray-100 text-gray-600',
};

const PROGRESS_COLORS: Record<string, string> = {
  'Work Order': 'bg-blue-500',
  Design: 'bg-violet-500',
  Production: 'bg-amber-500',
  Install: 'bg-emerald-500',
  Complete: 'bg-gray-400',
};

const MOCK_PROJECTS = [
  {
    id: '1',
    job_number: 'WO-2024-0042',
    name: 'Fleet Branding — Van #3',
    vehicle: '2024 Ford Transit 250',
    status: 'Design',
    progress: 35,
    date_in: '2026-02-28',
    estimated_completion: '2026-03-18',
  },
  {
    id: '2',
    job_number: 'WO-2024-0039',
    name: 'Box Truck Full Wrap',
    vehicle: '2023 Isuzu NPR-HD',
    status: 'Production',
    progress: 60,
    date_in: '2026-02-15',
    estimated_completion: '2026-03-12',
  },
  {
    id: '3',
    job_number: 'WO-2024-0036',
    name: 'Partial Wrap — Driver Side',
    vehicle: '2025 Ram ProMaster 1500',
    status: 'Install',
    progress: 85,
    date_in: '2026-02-01',
    estimated_completion: '2026-03-05',
  },
  {
    id: '4',
    job_number: 'WO-2024-0030',
    name: 'Color Change Wrap',
    vehicle: '2024 Tesla Model 3',
    status: 'Complete',
    progress: 100,
    date_in: '2026-01-10',
    estimated_completion: '2026-02-08',
  },
];

export default function PortalDashboard() {
  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181b]">Welcome back</h1>
        <p className="mt-1 text-[14px] text-[#60606a]">
          Track the progress of your vehicle wrap projects.
        </p>
      </div>

      {/* Project Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {MOCK_PROJECTS.map((project) => (
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
                  {project.name}
                </h3>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PHASE_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {project.status}
              </span>
            </div>

            {/* Vehicle */}
            <p className="mb-3 text-[13px] text-[#60606a]">{project.vehicle}</p>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-[#a8a8b4]">Progress</span>
                <span className="text-[11px] font-medium text-[#60606a]">{project.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f4f4f6]">
                <div
                  className={`h-full rounded-full transition-all ${PROGRESS_COLORS[project.status] ?? 'bg-gray-400'}`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-4 text-[11px] text-[#a8a8b4]">
              <span>In: {project.date_in}</span>
              <span>Est. Complete: {project.estimated_completion}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

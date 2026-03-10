import Link from 'next/link';

const PHASES = [
  { key: 'work_order', label: 'Work Order', color: 'blue' },
  { key: 'design', label: 'Design', color: 'violet' },
  { key: 'production', label: 'Production', color: 'amber' },
  { key: 'install', label: 'Install', color: 'emerald' },
  { key: 'complete', label: 'Complete', color: 'gray' },
];

const MOCK_PROJECTS: Record<
  string,
  {
    id: string;
    job_number: string;
    name: string;
    vehicle: string;
    vin: string;
    status: string;
    progress: number;
    date_in: string;
    estimated_completion: string;
    notes: string;
    current_phase: string;
    timeline: { phase: string; completed: boolean; date: string | null }[];
  }
> = {
  '1': {
    id: '1',
    job_number: 'WO-2024-0042',
    name: 'Fleet Branding — Van #3',
    vehicle: '2024 Ford Transit 250',
    vin: '1FTBW2CM0RKA12345',
    status: 'Design',
    progress: 35,
    date_in: '2026-02-28',
    estimated_completion: '2026-03-18',
    notes: 'Client requested matte finish. Proof revision 2 sent for approval.',
    current_phase: 'design',
    timeline: [
      { phase: 'work_order', completed: true, date: '2026-02-28' },
      { phase: 'design', completed: false, date: null },
      { phase: 'production', completed: false, date: null },
      { phase: 'install', completed: false, date: null },
      { phase: 'complete', completed: false, date: null },
    ],
  },
  '2': {
    id: '2',
    job_number: 'WO-2024-0039',
    name: 'Box Truck Full Wrap',
    vehicle: '2023 Isuzu NPR-HD',
    vin: 'JALC4W163P7000987',
    status: 'Production',
    progress: 60,
    date_in: '2026-02-15',
    estimated_completion: '2026-03-12',
    notes: 'Material ordered. Print scheduled for 03/08.',
    current_phase: 'production',
    timeline: [
      { phase: 'work_order', completed: true, date: '2026-02-15' },
      { phase: 'design', completed: true, date: '2026-02-22' },
      { phase: 'production', completed: false, date: null },
      { phase: 'install', completed: false, date: null },
      { phase: 'complete', completed: false, date: null },
    ],
  },
  '3': {
    id: '3',
    job_number: 'WO-2024-0036',
    name: 'Partial Wrap — Driver Side',
    vehicle: '2025 Ram ProMaster 1500',
    vin: '3C6MRVJG1SE123456',
    status: 'Install',
    progress: 85,
    date_in: '2026-02-01',
    estimated_completion: '2026-03-05',
    notes: 'Install in progress. Estimated 2 more days.',
    current_phase: 'install',
    timeline: [
      { phase: 'work_order', completed: true, date: '2026-02-01' },
      { phase: 'design', completed: true, date: '2026-02-08' },
      { phase: 'production', completed: true, date: '2026-02-20' },
      { phase: 'install', completed: false, date: null },
      { phase: 'complete', completed: false, date: null },
    ],
  },
  '4': {
    id: '4',
    job_number: 'WO-2024-0030',
    name: 'Color Change Wrap',
    vehicle: '2024 Tesla Model 3',
    vin: '5YJ3E1EA0RF654321',
    status: 'Complete',
    progress: 100,
    date_in: '2026-01-10',
    estimated_completion: '2026-02-08',
    notes: 'Job complete. Final photos uploaded.',
    current_phase: 'complete',
    timeline: [
      { phase: 'work_order', completed: true, date: '2026-01-10' },
      { phase: 'design', completed: true, date: '2026-01-17' },
      { phase: 'production', completed: true, date: '2026-01-28' },
      { phase: 'install', completed: true, date: '2026-02-05' },
      { phase: 'complete', completed: true, date: '2026-02-08' },
    ],
  },
};

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = MOCK_PROJECTS[id];

  if (!project) {
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

  const currentPhaseIndex = PHASES.findIndex((p) => p.key === project.current_phase);

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
          {project.job_number}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#18181b]">{project.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-[15px] font-semibold text-[#18181b]">Status Timeline</h2>
            <div className="space-y-0">
              {PHASES.map((phase, idx) => {
                const timelineEntry = project.timeline.find((t) => t.phase === phase.key);
                const completed = timelineEntry?.completed ?? false;
                const isActive = phase.key === project.current_phase;
                const isLast = idx === PHASES.length - 1;

                return (
                  <div key={phase.key} className="flex gap-4">
                    {/* Stepper dot and line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${getPhaseColorClasses(phase.color, isActive, completed)}`}
                      >
                        {completed && (
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        {isActive && !completed && (
                          <div className={`h-2.5 w-2.5 rounded-full ${phase.color === 'blue' ? 'bg-blue-500' : phase.color === 'violet' ? 'bg-violet-500' : phase.color === 'amber' ? 'bg-amber-500' : phase.color === 'emerald' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`h-10 w-0.5 ${getLineColor(completed && idx < currentPhaseIndex)}`} />
                      )}
                    </div>

                    {/* Label and date */}
                    <div className="pb-10">
                      <p
                        className={`text-[14px] font-medium ${isActive || completed ? 'text-[#18181b]' : 'text-[#a8a8b4]'}`}
                      >
                        {phase.label}
                      </p>
                      {timelineEntry?.date && (
                        <p className="mt-0.5 text-[12px] text-[#a8a8b4]">
                          {timelineEntry.date}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column — info cards */}
        <div className="space-y-4">
          {/* Vehicle info */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
              Vehicle
            </h3>
            <p className="text-[15px] font-medium text-[#18181b]">{project.vehicle}</p>
            <p className="mt-1 font-mono text-[12px] text-[#60606a]">{project.vin}</p>
          </div>

          {/* Key dates */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
              Key Dates
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#60606a]">Date In</span>
                <span className="text-[13px] font-medium text-[#18181b]">{project.date_in}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#60606a]">Est. Completion</span>
                <span className="text-[13px] font-medium text-[#18181b]">{project.estimated_completion}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {project.notes && (
            <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#a8a8b4]">
                Notes
              </h3>
              <p className="text-[13px] leading-relaxed text-[#60606a]">{project.notes}</p>
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

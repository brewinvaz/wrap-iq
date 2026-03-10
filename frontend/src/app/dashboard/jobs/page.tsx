'use client';

import { useState } from 'react';

type PhaseFilter = 'all' | 'work-order' | 'design' | 'production' | 'install';

interface Job {
  id: string;
  name: string;
  client: string;
  team: string;
  phase: 'work-order' | 'design' | 'production' | 'install';
  status: string;
  dueDate: string;
}

const jobs: Job[] = [
  { id: '1', name: 'Fleet Van #12 — Full Wrap', client: 'Metro Plumbing', team: 'Marcus, Taylor', phase: 'install', status: 'Scheduled', dueDate: '2026-03-11' },
  { id: '2', name: 'Box Truck — Partial Wrap', client: 'FastFreight Inc.', team: 'Sarah, Alex', phase: 'production', status: 'Printing', dueDate: '2026-03-12' },
  { id: '3', name: 'Sprinter — Color Change', client: 'CleanCo Services', team: 'Sarah', phase: 'design', status: 'In Revision', dueDate: '2026-03-13' },
  { id: '4', name: 'Sedan — Accent Kit', client: 'Elite Auto Group', team: 'Jordan', phase: 'design', status: 'Proof Sent', dueDate: '2026-03-14' },
  { id: '5', name: 'Trailer — Full Wrap', client: 'Skyline Moving', team: 'Marcus, Devon', phase: 'install', status: 'In Progress', dueDate: '2026-03-10' },
  { id: '6', name: 'SUV — Hood & Roof', client: 'Greenfield Lawn Care', team: 'Unassigned', phase: 'work-order', status: 'New', dueDate: '2026-03-15' },
  { id: '7', name: 'Pickup — Tailgate Wrap', client: 'Summit Electric', team: 'Alex', phase: 'production', status: 'Laminating', dueDate: '2026-03-12' },
  { id: '8', name: 'Cargo Van — Fleet Livery', client: 'BrightPath Logistics', team: 'Unassigned', phase: 'work-order', status: 'Estimate Sent', dueDate: '2026-03-16' },
];

const phaseStyles: Record<Job['phase'], { bg: string; text: string; label: string }> = {
  'work-order': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Work Order' },
  design: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Design' },
  production: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Production' },
  install: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Install' },
};

const tabs: { key: PhaseFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'work-order', label: 'Work Orders' },
  { key: 'design', label: 'Design' },
  { key: 'production', label: 'Production' },
  { key: 'install', label: 'Install' },
];

export default function JobsPage() {
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.phase === filter);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">All Jobs Board</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {jobs.length} jobs
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + New Job
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Job</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Team</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Phase</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const phase = phaseStyles[job.phase];
                return (
                  <tr key={job.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3 font-medium text-[#18181b]">{job.name}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.client}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.team}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${phase.bg} ${phase.text}`}>
                        {phase.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#60606a]">{job.status}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.dueDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

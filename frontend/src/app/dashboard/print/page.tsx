'use client';

import { useState } from 'react';

type PrintStatus = 'all' | 'queued' | 'printing' | 'laminating' | 'done';

interface PrintJob {
  id: string;
  jobName: string;
  client: string;
  material: string;
  size: string;
  status: 'queued' | 'printing' | 'laminating' | 'done';
  dueDate: string;
  priority: 'high' | 'normal' | 'low';
}

const printJobs: PrintJob[] = [
  { id: '1', jobName: 'Fleet Van #12 — Full Wrap', client: 'Metro Plumbing', material: '3M IJ180Cv3', size: '4\' x 25\'', status: 'printing', dueDate: '2026-03-11', priority: 'high' },
  { id: '2', jobName: 'Box Truck — Partial Wrap', client: 'FastFreight Inc.', material: 'Avery MPI 1105', size: '5\' x 20\'', status: 'queued', dueDate: '2026-03-12', priority: 'high' },
  { id: '3', jobName: 'Sprinter — Color Change', client: 'CleanCo Services', material: 'Avery SW900', size: '5\' x 30\'', status: 'laminating', dueDate: '2026-03-12', priority: 'normal' },
  { id: '4', jobName: 'Sedan — Accent Kit', client: 'Elite Auto Group', material: '3M IJ180Cv3', size: '2\' x 8\'', status: 'queued', dueDate: '2026-03-13', priority: 'normal' },
  { id: '5', jobName: 'Trailer — Full Wrap', client: 'Skyline Moving', material: 'Oracal 3951RA', size: '8\' x 50\'', status: 'done', dueDate: '2026-03-10', priority: 'low' },
  { id: '6', jobName: 'SUV — Hood & Roof', client: 'Greenfield Lawn Care', material: '3M IJ180Cv3', size: '3\' x 12\'', status: 'queued', dueDate: '2026-03-14', priority: 'normal' },
  { id: '7', jobName: 'Pickup — Tailgate Wrap', client: 'Summit Electric', material: 'Avery MPI 1105', size: '2\' x 6\'', status: 'done', dueDate: '2026-03-09', priority: 'low' },
];

const statusStyles: Record<PrintJob['status'], { bg: string; text: string; label: string }> = {
  queued: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Queued' },
  printing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Printing' },
  laminating: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Laminating' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Done' },
};

const priorityStyles: Record<PrintJob['priority'], string> = {
  high: 'text-rose-600',
  normal: 'text-[#60606a]',
  low: 'text-[#a8a8b4]',
};

export default function PrintPage() {
  const [filter, setFilter] = useState<PrintStatus>('all');

  const filtered = filter === 'all' ? printJobs : printJobs.filter((j) => j.status === filter);
  const tabs: { key: PrintStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: printJobs.length },
    { key: 'queued', label: 'Queued', count: printJobs.filter((j) => j.status === 'queued').length },
    { key: 'printing', label: 'Printing', count: printJobs.filter((j) => j.status === 'printing').length },
    { key: 'laminating', label: 'Laminating', count: printJobs.filter((j) => j.status === 'laminating').length },
    { key: 'done', label: 'Done', count: printJobs.filter((j) => j.status === 'done').length },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Print / Lamination Queue</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {printJobs.length} jobs
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + Add to Queue
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {tab.label} ({tab.count})
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
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Material</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Size</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const style = statusStyles[job.status];
                return (
                  <tr key={job.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3 font-medium text-[#18181b]">{job.jobName}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.client}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.material}</td>
                    <td className="px-4 py-3 text-[#60606a]">{job.size}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium capitalize ${priorityStyles[job.priority]}`}>
                      {job.priority}
                    </td>
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

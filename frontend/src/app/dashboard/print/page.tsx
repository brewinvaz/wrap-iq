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

const printJobs: PrintJob[] = [];

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
          <button
            disabled
            title="Coming soon"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          >
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V3.375" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#18181b]">No items in the print queue</p>
              <p className="mt-1 text-sm text-[#60606a]">Jobs requiring printing or lamination will appear here.</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

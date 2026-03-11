'use client';

import { useState } from 'react';

interface HoursEntry {
  id: string;
  date: string;
  job: string;
  task: string;
  hours: number;
}

export default function HoursPage() {
  const [hoursEntries] = useState<HoursEntry[]>([]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Design Hours</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {hoursEntries.length} entries
            </span>
          </div>
          <button
            disabled
            className="cursor-not-allowed rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            + Log Hours
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {hoursEntries.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="mb-4 text-[#d4d4d8]"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M12 6v6l4 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm text-[#a8a8b4]">
              No design hours logged yet. Time entries will appear here as designers log their work.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#e6e6eb] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e6e6eb]">
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Date</th>
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Job</th>
                  <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Task</th>
                  <th className="px-4 py-3 text-right font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Hours</th>
                </tr>
              </thead>
              <tbody>
                {hoursEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#e6e6eb] last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-[#60606a]">{entry.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#18181b]">{entry.job}</td>
                    <td className="px-4 py-3 text-sm text-[#60606a]">{entry.task}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#18181b]">
                      {entry.hours.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

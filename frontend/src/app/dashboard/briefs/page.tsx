'use client';

import { useState } from 'react';

interface Brief {
  id: string;
  jobName: string;
  client: string;
  status: string;
  dueDate: string;
  vehicleInfo: string;
  wrapType: string;
  specialInstructions: string;
}

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-violet-100 text-violet-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

export default function BriefsPage() {
  const [briefs] = useState<Brief[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Job Briefs</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {briefs.length} briefs
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {briefs.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="mb-4 text-[#d4d4d8]"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="9"
                y="3"
                width="6"
                height="4"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M9 12h6M9 16h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm text-[#a8a8b4]">
              No job briefs yet. Briefs will appear here when created for projects.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => {
              const isExpanded = expandedId === brief.id;
              return (
                <div
                  key={brief.id}
                  className="rounded-lg border border-[#e6e6eb] bg-white transition-shadow hover:shadow-sm"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : brief.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="shrink-0">
                        <svg
                          className={`h-4 w-4 text-[#a8a8b4] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#18181b]">{brief.jobName}</p>
                        <p className="mt-0.5 text-xs text-[#a8a8b4]">{brief.client}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[brief.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {brief.status}
                      </span>
                      <span className="font-mono text-xs text-[#a8a8b4]">Due {brief.dueDate}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#e6e6eb] bg-gray-50 px-5 py-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                            Vehicle / Surface
                          </p>
                          <p className="mt-1 text-sm text-[#18181b]">{brief.vehicleInfo}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                            Wrap Type
                          </p>
                          <p className="mt-1 text-sm text-[#18181b]">{brief.wrapType}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                            Due Date
                          </p>
                          <p className="mt-1 text-sm text-[#18181b]">{brief.dueDate}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                          Special Instructions
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[#60606a]">
                          {brief.specialInstructions}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

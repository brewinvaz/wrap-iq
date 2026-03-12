'use client';

import { useState } from 'react';

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-violet-100 text-violet-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const briefs = [
  {
    id: '1',
    jobName: 'MTA Bus Fleet Wrap - Route 42',
    client: 'Metro Transit Authority',
    status: 'In Progress',
    dueDate: '2026-03-18',
    vehicleInfo: '2024 New Flyer XD40 (40-ft transit bus)',
    wrapType: 'Full Wrap',
    specialInstructions: 'Must follow ADA signage clearance zones. Do not cover emergency exit markings. Use reflective vinyl for route numbers. Artwork must be approved by the city branding committee before print.',
  },
  {
    id: '2',
    jobName: 'Coastal Brewing Delivery Van',
    client: 'Coastal Brewing Co.',
    status: 'New',
    dueDate: '2026-03-22',
    vehicleInfo: '2025 Ford Transit 250 Cargo Van (High Roof)',
    wrapType: 'Full Wrap',
    specialInstructions: 'Client wants a "beach sunset" gradient background. Incorporate new seasonal IPA branding. Leave rear door handles and fuel cap unwrapped. Provide mockup from 3 angles before production.',
  },
  {
    id: '3',
    jobName: 'Summit Electric Service Trucks',
    client: 'Summit Electric',
    status: 'In Progress',
    dueDate: '2026-03-15',
    vehicleInfo: '2024 Ram ProMaster 1500 (x3 units)',
    wrapType: 'Partial Wrap',
    specialInstructions: 'Fleet of 3 identical trucks. Partial wrap covering sides and rear only. Use brand yellow (#FFD700) as primary. Include 24/7 emergency number in large text on both sides. License and DOT number placement required.',
  },
  {
    id: '4',
    jobName: 'Jade Garden Restaurant Signage',
    client: 'Jade Garden Restaurant',
    status: 'Completed',
    dueDate: '2026-03-05',
    vehicleInfo: 'N/A — Wall-mounted signage panel (8ft x 4ft)',
    wrapType: 'Printed Panel',
    specialInstructions: 'Exterior-grade laminate required. Design must include updated menu highlights and QR code to online ordering. Use waterproof substrate for outdoor installation.',
  },
  {
    id: '5',
    jobName: 'MTA Light Rail Station Graphics',
    client: 'Metro Transit Authority',
    status: 'New',
    dueDate: '2026-03-28',
    vehicleInfo: 'N/A — Station platform panels (12 panels, 6ft x 3ft each)',
    wrapType: 'Wall Graphics',
    specialInstructions: 'Anti-graffiti laminate required. Each panel features a different neighborhood landmark. Must coordinate with station architecture team for exact dimensions. Install window is overnight only.',
  },
  {
    id: '6',
    jobName: 'Coastal Brewing Trailer Wrap',
    client: 'Coastal Brewing Co.',
    status: 'New',
    dueDate: '2026-04-02',
    vehicleInfo: '2023 Utility Trailer 53-ft Reefer',
    wrapType: 'Full Wrap',
    specialInstructions: 'Large-scale trailer wrap for trade show presence. Feature all 4 flagship beers. Include social media handles prominently. Riveted panels — need special adhesive vinyl for textured surface.',
  },
];

export default function BriefsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Job Briefs</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {briefs.length} briefs
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-3">
          {briefs.map((brief) => {
            const isExpanded = expandedId === brief.id;
            return (
              <div
                key={brief.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] transition-shadow hover:shadow-sm"
              >
                {/* Brief header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : brief.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0">
                      <svg
                        className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{brief.jobName}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{brief.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[brief.status] ?? 'bg-[var(--surface-app)] text-[var(--text-secondary)]'}`}
                    >
                      {brief.status}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-muted)]">Due {brief.dueDate}</span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-app)] px-5 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
                          Vehicle / Surface
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-primary)]">{brief.vehicleInfo}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
                          Wrap Type
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-primary)]">{brief.wrapType}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
                          Due Date
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-primary)]">{brief.dueDate}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
                        Special Instructions
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {brief.specialInstructions}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

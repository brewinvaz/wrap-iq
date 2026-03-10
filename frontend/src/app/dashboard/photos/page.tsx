'use client';

import { useState } from 'react';

interface Photo {
  id: string;
  label: string;
  timestamp: string;
}

interface PhotoGroup {
  id: string;
  jobName: string;
  vehicle: string;
  date: string;
  photos: Photo[];
}

const MOCK_PHOTO_GROUPS: PhotoGroup[] = [
  {
    id: 'g1',
    jobName: 'Marcus Rivera — Full Body PPF',
    vehicle: '2024 BMW M4',
    date: 'Mar 7, 2026',
    photos: [
      { id: 'p1', label: 'Hood — Before', timestamp: '8:12 AM' },
      { id: 'p2', label: 'Hood — After', timestamp: '11:45 AM' },
      { id: 'p3', label: 'Front Bumper — Before', timestamp: '8:14 AM' },
      { id: 'p4', label: 'Front Bumper — After', timestamp: '12:10 PM' },
      { id: 'p5', label: 'Driver Fender', timestamp: '9:30 AM' },
    ],
  },
  {
    id: 'g2',
    jobName: 'Sophia Chen — Partial Wrap',
    vehicle: '2023 Tesla Model Y',
    date: 'Mar 6, 2026',
    photos: [
      { id: 'p6', label: 'Roof Panel — Before', timestamp: '9:05 AM' },
      { id: 'p7', label: 'Roof Panel — After', timestamp: '10:50 AM' },
      { id: 'p8', label: 'A-Pillars', timestamp: '11:00 AM' },
    ],
  },
  {
    id: 'g3',
    jobName: 'David Park — Full Body PPF',
    vehicle: '2024 Porsche 911 GT3',
    date: 'Mar 5, 2026',
    photos: [
      { id: 'p9', label: 'Full Vehicle — Before', timestamp: '8:00 AM' },
      { id: 'p10', label: 'Hood Detail', timestamp: '10:15 AM' },
      { id: 'p11', label: 'Rear Quarter — After', timestamp: '3:40 PM' },
      { id: 'p12', label: 'Final Inspection', timestamp: '4:55 PM' },
    ],
  },
  {
    id: 'g4',
    jobName: 'Elena Vasquez — Accent Package',
    vehicle: '2023 Mercedes G-Wagon',
    date: 'Mar 4, 2026',
    photos: [
      { id: 'p13', label: 'Mirror Caps — Before', timestamp: '8:30 AM' },
      { id: 'p14', label: 'Mirror Caps — After', timestamp: '9:15 AM' },
    ],
  },
];

const PLACEHOLDER_COLORS = [
  'bg-slate-200',
  'bg-blue-100',
  'bg-violet-100',
  'bg-emerald-100',
  'bg-amber-100',
  'bg-rose-100',
];

function getPlaceholderColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export default function PhotosPage() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    MOCK_PHOTO_GROUPS[0].id,
  );

  const totalPhotos = MOCK_PHOTO_GROUPS.reduce(
    (sum, g) => sum + g.photos.length,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Job Photos</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {totalPhotos} photos
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + Upload Photos
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {MOCK_PHOTO_GROUPS.map((group) => {
            const isExpanded = expandedGroup === group.id;
            return (
              <div
                key={group.id}
                className="rounded-lg border border-[#e6e6eb] bg-white"
              >
                {/* Group header */}
                <button
                  onClick={() =>
                    setExpandedGroup(isExpanded ? null : group.id)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#18181b]">
                        {group.jobName}
                      </p>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {group.photos.length} photos
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#60606a]">
                      {group.vehicle} &middot; {group.date}
                    </p>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 16 16"
                    className={`shrink-0 text-[#a8a8b4] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* Photo grid */}
                {isExpanded && (
                  <div className="border-t border-[#e6e6eb] px-5 py-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {group.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="group cursor-pointer overflow-hidden rounded-lg border border-[#e6e6eb] transition-shadow hover:shadow-md"
                        >
                          {/* Placeholder thumbnail */}
                          <div
                            className={`flex aspect-square items-center justify-center ${getPlaceholderColor(photo.id)}`}
                          >
                            <svg
                              width="32"
                              height="32"
                              fill="none"
                              viewBox="0 0 24 24"
                              className="text-gray-400"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx="8.5"
                                cy="8.5"
                                r="1.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M21 15l-5-5L5 21"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="p-2">
                            <p className="truncate text-xs font-medium text-[#18181b]">
                              {photo.label}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-[#a8a8b4]">
                              {photo.timestamp}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Upload placeholder card */}
                      <div className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#e6e6eb] transition-colors hover:border-blue-300 hover:bg-blue-50/30">
                        <div className="py-8 text-center">
                          <svg
                            width="24"
                            height="24"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="mx-auto text-[#a8a8b4]"
                          >
                            <path
                              d="M12 5v14m-7-7h14"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <p className="mt-1 text-[10px] font-medium text-[#a8a8b4]">
                            Add Photo
                          </p>
                        </div>
                      </div>
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

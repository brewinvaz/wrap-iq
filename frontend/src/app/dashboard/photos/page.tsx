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

export default function PhotosPage() {
  const [photoGroups] = useState<PhotoGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const totalPhotos = photoGroups.reduce(
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
          <button
            disabled
            className="cursor-not-allowed rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            + Upload Photos
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {photoGroups.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="mb-4 text-[#d4d4d8]"
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
            <p className="text-sm text-[#a8a8b4]">
              No job photos yet. Photos will appear here as they are uploaded for work orders.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {photoGroups.map((group) => {
              const isExpanded = expandedGroup === group.id;
              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-[#e6e6eb] bg-white"
                >
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

                  {isExpanded && (
                    <div className="border-t border-[#e6e6eb] px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {group.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="group cursor-pointer overflow-hidden rounded-lg border border-[#e6e6eb] transition-shadow hover:shadow-md"
                          >
                            <div className="flex aspect-square items-center justify-center bg-slate-200">
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { WorkOrderPhoto } from '@/lib/types';

interface ApiVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface ApiWorkOrder {
  id: string;
  job_number: string;
  date_in: string;
  estimated_completion_date: string | null;
  vehicles: ApiVehicle[];
  client_name: string | null;
}

interface ApiWorkOrderListResponse {
  items: ApiWorkOrder[];
  total: number;
}

interface PhotoGroup {
  workOrder: ApiWorkOrder;
  photos: WorkOrderPhoto[];
}

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (vehicles.length === 0) return 'No vehicle';
  return vehicles
    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
    .join(', ');
}

export default function PhotosPage() {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const data = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
      const photoGroups: PhotoGroup[] = [];

      for (const wo of data.items) {
        try {
          const photos = await api.get<WorkOrderPhoto[]>(
            `/api/work-orders/${wo.id}/photos`,
          );
          if (photos.length > 0) {
            photoGroups.push({ workOrder: wo, photos });
          }
        } catch {
          // Skip work orders where photo fetch fails
        }
      }

      setGroups(photoGroups);
      if (photoGroups.length > 0) {
        setExpandedGroup(photoGroups[0].workOrder.id);
      }
    } catch {
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">Loading photos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Job Photos</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {totalPhotos} photos
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {groups.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">No job photos found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.workOrder.id;
              const dateLabel = group.workOrder.date_in
                ? new Date(group.workOrder.date_in).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '';
              return (
                <div
                  key={group.workOrder.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]"
                >
                  <button
                    onClick={() =>
                      setExpandedGroup(isExpanded ? null : group.workOrder.id)
                    }
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[var(--surface-overlay)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {group.workOrder.client_name ?? 'Unknown Client'} — #{group.workOrder.job_number}
                        </p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          {group.photos.length} photos
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {vehicleLabel(group.workOrder.vehicles)} &middot; {dateLabel}
                      </p>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 16 16"
                      className={`shrink-0 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                    <div className="border-t border-[var(--border)] px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {group.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="group cursor-pointer overflow-hidden rounded-lg border border-[var(--border)] transition-shadow hover:shadow-md"
                          >
                            {photo.url ? (
                              <div className="aspect-square overflow-hidden bg-[var(--surface-app)]">
                                <img
                                  src={photo.url}
                                  alt={photo.caption ?? photo.filename}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex aspect-square items-center justify-center bg-[var(--surface-app)]">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" className="text-[var(--text-muted)]">
                                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                                  <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                                {photo.caption ?? photo.filename}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1">
                                {photo.photo_type && (
                                  <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                                    photo.photo_type === 'before'
                                      ? 'bg-amber-500/10 text-amber-500'
                                      : 'bg-emerald-500/10 text-emerald-500'
                                  }`}>
                                    {photo.photo_type}
                                  </span>
                                )}
                                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                  {new Date(photo.created_at).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
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

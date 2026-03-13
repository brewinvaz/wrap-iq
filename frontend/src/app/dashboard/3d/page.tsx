'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';
import NewRenderModal from '@/components/renders/NewRenderModal';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

// --- API response types ---

interface RenderResponse {
  id: string;
  design_name: string;
  description: string | null;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  vehicle_photo_url: string;
  wrap_design_url: string;
  result_image_url: string | null;
  share_token: string | null;
  error_message: string | null;
  work_order_id: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface RenderListResponse {
  items: RenderResponse[];
  total: number;
}

// --- Styling maps ---

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-500/15', text: 'text-gray-700 dark:text-gray-400', label: 'Pending' },
  rendering: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'Rendering...' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completed' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', label: 'Failed' },
};

// --- Helper ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-overlay)]" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
              <div className="h-40 w-full animate-pulse bg-[var(--surface-raised)]" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-overlay)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-raised)]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-raised)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Lightbox ---

function RenderLightbox({
  render,
  onClose,
  onPrev,
  onNext,
}: {
  render: RenderResponse;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const modalRef = useModalAccessibility(true, onClose);
  const style = statusStyles[render.status] ?? statusStyles.pending;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Render: ${render.design_name}`}
    >
      <div
        ref={modalRef}
        className="relative flex h-full w-full flex-col"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close lightbox"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Prev / Next arrows */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Previous render"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Next render"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Image area */}
        <div className="flex flex-1 items-center justify-center px-16 pt-4">
          {render.result_image_url ? (
            <img
              src={render.result_image_url}
              alt={render.design_name}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : (
            <div className="flex h-64 w-96 items-center justify-center rounded-xl bg-white/5">
              <svg className="h-16 w-16 text-white/20" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
          )}
        </div>

        {/* Metadata panel — below the image */}
        <div className="shrink-0 border-t border-white/10 bg-black px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">{render.design_name}</h2>
                {render.description && (
                  <p className="mt-0.5 text-sm text-white/60">{render.description}</p>
                )}
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-white/50">
              {render.created_by_name && (
                <span>By {render.created_by_name}</span>
              )}
              <span>{formatDate(render.created_at)}</span>
              {render.updated_at !== render.created_at && (
                <span>Updated {formatDate(render.updated_at)}</span>
              )}
              {render.error_message && (
                <span className="text-red-400">Error: {render.error_message}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---

type FilterStatus = 'all' | 'rendering' | 'completed' | 'failed';
type ViewMode = 'grid' | 'table';

export default function ThreeDPage() {
  const [renders, setRenders] = useState<RenderResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showNewRender, setShowNewRender] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 12;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRenders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(page * limit), limit: String(limit) });
      if (filter !== 'all') params.set('status', filter);
      const data = await api.get<RenderListResponse>(`/api/renders?${params}`);
      setRenders(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load renders');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchRenders();
  }, [fetchRenders]);

  // Poll individual in-progress renders via detail endpoint
  useEffect(() => {
    const inProgress = renders.filter(
      (r) => r.status === 'pending' || r.status === 'rendering'
    );
    if (inProgress.length === 0) return;

    const startTime = Date.now();
    const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes

    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION) {
        clearInterval(interval);
        return;
      }
      try {
        const updates = await Promise.all(
          inProgress.map((r) => api.get<RenderResponse>(`/api/renders/${r.id}`))
        );
        setRenders((prev) =>
          prev.map((r) => {
            const updated = updates.find((u) => u.id === r.id);
            return updated ?? r;
          })
        );
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [renders]);

  const handleShare = async (id: string) => {
    try {
      const data = await api.post<{ share_url: string }>(`/api/renders/${id}/share`);
      await navigator.clipboard.writeText(data.share_url);
      showToast('Share link copied to clipboard!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to generate share link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this render?')) return;
    try {
      await api.delete(`/api/renders/${id}`);
      showToast('Render deleted');
      fetchRenders();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete render');
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      await api.post(`/api/renders/${id}/regenerate`);
      showToast('Render queued for regeneration');
      fetchRenders();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to regenerate render');
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && renders.length === 0) return <LoadingSkeleton />;

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'rendering', label: 'Rendering' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">3D Rendering</h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {total} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-[var(--surface-card)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === 'table' ? 'bg-[var(--surface-card)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16">
                  <line x1="2" y1="4" x2="14" y2="4" strokeLinecap="round" />
                  <line x1="2" y1="8" x2="14" y2="8" strokeLinecap="round" />
                  <line x1="2" y1="12" x2="14" y2="12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <Button onClick={() => setShowNewRender(true)}>
              + New Render
            </Button>
          </div>
        </div>
        {/* Filter tabs */}
        <div className="mt-3 flex gap-1">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <Button variant="danger" size="sm" onClick={fetchRenders} className="underline">
            Retry
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {renders.length === 0 && !loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <p className="text-sm font-medium text-[var(--text-primary)]">No renders yet</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Create your first 3D render to get started
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {renders.map((r, idx) => {
              const style = statusStyles[r.status] ?? statusStyles.pending;
              return (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)] transition-colors hover:border-[var(--accent-primary)]/30"
                >
                  {/* Thumbnail */}
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="w-full cursor-pointer text-left"
                    aria-label={`View ${r.design_name}`}
                  >
                    {r.result_image_url ? (
                      <img
                        src={r.result_image_url}
                        alt={r.design_name}
                        className="h-40 w-full object-cover transition-opacity hover:opacity-80"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[var(--surface-raised)] to-[var(--surface-overlay)] transition-opacity hover:opacity-80">
                        <div className="text-center">
                          <svg className="mx-auto h-10 w-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                          </svg>
                          <p className="mt-1 text-[10px] text-[var(--text-muted)]">3D Preview</p>
                        </div>
                      </div>
                    )}
                  </button>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{r.design_name}</h3>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    {r.created_by_name && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{r.created_by_name}</p>
                    )}
                    <p className="text-xs text-[var(--text-muted)]">{formatDate(r.created_at)}</p>
                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      {r.status === 'completed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleShare(r.id)}
                        >
                          Share
                        </Button>
                      )}
                      {(r.status === 'completed' || r.status === 'failed') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRegenerate(r.id)}
                        >
                          Regenerate
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(r.id)}
                        className="ml-auto"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Design</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Creator</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {renders.map((r, idx) => {
                  const style = statusStyles[r.status] ?? statusStyles.pending;
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-raised)]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setLightboxIndex(idx)}
                            className="shrink-0 cursor-pointer"
                            aria-label={`View ${r.design_name}`}
                          >
                            {r.result_image_url ? (
                              <img
                                src={r.result_image_url}
                                alt={r.design_name}
                                className="h-10 w-14 rounded object-cover transition-opacity hover:opacity-80"
                              />
                            ) : (
                              <div className="flex h-10 w-14 items-center justify-center rounded bg-gradient-to-br from-[var(--surface-raised)] to-[var(--surface-overlay)] transition-opacity hover:opacity-80">
                                <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                </svg>
                              </div>
                            )}
                          </button>
                          <span className="font-medium text-[var(--text-primary)]">{r.design_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{r.created_by_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.status === 'completed' && (
                            <button
                              onClick={() => handleShare(r.id)}
                              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
                            >
                              Share
                            </button>
                          )}
                          {(r.status === 'completed' || r.status === 'failed') && (
                            <button
                              onClick={() => handleRegenerate(r.id)}
                              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
                            >
                              Regenerate
                            </button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(r.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {lightboxIndex !== null && renders[lightboxIndex] && (
        <RenderLightbox
          render={renders[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : null}
          onNext={lightboxIndex < renders.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : null}
        />
      )}

      <NewRenderModal
        isOpen={showNewRender}
        onClose={() => setShowNewRender(false)}
        onCreate={() => { fetchRenders(); setToast('Render queued — processing will begin shortly'); }}
      />
    </div>
  );
}

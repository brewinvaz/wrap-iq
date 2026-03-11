'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

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
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
  rendering: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Rendering...' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },
};

// --- Helper ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
              <div className="h-40 w-full animate-pulse bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
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
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#18181b] px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">3D Rendering</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {total} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-[#a8a8b4] hover:text-[#60606a]'
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
                  viewMode === 'table' ? 'bg-white shadow-sm' : 'text-[#a8a8b4] hover:text-[#60606a]'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16">
                  <line x1="2" y1="4" x2="14" y2="4" strokeLinecap="round" />
                  <line x1="2" y1="8" x2="14" y2="8" strokeLinecap="round" />
                  <line x1="2" y1="12" x2="14" y2="12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setShowNewRender(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + New Render
            </button>
          </div>
        </div>
        {/* Filter tabs */}
        <div className="mt-3 flex gap-1">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={fetchRenders} className="text-sm font-medium text-red-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {renders.length === 0 && !loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[#e6e6eb] bg-white">
            <p className="text-sm font-medium text-[#18181b]">No renders yet</p>
            <p className="mt-1 text-xs text-[#60606a]">
              Create your first 3D render to get started
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {renders.map((r) => {
              const style = statusStyles[r.status] ?? statusStyles.pending;
              return (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white transition-colors hover:border-blue-200"
                >
                  {/* Thumbnail */}
                  {r.result_image_url ? (
                    <img
                      src={r.result_image_url}
                      alt={r.design_name}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#f4f4f6] to-[#e6e6eb]">
                      <div className="text-center">
                        <svg className="mx-auto h-10 w-10 text-[#a8a8b4]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                        </svg>
                        <p className="mt-1 text-[10px] text-[#a8a8b4]">3D Preview</p>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#18181b] leading-snug">{r.design_name}</h3>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    {r.created_by_name && (
                      <p className="mt-1 text-xs text-[#60606a]">{r.created_by_name}</p>
                    )}
                    <p className="text-xs text-[#a8a8b4]">{formatDate(r.created_at)}</p>
                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      {r.status === 'completed' && (
                        <button
                          onClick={() => handleShare(r.id)}
                          className="rounded-md border border-[#e6e6eb] px-2.5 py-1 text-[11px] font-medium text-[#60606a] transition-colors hover:bg-[#f4f4f6]"
                        >
                          Share
                        </button>
                      )}
                      {(r.status === 'completed' || r.status === 'failed') && (
                        <button
                          onClick={() => handleRegenerate(r.id)}
                          className="rounded-md border border-[#e6e6eb] px-2.5 py-1 text-[11px] font-medium text-[#60606a] transition-colors hover:bg-[#f4f4f6]"
                        >
                          Regenerate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="ml-auto rounded-md border border-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Design</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Creator</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {renders.map((r) => {
                  const style = statusStyles[r.status] ?? statusStyles.pending;
                  return (
                    <tr key={r.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.result_image_url ? (
                            <img
                              src={r.result_image_url}
                              alt={r.design_name}
                              className="h-10 w-14 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#f4f4f6] to-[#e6e6eb]">
                              <svg className="h-5 w-5 text-[#a8a8b4]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                              </svg>
                            </div>
                          )}
                          <span className="font-medium text-[#18181b]">{r.design_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{r.created_by_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.status === 'completed' && (
                            <button
                              onClick={() => handleShare(r.id)}
                              className="rounded-md border border-[#e6e6eb] px-2.5 py-1 text-[11px] font-medium text-[#60606a] transition-colors hover:bg-[#f4f4f6]"
                            >
                              Share
                            </button>
                          )}
                          {(r.status === 'completed' || r.status === 'failed') && (
                            <button
                              onClick={() => handleRegenerate(r.id)}
                              className="rounded-md border border-[#e6e6eb] px-2.5 py-1 text-[11px] font-medium text-[#60606a] transition-colors hover:bg-[#f4f4f6]"
                            >
                              Regenerate
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="rounded-md border border-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
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
            <p className="text-xs text-[#60606a]">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal placeholder — Task 8 will create the real modal component */}
      {showNewRender && <div>Modal placeholder</div>}
    </div>
  );
}

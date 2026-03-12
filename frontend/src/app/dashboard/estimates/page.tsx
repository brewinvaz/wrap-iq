'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';

interface EstimateResponse {
  id: string;
  estimate_number: string;
  client_name: string;
  client_email: string;
  status: string;
  subtotal: number;
  tax_rate: string;
  tax_amount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

interface EstimateListResponse {
  items: EstimateResponse[];
  total: number;
}

const statusStyle: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-50', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700' },
  viewed: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  accepted: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  declined: { bg: 'bg-rose-50', text: 'text-rose-700' },
  expired: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

const defaultStyle = { bg: 'bg-gray-50', text: 'text-gray-700' };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<EstimateResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await api.get<EstimateListResponse>(`/api/estimates${query}`);
      setEstimates(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load estimates');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  const pendingTotal = estimates
    .filter((e) => ['draft', 'sent', 'viewed'].includes(e.status))
    .reduce((sum, e) => sum + e.total, 0);

  const acceptedTotal = estimates
    .filter((e) => e.status === 'accepted')
    .reduce((sum, e) => sum + e.total, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Estimates</h1>
            {!loading && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                {total} total
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/financials"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Financials Overview
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">Total Estimates</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{total}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">Pending Value</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono">{formatCurrency(pendingTotal)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">Accepted Value</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 font-mono">{formatCurrency(acceptedTotal)}</p>
            </div>
          </div>
        )}

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-[#18181b] text-white'
                  : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--text-secondary)]">Loading estimates...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              onClick={fetchEstimates}
              className="mt-2 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && estimates.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--text-secondary)]">
              {statusFilter !== 'all'
                ? `No ${statusFilter} estimates found.`
                : 'No estimates yet. Create your first estimate to get started.'}
            </p>
          </div>
        )}

        {!loading && !error && estimates.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Estimate #</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => {
                  const s = statusStyle[est.status] ?? defaultStyle;
                  return (
                    <tr key={est.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{est.estimate_number}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{est.client_name}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)] font-mono">{formatCurrency(est.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {est.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{new Date(est.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {est.valid_until ? new Date(est.valid_until).toLocaleDateString() : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

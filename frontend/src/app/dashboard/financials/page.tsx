'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import CreateInvoiceModal from '@/components/financials/CreateInvoiceModal';

// --- API response types ---

interface InvoiceResponse {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  status: string;
  subtotal: number;
  tax_rate: string;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceListResponse {
  items: InvoiceResponse[];
  total: number;
}

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

// --- Helpers ---

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

// Build monthly summary from invoices (group by created_at month)
function buildMonthlySummary(invoices: InvoiceResponse[]) {
  const months: Record<string, { revenue: number; expenses: number }> = {};

  for (const inv of invoices) {
    const date = new Date(inv.created_at);
    const key = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    if (!months[key]) {
      months[key] = { revenue: 0, expenses: 0 };
    }
    if (inv.status === 'paid') {
      months[key].revenue += inv.total;
    }
  }

  // Sort by date (most recent last) and take last 3 months
  const entries = Object.entries(months)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-3);

  return entries.map(([month, data]) => ({
    month: month.split(' ')[0], // Just the month abbreviation
    revenue: data.revenue,
    expenses: 0, // expenses not tracked via invoices
  }));
}

const statusStyle: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-50', text: 'text-gray-600' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700' },
  viewed: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  partial: { bg: 'bg-orange-50', text: 'text-orange-700' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700' },
  void: { bg: 'bg-gray-50', text: 'text-gray-500' },
};

const defaultStatus = { bg: 'bg-gray-50', text: 'text-gray-600' };

export default function FinancialsPage() {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [estimates, setEstimates] = useState<EstimateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoiceData, estimateData] = await Promise.all([
        api.get<InvoiceListResponse>('/api/invoices'),
        api.get<EstimateListResponse>('/api/estimates'),
      ]);
      setInvoices(invoiceData.items);
      setEstimates(estimateData.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load financial data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleInvoiceCreated() {
    setIsCreateModalOpen(false);
    fetchData();
  }

  // Compute stats from real data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const mtdInvoices = invoices.filter((inv) => {
    const d = new Date(inv.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const revenueMtd = mtdInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const outstandingTotal = invoices
    .filter((inv) => ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.balance_due, 0);

  const outstandingCount = invoices.filter((inv) =>
    ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status),
  ).length;

  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const avgJobValue =
    paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((sum, inv) => sum + inv.total, 0) / paidInvoices.length)
      : 0;

  const pendingEstimates = estimates.filter((e) => ['draft', 'sent', 'viewed'].includes(e.status));
  const estimatesTotal = pendingEstimates.reduce((sum, e) => sum + e.total, 0);

  const stats = [
    {
      label: 'Revenue (MTD)',
      value: formatCurrency(revenueMtd),
      change: `${mtdInvoices.filter((i) => i.status === 'paid').length} paid`,
      up: true,
    },
    {
      label: 'Outstanding Invoices',
      value: formatCurrency(outstandingTotal),
      change: `${outstandingCount} pending`,
      up: false,
    },
    {
      label: 'Avg Job Value',
      value: formatCurrency(avgJobValue),
      change: `${paidInvoices.length} jobs`,
      up: true,
    },
    {
      label: 'Pending Estimates',
      value: formatCurrency(estimatesTotal),
      change: `${pendingEstimates.length} open`,
      up: false,
    },
  ];

  const monthlySummary = buildMonthlySummary(invoices);
  const maxRevenue = Math.max(...monthlySummary.map((m) => m.revenue), 1);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Financials</h1>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </header>
        <div className="flex-1 space-y-6 overflow-auto p-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
                <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[var(--surface-raised)]" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-[var(--surface-raised)]" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded-full bg-[var(--surface-raised)]" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-[var(--surface-raised)]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Financials</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Financials</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/estimates"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)]"
            >
              Estimates
            </Link>
            <Link
              href="/dashboard/invoices"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)]"
            >
              Invoices
            </Link>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              + New Invoice
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
              <p className={`mt-1 text-xs font-medium ${s.up ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>
                {s.change}
              </p>
            </div>
          ))}
        </div>

        {/* Monthly Summary */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Monthly Summary</h2>
          {monthlySummary.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--text-muted)]">No invoice data yet</p>
          ) : (
            <div className="space-y-3">
              {monthlySummary.map((m) => {
                const pct = Math.round((m.revenue / maxRevenue) * 100);
                return (
                  <div key={m.month} className="flex items-center gap-4">
                    <span className="w-8 text-sm font-medium text-[var(--text-secondary)]">{m.month}</span>
                    <div className="flex-1">
                      <div className="h-6 w-full rounded-full bg-[var(--surface-raised)]">
                        <div
                          className="flex h-6 items-center rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-3 text-xs font-medium text-white"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        >
                          <span className="font-mono">{formatCurrency(m.revenue)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Invoices</h2>
            <Link href="/dashboard/invoices" className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-secondary)]">
              View all
            </Link>
          </div>
          {invoices.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No invoices yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = statusStyle[inv.status] ?? defaultStatus;
                  return (
                    <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-overlay)]">
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{inv.client_name}</td>
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(inv.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Estimates */}
        {estimates.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Estimates</h2>
              <Link href="/dashboard/estimates" className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-secondary)]">
                View all
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Estimate</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Date</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => {
                  const s = statusStyle[est.status] ?? defaultStatus;
                  return (
                    <tr key={est.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-overlay)]">
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{est.estimate_number}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{est.client_name}</td>
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{formatCurrency(est.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {est.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(est.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleInvoiceCreated}
      />
    </div>
  );
}

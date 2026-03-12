'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';

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

const statusStyle: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-50', text: 'text-gray-600' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700' },
  viewed: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  partial: { bg: 'bg-orange-50', text: 'text-orange-700' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700' },
  void: { bg: 'bg-gray-50', text: 'text-gray-500' },
};

const defaultStyle = { bg: 'bg-gray-50', text: 'text-gray-600' };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await api.get<InvoiceListResponse>(`/api/invoices${query}`);
      setInvoices(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load invoices');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const outstandingTotal = invoices
    .filter((inv) => ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.balance_due, 0);

  const paidTotal = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Invoices</h1>
            {!loading && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                {total} total
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/financials"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)]"
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">Total Invoices</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{total}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">Outstanding</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(outstandingTotal)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <p className="text-xs text-[var(--text-muted)]">Paid</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{formatCurrency(paidTotal)}</p>
            </div>
          </div>
        )}

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
                  : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--text-secondary)]">Loading invoices...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              onClick={fetchInvoices}
              className="mt-2 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && invoices.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--text-secondary)]">
              {statusFilter !== 'all'
                ? `No ${statusFilter} invoices found.`
                : 'No invoices yet. Create your first invoice to get started.'}
            </p>
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Balance Due</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Created</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = statusStyle[inv.status] ?? defaultStyle;
                  return (
                    <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-overlay)]">
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{inv.client_name}</td>
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">{formatCurrency(inv.balance_due)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{new Date(inv.created_at).toLocaleDateString()}</td>
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

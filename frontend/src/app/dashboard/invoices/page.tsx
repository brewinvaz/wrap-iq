'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import DataTable, { type Column } from '@/components/ui/DataTable';
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
  draft: { bg: 'bg-[var(--surface-raised)]', text: 'text-[var(--text-secondary)]' },
  sent: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  viewed: { bg: 'bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400' },
  partial: { bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400' },
  paid: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  overdue: { bg: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-400' },
  void: { bg: 'bg-[var(--surface-raised)]', text: 'text-[var(--text-muted)]' },
};

const defaultStyle = { bg: 'bg-[var(--surface-raised)]', text: 'text-[var(--text-secondary)]' };

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

  const columns = useMemo<Column<InvoiceResponse>[]>(
    () => [
      {
        key: 'invoice_number',
        header: 'Invoice #',
        render: (row) => (
          <span className="font-medium text-[var(--text-primary)]">{row.invoice_number}</span>
        ),
      },
      {
        key: 'client_name',
        header: 'Client',
        render: (row) => (
          <span className="text-[var(--text-secondary)]">{row.client_name}</span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        render: (row) => (
          <span className="font-mono font-medium text-[var(--text-primary)]">
            {formatCurrency(row.total)}
          </span>
        ),
      },
      {
        key: 'balance_due',
        header: 'Balance Due',
        render: (row) => (
          <span className="font-mono font-medium text-[var(--text-primary)]">
            {formatCurrency(row.balance_due)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const s = statusStyle[row.status] ?? defaultStyle;
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}
            >
              {row.status}
            </span>
          );
        },
      },
      {
        key: 'due_date',
        header: 'Due Date',
        render: (row) => (
          <span className="text-[var(--text-secondary)]">
            {row.due_date ? new Date(row.due_date).toLocaleDateString() : '--'}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (
          <span className="text-[var(--text-secondary)]">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [],
  );

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
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Invoices</h1>
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
              <p className="text-xs text-[var(--text-muted)]">Total Invoices</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{total}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono">{formatCurrency(outstandingTotal)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px]">
              <p className="text-xs text-[var(--text-muted)]">Paid</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{formatCurrency(paidTotal)}</p>
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
                  ? 'bg-[var(--accent-primary)] text-white'
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
            <p className="text-sm text-[var(--text-secondary)]">Loading invoices...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-sm text-rose-400">{error}</p>
            <Button onClick={fetchInvoices} className="mt-2">
              Retry
            </Button>
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
          <DataTable<InvoiceResponse>
            columns={columns}
            data={invoices}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </div>
  );
}

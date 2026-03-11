'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import CreateInvoiceModal from '@/components/invoices/CreateInvoiceModal';

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

const fallbackStats = [
  { label: 'Revenue (MTD)', value: '$48,320', change: '+12.4%', up: true },
  { label: 'Outstanding Invoices', value: '$18,750', change: '6 pending', up: false },
  { label: 'Avg Job Value', value: '$3,210', change: '+5.2%', up: true },
  { label: 'Expenses (MTD)', value: '$22,180', change: '-3.1%', up: true },
];

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

const defaultStatusStyle = { bg: 'bg-gray-50', text: 'text-gray-600' };

export default function FinancialsPage() {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<InvoiceListResponse>('/api/invoices');
      setInvoices(data.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load invoices');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Compute stats from live data
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
    .filter((inv) => ['sent', 'viewed', 'partial', 'overdue', 'pending'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.balance_due, 0);

  const outstandingCount = invoices.filter((inv) =>
    ['sent', 'viewed', 'partial', 'overdue', 'pending'].includes(inv.status),
  ).length;

  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const avgJobValue =
    paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((sum, inv) => sum + inv.total, 0) / paidInvoices.length)
      : 0;

  const stats = invoices.length > 0
    ? [
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
          label: 'Total Invoices',
          value: String(invoices.length),
          change: `${mtdInvoices.length} this month`,
          up: true,
        },
      ]
    : fallbackStats;

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#18181b]">Financials</h1>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </header>
        <div className="flex-1 space-y-6 overflow-auto p-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#18181b]">Financials</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchInvoices}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Financials</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + New Invoice
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
              <p className="text-xs text-[#a8a8b4]">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#18181b]">{s.value}</p>
              <p className={`mt-1 text-xs font-medium ${s.up ? 'text-emerald-600' : 'text-[#60606a]'}`}>
                {s.change}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Invoices */}
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">Recent Invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[#a8a8b4]">No invoices yet. Click &quot;+ New Invoice&quot; to create one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = statusStyle[inv.status] ?? defaultStatusStyle;
                  return (
                    <tr key={inv.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                      <td className="px-4 py-3 font-medium text-[#18181b]">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-[#60606a]">{inv.client_name}</td>
                      <td className="px-4 py-3 font-medium text-[#18181b]">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{formatDate(inv.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={fetchInvoices}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';

interface PaymentPageData {
  invoice_number: string;
  client_name: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export default function PaymentPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PaymentPageData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/pay/${params.token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This payment link is invalid or has expired.');
          } else {
            setError('Something went wrong. Please try again later.');
          }
          return;
        }
        const json: PaymentPageData = await res.json();
        setData(json);
      } catch {
        setError('Unable to load invoice details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)]">
        <p className="text-[15px] text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)] px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
              <span className="font-mono text-xs font-bold text-white">WF</span>
            </div>
          </div>
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-8 shadow-sm">
            <p className="text-[15px] text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPaid = data.status === 'paid';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
            <span className="font-mono text-xs font-bold text-white">WF</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Invoice Payment
          </h1>
        </div>

        {/* Card */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">Invoice</span>
              <span className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">
                {data.invoice_number}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">Client</span>
              <span className="text-[14px] text-[var(--text-primary)]">{data.client_name}</span>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">Total</span>
              <span className="text-[14px] text-[var(--text-primary)]">{formatCents(data.total)}</span>
            </div>

            {data.amount_paid > 0 && (
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">Paid</span>
                <span className="text-[14px] text-green-400">{formatCents(data.amount_paid)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-2">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Amount Due</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {formatCents(data.balance_due)}
              </span>
            </div>

            {data.due_date && (
              <p className="text-[12px] text-[var(--text-secondary)]">
                Due by {new Date(data.due_date).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="mt-6">
            {isPaid ? (
              <div className="flex h-10 w-full items-center justify-center rounded-[10px] bg-green-500/10 text-[14px] font-medium text-green-400">
                This invoice has been paid in full
              </div>
            ) : (
              <div className="flex h-10 w-full items-center justify-center rounded-[10px] bg-[var(--accent-primary)]/10 text-[14px] font-medium text-[var(--accent-primary)]">
                Payment processing coming soon
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--text-muted)]">
          Powered by WrapFlow
        </p>
      </div>
    </div>
  );
}

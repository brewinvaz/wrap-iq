'use client';

import { useEffect, useState } from 'react';

interface Estimate {
  id: string;
  estimate_number: string;
  client_name: string;
  client_email: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  created_at: string;
  valid_until: string | null;
}

interface EstimateListResponse {
  items: Estimate[];
  total: number;
}

const statusStyle: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-50', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700' },
  accepted: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  declined: { bg: 'bg-rose-50', text: 'text-rose-700' },
  expired: { bg: 'bg-amber-50', text: 'text-amber-700' },
  converted: { bg: 'bg-violet-50', text: 'text-violet-700' },
};

const defaultStyle = { bg: 'bg-gray-50', text: 'text-gray-700' };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/estimates`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load estimates (${res.status})`);
        const data: EstimateListResponse = await res.json();
        setEstimates(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Estimates</h1>
            {!loading && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
                {total} total
              </span>
            )}
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + New Estimate
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#60606a]">Loading estimates...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        {!loading && !error && estimates.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#60606a]">No estimates yet. Create your first estimate to get started.</p>
          </div>
        )}

        {!loading && !error && estimates.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Estimate #</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-[#60606a]">Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => {
                  const s = statusStyle[est.status] || defaultStyle;
                  return (
                    <tr key={est.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                      <td className="px-4 py-3 font-medium text-[#18181b]">{est.estimate_number}</td>
                      <td className="px-4 py-3 text-[#60606a]">{est.client_name}</td>
                      <td className="px-4 py-3 font-medium text-[#18181b]">{formatCurrency(est.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                          {est.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#60606a]">{new Date(est.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[#60606a]">
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

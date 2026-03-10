'use client';

import { BillingInvoice } from '@/lib/types';

interface InvoiceTableProps {
  invoices: BillingInvoice[];
}

function statusBadge(status: BillingInvoice['status']) {
  const styles: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-red-50 text-red-700',
    refunded: 'bg-gray-100 text-[#60606a]',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
        <h2 className="text-base font-semibold text-[#18181b]">
          Billing History
        </h2>
        <p className="mt-4 text-sm text-[#60606a]">No invoices yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
      <h2 className="text-base font-semibold text-[#18181b]">
        Billing History
      </h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#e6e6eb]">
              <th className="pb-3 pr-4 font-medium text-[#60606a]">Invoice</th>
              <th className="pb-3 pr-4 font-medium text-[#60606a]">Date</th>
              <th className="pb-3 pr-4 font-medium text-[#60606a]">
                Description
              </th>
              <th className="pb-3 pr-4 font-medium text-[#60606a]">Amount</th>
              <th className="pb-3 font-medium text-[#60606a]">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-[#e6e6eb] last:border-0"
              >
                <td className="py-3 pr-4 font-medium text-[#18181b]">
                  {invoice.invoiceNumber}
                </td>
                <td className="py-3 pr-4 text-[#60606a]">
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-3 pr-4 text-[#60606a]">
                  {invoice.description}
                </td>
                <td className="py-3 pr-4 font-medium text-[#18181b]">
                  ${(invoice.amountCents / 100).toFixed(2)}
                </td>
                <td className="py-3">{statusBadge(invoice.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

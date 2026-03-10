'use client';

const stats = [
  { label: 'Revenue (MTD)', value: '$48,320', change: '+12.4%', up: true },
  { label: 'Outstanding Invoices', value: '$18,750', change: '6 pending', up: false },
  { label: 'Avg Job Value', value: '$3,210', change: '+5.2%', up: true },
  { label: 'Expenses (MTD)', value: '$22,180', change: '-3.1%', up: true },
];

const invoices = [
  { id: 'INV-1042', client: 'Metro Plumbing', amount: '$4,800', status: 'paid', date: '2026-03-08' },
  { id: 'INV-1041', client: 'FastFreight Inc.', amount: '$6,200', status: 'pending', date: '2026-03-06' },
  { id: 'INV-1040', client: 'CleanCo Services', amount: '$3,100', status: 'pending', date: '2026-03-05' },
  { id: 'INV-1039', client: 'Elite Auto Group', amount: '$1,850', status: 'paid', date: '2026-03-03' },
  { id: 'INV-1038', client: 'Skyline Moving', amount: '$8,500', status: 'overdue', date: '2026-02-25' },
  { id: 'INV-1037', client: 'Summit Electric', amount: '$2,400', status: 'paid', date: '2026-02-22' },
  { id: 'INV-1036', client: 'Greenfield Lawn Care', amount: '$1,900', status: 'paid', date: '2026-02-20' },
];

const monthlySummary = [
  { month: 'Jan', revenue: 41200, expenses: 19800 },
  { month: 'Feb', revenue: 45600, expenses: 21400 },
  { month: 'Mar', revenue: 48320, expenses: 22180 },
];

const statusStyle: Record<string, { bg: string; text: string }> = {
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

export default function FinancialsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Financials</h1>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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

        {/* Monthly Summary */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-[#18181b]">Monthly Summary</h2>
          <div className="space-y-3">
            {monthlySummary.map((m) => {
              const profit = m.revenue - m.expenses;
              const pct = Math.round((m.revenue / 50000) * 100);
              return (
                <div key={m.month} className="flex items-center gap-4">
                  <span className="w-8 text-sm font-medium text-[#60606a]">{m.month}</span>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-full bg-[#f4f4f6]">
                      <div
                        className="flex h-6 items-center rounded-full bg-blue-600 px-3 text-xs font-medium text-white"
                        style={{ width: `${pct}%` }}
                      >
                        ${(m.revenue / 1000).toFixed(1)}k
                      </div>
                    </div>
                  </div>
                  <span className="w-24 text-right text-xs text-emerald-600">
                    +${(profit / 1000).toFixed(1)}k profit
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">Recent Invoices</h2>
          </div>
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
                const s = statusStyle[inv.status];
                return (
                  <tr key={inv.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3 font-medium text-[#18181b]">{inv.id}</td>
                    <td className="px-4 py-3 text-[#60606a]">{inv.client}</td>
                    <td className="px-4 py-3 font-medium text-[#18181b]">{inv.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#60606a]">{inv.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

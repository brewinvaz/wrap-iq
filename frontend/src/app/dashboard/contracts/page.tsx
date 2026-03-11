'use client';

interface Document {
  id: string;
  name: string;
  client: string;
  type: 'contract' | 'invoice' | 'estimate';
  status: 'draft' | 'sent' | 'signed' | 'expired';
  date: string;
}

const documents: Document[] = [
  { id: '1', name: 'Full Wrap Service Agreement', client: 'Metro Plumbing', type: 'contract', status: 'signed', date: '2026-03-08' },
  { id: '2', name: 'Estimate — Box Truck Partial', client: 'FastFreight Inc.', type: 'estimate', status: 'sent', date: '2026-03-07' },
  { id: '3', name: 'Color Change Contract', client: 'CleanCo Services', type: 'contract', status: 'signed', date: '2026-03-05' },
  { id: '4', name: 'Invoice INV-1042', client: 'Metro Plumbing', type: 'invoice', status: 'sent', date: '2026-03-08' },
  { id: '5', name: 'Fleet Wrap Agreement (5 vehicles)', client: 'BrightPath Logistics', type: 'contract', status: 'draft', date: '2026-03-10' },
  { id: '6', name: 'Estimate — Tailgate Wrap', client: 'Summit Electric', type: 'estimate', status: 'signed', date: '2026-03-01' },
  { id: '7', name: 'Invoice INV-1038', client: 'Skyline Moving', type: 'invoice', status: 'expired', date: '2026-02-25' },
  { id: '8', name: 'Accent Kit Service Agreement', client: 'Elite Auto Group', type: 'contract', status: 'sent', date: '2026-03-09' },
];

const typeStyles: Record<Document['type'], { bg: string; text: string }> = {
  contract: { bg: 'bg-blue-50', text: 'text-blue-700' },
  invoice: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  estimate: { bg: 'bg-violet-50', text: 'text-violet-700' },
};

const statusStyles: Record<Document['status'], { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
  sent: { bg: 'bg-amber-50', text: 'text-amber-700' },
  signed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  expired: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

export default function ContractsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Contracts & Documents</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {documents.length} documents
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + Upload Document
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Document</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Client</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const ts = typeStyles[doc.type];
                const ss = statusStyles[doc.status];
                return (
                  <tr key={doc.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                    <td className="px-4 py-3 font-medium text-[#18181b]">{doc.name}</td>
                    <td className="px-4 py-3 text-[#60606a]">{doc.client}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ts.bg} ${ts.text}`}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ss.bg} ${ss.text}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#60606a]">{doc.date}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-medium text-blue-600 hover:text-blue-800">View</button>
                    </td>
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

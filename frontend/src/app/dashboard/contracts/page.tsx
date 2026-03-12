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
  contract: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  invoice: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  estimate: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
};

const statusStyles: Record<Document['status'], { bg: string; text: string }> = {
  draft: { bg: 'bg-[var(--surface-raised)]', text: 'text-[var(--text-secondary)]' },
  sent: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  signed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  expired: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
};

export default function ContractsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Contracts & Documents</h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
              {documents.length} documents
            </span>
          </div>
          <button className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90">
            + Upload Document
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Document</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Client</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const ts = typeStyles[doc.type];
                const ss = statusStyles[doc.status];
                return (
                  <tr key={doc.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-raised)]/50">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{doc.name}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{doc.client}</td>
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
                    <td className="px-4 py-3 text-[var(--text-muted)]">{doc.date}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80">View</button>
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

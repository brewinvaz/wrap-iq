'use client';

export default function ContractsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Contracts & Documents</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="text-[var(--text-muted)]">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">Contract management coming soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Contracts, invoices, and estimates will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

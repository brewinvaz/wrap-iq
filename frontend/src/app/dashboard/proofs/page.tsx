'use client';

export default function ProofsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Proof Approvals</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="text-[var(--text-muted)]">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">Design proofs coming soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Proof review and approval workflows will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

export default function BriefsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Job Briefs</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="text-[var(--text-muted)]">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">Job briefs coming soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Detailed job briefs with vehicle info and special instructions will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

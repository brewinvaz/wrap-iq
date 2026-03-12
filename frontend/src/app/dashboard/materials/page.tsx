'use client';

export default function MaterialsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Materials Inventory</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="text-[var(--text-muted)]">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">Materials tracking coming soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Inventory management and stock levels will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

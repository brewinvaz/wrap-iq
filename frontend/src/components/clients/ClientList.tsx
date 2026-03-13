'use client';

import { Client } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Repeat: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Fleet: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  New: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
};

interface ClientListProps {
  clients: Client[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (client: Client) => void;
}

export default function ClientList({
  clients,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
}: ClientListProps) {
  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-card)]">
      {/* Search */}
      <div className="border-b border-[var(--border)] p-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
          />
        </div>
        <p className="mt-2 font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
          {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Client entries */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((client) => {
          const isActive = client.id === selectedId;
          return (
            <button
              key={client.id}
              onClick={() => onSelect(client)}
              className={`flex w-full flex-col gap-1.5 border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
                isActive
                  ? 'border-r-2 border-r-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'hover:bg-[var(--surface-raised)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate text-sm font-semibold ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {client.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-[family-name:var(--font-dm-mono)] text-[10px] font-medium uppercase ${
                    client.type === 'business'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                      : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                  }`}
                >
                  {client.type}
                </span>
              </div>
              <p className="truncate font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
                {client.projectCount} project{client.projectCount !== 1 ? 's' : ''} &middot;{' '}
                {formatCurrency(client.totalSpent)}
              </p>
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        tagColors[tag] ?? 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No clients found.
          </div>
        )}
      </div>
    </div>
  );
}

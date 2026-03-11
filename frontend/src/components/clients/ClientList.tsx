'use client';

import { Client } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-700',
  Repeat: 'bg-emerald-100 text-emerald-700',
  Fleet: 'bg-blue-100 text-blue-700',
  New: 'bg-violet-100 text-violet-700',
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
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-[#e6e6eb] bg-white">
      {/* Search */}
      <div className="border-b border-[#e6e6eb] p-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
            className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-9 pr-3 text-sm text-[#18181b] placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <p className="mt-2 font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
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
              className={`flex w-full flex-col gap-1.5 border-b border-[#e6e6eb] px-4 py-3 text-left transition-colors ${
                isActive
                  ? 'border-r-2 border-r-blue-600 bg-blue-50/60'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate text-sm font-semibold ${
                    isActive ? 'text-blue-700' : 'text-[#18181b]'
                  }`}
                >
                  {client.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-[family-name:var(--font-dm-mono)] text-[10px] font-medium uppercase ${
                    client.type === 'business'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {client.type}
                </span>
              </div>
              <p className="truncate font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
                {client.projectCount} project{client.projectCount !== 1 ? 's' : ''} &middot;{' '}
                {formatCurrency(client.totalSpent)}
              </p>
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        tagColors[tag] ?? 'bg-gray-100 text-gray-600'
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
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No clients found.
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

const FILE_TYPE_COLORS: Record<string, string> = {
  AI: 'bg-orange-100 text-orange-700',
  PSD: 'bg-blue-100 text-blue-700',
  PDF: 'bg-red-100 text-red-700',
  PNG: 'bg-emerald-100 text-emerald-700',
  SVG: 'bg-violet-100 text-violet-700',
  TIFF: 'bg-amber-100 text-amber-700',
};

const brandFiles = [
  { id: '1', name: 'Logo Primary', client: 'Metro Transit Authority', type: 'AI', size: '4.2 MB', modified: '2026-03-08', thumbnail: '🟧' },
  { id: '2', name: 'Brand Guidelines v3', client: 'Metro Transit Authority', type: 'PDF', size: '12.8 MB', modified: '2026-03-05', thumbnail: '📕' },
  { id: '3', name: 'Fleet Wrap Template', client: 'Metro Transit Authority', type: 'PSD', size: '87.3 MB', modified: '2026-02-28', thumbnail: '🟦' },
  { id: '4', name: 'Logo Horizontal', client: 'Coastal Brewing Co.', type: 'AI', size: '2.1 MB', modified: '2026-03-07', thumbnail: '🟧' },
  { id: '5', name: 'Can Label Artwork', client: 'Coastal Brewing Co.', type: 'PSD', size: '45.6 MB', modified: '2026-03-01', thumbnail: '🟦' },
  { id: '6', name: 'Delivery Van Mockup', client: 'Coastal Brewing Co.', type: 'PNG', size: '8.9 MB', modified: '2026-02-25', thumbnail: '🟩' },
  { id: '7', name: 'Icon Set', client: 'Summit Electric', type: 'SVG', size: '1.3 MB', modified: '2026-03-09', thumbnail: '🟪' },
  { id: '8', name: 'Truck Wrap Design Final', client: 'Summit Electric', type: 'PSD', size: '112.4 MB', modified: '2026-03-06', thumbnail: '🟦' },
  { id: '9', name: 'Print-Ready Panel Layout', client: 'Summit Electric', type: 'TIFF', size: '156.7 MB', modified: '2026-02-20', thumbnail: '🟨' },
  { id: '10', name: 'Storefront Banner', client: 'Jade Garden Restaurant', type: 'AI', size: '6.5 MB', modified: '2026-03-04', thumbnail: '🟧' },
];

const clients = ['All Clients', ...Array.from(new Set(brandFiles.map((f) => f.client)))];
const fileTypes = ['All Types', ...Array.from(new Set(brandFiles.map((f) => f.type)))];

export default function BrandFilesPage() {
  const [clientFilter, setClientFilter] = useState('All Clients');
  const [typeFilter, setTypeFilter] = useState('All Types');

  const filtered = brandFiles.filter((f) => {
    if (clientFilter !== 'All Clients' && f.client !== clientFilter) return false;
    if (typeFilter !== 'All Types' && f.type !== typeFilter) return false;
    return true;
  });

  const clientGroups = filtered.reduce<Record<string, typeof brandFiles>>((acc, file) => {
    if (!acc[file.client]) acc[file.client] = [];
    acc[file.client].push(file);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Brand Files</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {filtered.length} files
            </span>
          </div>
          <button className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors">
            + Upload File
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--text-muted)]">
            Filter
          </span>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
          >
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
          >
            {fileTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {Object.entries(clientGroups).map(([client, files]) => (
          <section key={client}>
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {client}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-card)] transition-shadow hover:shadow-md"
                >
                  {/* Thumbnail area */}
                  <div className="flex h-32 items-center justify-center rounded-t-lg bg-[var(--surface-app)] text-4xl">
                    {file.thumbnail}
                  </div>
                  {/* File info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                        {file.name}
                      </p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${FILE_TYPE_COLORS[file.type] ?? 'bg-[var(--surface-app)] text-[var(--text-secondary)]'}`}
                      >
                        {file.type}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">{file.size}</span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">{file.modified}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {filtered.length === 0 && (
          <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
            No files match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

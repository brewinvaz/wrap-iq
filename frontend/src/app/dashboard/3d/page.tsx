'use client';

import { useState } from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

type RenderStatus = 'all' | 'rendering' | 'ready' | 'draft';

interface RenderPreview {
  id: string;
  vehicle: string;
  client: string;
  designName: string;
  status: 'rendering' | 'ready' | 'draft';
  views: number;
  updatedAt: string;
}

const renders: RenderPreview[] = [
  { id: '1', vehicle: '2024 Ford Transit', client: 'Metro Plumbing', designName: 'Fleet Branding v2', status: 'ready', views: 4, updatedAt: '2026-03-10' },
  { id: '2', vehicle: '2025 RAM ProMaster', client: 'CleanCo Services', designName: 'Color Change — Matte Blue', status: 'rendering', views: 0, updatedAt: '2026-03-10' },
  { id: '3', vehicle: '2024 Chevy Silverado', client: 'Summit Electric', designName: 'Tailgate Logo Wrap', status: 'ready', views: 2, updatedAt: '2026-03-09' },
  { id: '4', vehicle: '2024 Mercedes Sprinter', client: 'FastFreight Inc.', designName: 'Full Wrap — Side Panels', status: 'draft', views: 0, updatedAt: '2026-03-09' },
  { id: '5', vehicle: '2025 Toyota Tacoma', client: 'Greenfield Lawn Care', designName: 'Hood & Roof Accent', status: 'ready', views: 6, updatedAt: '2026-03-08' },
  { id: '6', vehicle: '2024 Ford E-450', client: 'Skyline Moving', designName: 'Full Box Truck Wrap', status: 'rendering', views: 0, updatedAt: '2026-03-08' },
];

const statusStyles: Record<RenderPreview['status'], { bg: string; text: string; label: string }> = {
  rendering: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Rendering...' },
  ready: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Ready' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
};

function NewRenderModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [designName, setDesignName] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [client, setClient] = useState('');
  const [notes, setNotes] = useState('');
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Placeholder: no backend endpoint exists yet for 3D renders.
    // When the backend is ready, submit payload here.
    alert('Render request submitted! This feature is coming soon.');
    setDesignName('');
    setVehicle('');
    setClient('');
    setNotes('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-render-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="new-render-title" className="text-lg font-semibold text-[#18181b]">
            New 3D Render
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          3D rendering backend is not yet available. This form is a placeholder for the upcoming feature.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="design-name"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Design Name
            </label>
            <input
              id="design-name"
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="e.g. Fleet Branding v2"
              required
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="vehicle"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Vehicle
            </label>
            <input
              id="vehicle"
              type="text"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g. 2024 Ford Transit"
              required
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="client-name"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Client
            </label>
            <input
              id="client-name"
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Metro Plumbing"
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="render-notes"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Notes
            </label>
            <textarea
              id="render-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about the render..."
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Create Render
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ThreeDPage() {
  const [filter, setFilter] = useState<RenderStatus>('all');
  const [showNewRender, setShowNewRender] = useState(false);
  const filtered = filter === 'all' ? renders : renders.filter((r) => r.status === filter);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">3D Rendering</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {renders.length} renders
            </span>
          </div>
          <button
            onClick={() => setShowNewRender(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + New Render
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {(['all', 'rendering', 'ready', 'draft'] as RenderStatus[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === key ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((r) => {
            const style = statusStyles[r.status];
            return (
              <div key={r.id} className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white transition-colors hover:border-blue-200">
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#f4f4f6] to-[#e6e6eb]">
                  <div className="text-center">
                    <span className="text-3xl">🧊</span>
                    <p className="mt-1 text-[10px] text-[#a8a8b4]">3D Preview</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#18181b]">{r.designName}</h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#60606a]">{r.vehicle}</p>
                  <p className="text-xs text-[#a8a8b4]">{r.client}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#a8a8b4]">
                    <span>{r.views} views</span>
                    <span>{r.updatedAt}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NewRenderModal isOpen={showNewRender} onClose={() => setShowNewRender(false)} />
    </div>
  );
}

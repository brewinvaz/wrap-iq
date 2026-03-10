'use client';

import { useState } from 'react';

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

export default function ThreeDPage() {
  const [filter, setFilter] = useState<RenderStatus>('all');
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
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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
    </div>
  );
}

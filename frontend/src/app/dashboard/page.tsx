'use client';

import { useState } from 'react';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import MetricsBar from '@/components/dashboard/MetricsBar';
import { topLevelKPIs } from '@/lib/mock-kpi-data';

type ViewMode = 'kanban' | 'list' | 'calendar';
type FilterMode = 'all' | 'my-jobs' | 'urgent';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filter, setFilter] = useState<FilterMode>('all');

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Projects</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              14 total
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-[#e6e6eb] bg-white px-3.5 py-2 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filter
            </button>
            <button className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Stats bar — reusable MetricsBar */}
      <MetricsBar metrics={topLevelKPIs.slice(0, 4)} />

      {/* View toggle and filters */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-[#e6e6eb] bg-white p-1">
          {(['kanban', 'list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-[#60606a] hover:bg-gray-50'
              } ${mode !== 'kanban' ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={mode !== 'kanban'}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {([
            { key: 'all', label: 'All' },
            { key: 'my-jobs', label: 'My Jobs' },
            { key: 'urgent', label: 'Urgent' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[#18181b] text-white'
                  : 'bg-white text-[#60606a] border border-[#e6e6eb] hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {viewMode === 'kanban' && <KanbanBoard />}
        {viewMode === 'list' && (
          <div className="flex items-center justify-center py-20 text-sm text-[#a8a8b4]">
            List view coming soon
          </div>
        )}
        {viewMode === 'calendar' && (
          <div className="flex items-center justify-center py-20 text-sm text-[#a8a8b4]">
            Calendar view coming soon
          </div>
        )}
      </div>
    </div>
  );
}

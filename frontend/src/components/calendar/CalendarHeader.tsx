'use client';

import { Installer } from '@/lib/types';

interface CalendarHeaderProps {
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  activeView: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  installers: Installer[];
  activeInstallers: Set<string>;
  onToggleInstaller: (id: string) => void;
}

export default function CalendarHeader({
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onToday,
  activeView,
  onViewChange,
  installers,
  activeInstallers,
  onToggleInstaller,
}: CalendarHeaderProps) {
  const views = ['day', 'week', 'month'] as const;

  return (
    <div className="flex flex-col gap-4 border-b border-[#e6e6eb] bg-white px-6 py-4">
      {/* Top row: navigation + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e6eb] text-[#60606a] transition-colors hover:bg-gray-50 hover:text-[#18181b]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="min-w-[200px] text-center text-sm font-semibold text-[#18181b]">
              {weekLabel}
            </span>
            <button
              onClick={onNextWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e6eb] text-[#60606a] transition-colors hover:bg-gray-50 hover:text-[#18181b]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <button
            onClick={onToday}
            className="rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-50 hover:text-[#18181b]"
          >
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-[#e6e6eb] p-0.5">
          {views.map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeView === view
                  ? 'bg-blue-600 text-white'
                  : 'text-[#60606a] hover:text-[#18181b]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: installer filter chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#a8a8b4]">Installers:</span>
        {installers.map((installer) => {
          const isActive = activeInstallers.has(installer.id);
          return (
            <button
              key={installer.id}
              onClick={() => onToggleInstaller(installer.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-transparent text-white'
                  : 'border-[#e6e6eb] text-[#a8a8b4]'
              }`}
              style={isActive ? { backgroundColor: installer.color } : undefined}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: isActive ? '#fff' : installer.color }}
              />
              {installer.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

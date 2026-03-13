'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Installer } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface CalendarHeaderProps {
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  activeView: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  installers: Installer[];
  activeInstallers: Set<string>;
  onToggleInstaller: (id: string) => void;
}

export default function CalendarHeader({
  dateLabel,
  onPrev,
  onNext,
  onToday,
  activeView,
  onViewChange,
  installers,
  activeInstallers,
  onToggleInstaller,
}: CalendarHeaderProps) {
  const views = ['day', 'week', 'month'] as const;

  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
      {/* Top row: navigation + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </Button>
            <span className="min-w-[240px] text-center text-base font-bold text-[var(--text-primary)]">
              {dateLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onToday}
          >
            Today
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-0.5">
          {views.map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeView === view
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: installer filter chips */}
      {installers.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Installers</span>
          {installers.map((installer) => {
            const isActive = activeInstallers.has(installer.id);
            return (
              <button
                key={installer.id}
                onClick={() => onToggleInstaller(installer.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
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
      )}
    </div>
  );
}

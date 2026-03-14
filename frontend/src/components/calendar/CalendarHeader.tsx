'use client';

import { Button } from '@/components/ui/Button';

type ViewMode = 'day' | 'week' | 'month' | 'list';

interface CalendarHeaderProps {
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'list', label: 'List' },
];

export default function CalendarHeader({
  dateLabel,
  onPrev,
  onNext,
  onToday,
  activeView,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
        <Button variant="secondary" size="sm" onClick={onToday}>
          Today
        </Button>
        <h2 className="ml-2 min-w-[200px] text-base font-bold text-[var(--text-primary)]">
          {dateLabel}
        </h2>
      </div>
      <div className="flex gap-[3px] rounded-lg bg-[var(--surface-raised)] p-[3px]">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === v.key
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

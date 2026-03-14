'use client';

import { CalendarEvent } from '@/lib/types';

interface SummaryBarProps {
  events: CalendarEvent[];
  viewLabel: string;
}

export default function SummaryBar({ events, viewLabel }: SummaryBarProps) {
  const designCount = events.filter((e) => e.phase === 'design').length;
  const productionCount = events.filter((e) => e.phase === 'production').length;
  const installCount = events.filter((e) => e.phase === 'install').length;

  return (
    <div className="flex items-center gap-6 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">{viewLabel}:</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{events.length} jobs</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--phase-design)]" />
        <span className="text-xs text-[var(--text-secondary)]">{designCount} design</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--phase-production)]" />
        <span className="text-xs text-[var(--text-secondary)]">{productionCount} production</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--phase-install)]" />
        <span className="text-xs text-[var(--text-secondary)]">{installCount} install</span>
      </div>
    </div>
  );
}

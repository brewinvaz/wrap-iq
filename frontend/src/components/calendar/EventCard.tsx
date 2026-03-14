'use client';

import { CalendarEvent } from '@/lib/types';

const PHASE_COLORS = {
  design: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.12)', dot: 'var(--phase-design)' },
  production: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.12)', dot: 'var(--phase-production)' },
  install: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.12)', dot: 'var(--phase-install)' },
};

interface EventCardProps {
  event: CalendarEvent;
  colorBy: 'phase' | 'installer';
  compact?: boolean;
}

export default function EventCard({ event, colorBy, compact = false }: EventCardProps) {
  const phaseColor = PHASE_COLORS[event.phase];
  const bgColor = colorBy === 'installer'
    ? `rgba(${hexToRgb(event.installerColor)},0.08)`
    : phaseColor.bg;
  const borderColor = colorBy === 'installer'
    ? `rgba(${hexToRgb(event.installerColor)},0.12)`
    : phaseColor.border;

  if (compact) {
    return (
      <div
        className="truncate rounded px-1.5 py-0.5"
        style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: phaseColor.dot }}
          />
          <span className="truncate text-[8px] font-medium text-[var(--text-primary)]">
            {event.title}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-md p-[5px_8px]"
      style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
    >
      <p className="truncate text-[9px] font-medium text-[var(--text-primary)]">{event.title}</p>
      <p className="mt-0.5 truncate text-[8px] text-[var(--text-muted)]">{event.vehicle}</p>
      <p className="mt-0.5 truncate text-[8px] text-[var(--text-secondary)]">{event.clientName}</p>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span
            className="inline-block h-[5px] w-[5px] rounded-full"
            style={{ backgroundColor: phaseColor.dot }}
          />
          <span className="text-[7px] font-semibold uppercase" style={{ color: phaseColor.dot }}>
            {event.phase}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {event.priority === 'high' && (
            <span className="text-[7px] font-semibold text-amber-500">&#9650; HIGH</span>
          )}
          {event.isOverdue && (
            <span className="rounded-sm bg-[rgba(244,63,94,0.15)] px-[5px] py-[1px] text-[7px] font-semibold text-[#f43f5e]">
              OVERDUE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

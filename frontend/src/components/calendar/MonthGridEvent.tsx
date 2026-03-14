'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Priority badge styles (matches KanbanCard.tsx pattern)
// ---------------------------------------------------------------------------

const priorityBadgeStyles: Record<string, { bg: string; label: string }> = {
  high: { bg: 'bg-rose-500/20 text-rose-700 dark:text-rose-500', label: 'High' },
  medium: { bg: 'bg-amber-500/20 text-amber-700 dark:text-amber-500', label: 'Medium' },
  low: { bg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-500', label: 'Low' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthGridEventProps {
  calendarEvent: {
    id: string;
    title: string;
    calendarId?: string;
    _priority?: 'high' | 'medium' | 'low';
    _phase?: 'design' | 'production' | 'install';
    _status?: string;
    _vehicle?: string;
    _clientName?: string;
    _jobNumber?: string;
    _woId?: string;
    _dayLabel?: string | null;
    _jobType?: string;
  };
  hasStartDate?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MonthGridEvent({ calendarEvent }: MonthGridEventProps) {
  const {
    _priority = 'medium',
    _phase,
    _status,
    _vehicle,
    _clientName,
    _jobNumber,
    _woId,
    _dayLabel,
    _jobType,
  } = calendarEvent;

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TOOLTIP_W = 260;

  const positionTooltip = useCallback(() => {
    if (!pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Default: below the pill, left-aligned
    let top = rect.bottom + 4;
    let left = rect.left;

    // Flip above if near bottom (estimate tooltip height ~220px)
    if (top + 220 > viewportH) {
      top = rect.top - 220 - 4;
    }

    // Right-align if near right edge
    if (left + TOOLTIP_W > viewportW) {
      left = rect.right - TOOLTIP_W;
    }

    // Clamp left to 0
    if (left < 0) left = 4;

    setTooltipPos({ top, left });
  }, []);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      positionTooltip();
      setShowTooltip(true);
    }, 200);
  }, [positionTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    // Short delay so user can bridge the gap from pill to tooltip
    hoverTimeout.current = setTimeout(() => {
      setShowTooltip(false);
    }, 150);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const badge = priorityBadgeStyles[_priority] ?? priorityBadgeStyles.medium;

  return (
    <>
      {/* Pill */}
      <div
        ref={pillRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full cursor-pointer overflow-hidden px-1"
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[11px] font-medium leading-tight">
            {_jobNumber}{_clientName && _clientName !== '—' ? ` · ${_clientName}` : ''}
          </span>
          {_dayLabel && (
            <span className="shrink-0 text-[10px] opacity-60">{_dayLabel}</span>
          )}
        </div>
        <div className="truncate text-[10px] leading-tight opacity-60">
          {_vehicle ?? ''}
        </div>
      </div>

      {/* Tooltip (portaled to body) */}
      {showTooltip && tooltipPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            onMouseEnter={() => {
              if (hoverTimeout.current) {
                clearTimeout(hoverTimeout.current);
                hoverTimeout.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, width: TOOLTIP_W }}
            className="z-50 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3.5 shadow-lg"
          >
            {/* Header */}
            <div className="mb-2.5 flex items-start justify-between">
              <div>
                <div className="text-[13px] font-bold text-[var(--text-primary)]">{_jobNumber}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{_jobType}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg}`}>
                {badge.label}
              </span>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              <span className="text-[var(--text-muted)]">Client</span>
              <span className="text-[var(--text-primary)]">{_clientName ?? '—'}</span>
              <span className="text-[var(--text-muted)]">Vehicle</span>
              <span className="text-[var(--text-primary)]">{_vehicle ?? '—'}</span>
              <span className="text-[var(--text-muted)]">Phase</span>
              <span className="capitalize text-[var(--text-primary)]">{_phase ?? '—'}</span>
              <span className="text-[var(--text-muted)]">Status</span>
              <span className="text-[var(--text-primary)]">{_status ?? '—'}</span>
              {_dayLabel && (
                <>
                  <span className="text-[var(--text-muted)]">Schedule</span>
                  <span className="text-[var(--text-primary)]">
                    {_dayLabel.replace('/', ' of ')}
                  </span>
                </>
              )}
            </div>

            {/* Footer */}
            {_woId && (
              <div className="mt-3 border-t border-[var(--border)] pt-2.5">
                <Link
                  href={`/dashboard/work-orders/${_woId}`}
                  className="text-[12px] font-medium text-[var(--accent-primary)] hover:underline"
                >
                  View details &rarr;
                </Link>
              </div>
            )}
          </div>,
          document.body
        )
      }
    </>
  );
}

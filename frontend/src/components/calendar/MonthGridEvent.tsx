'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Priority colors — dot indicator in pill, badge in tooltip
// ---------------------------------------------------------------------------

const priorityConfig: Record<string, { dot: string; bg: string; label: string }> = {
  high: {
    dot: 'bg-rose-500',
    bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    label: 'High',
  },
  medium: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    label: 'Medium',
  },
  low: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    label: 'Low',
  },
};

// ---------------------------------------------------------------------------
// Phase badge styles
// ---------------------------------------------------------------------------

const phaseStyles: Record<string, string> = {
  design: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  production: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  install: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
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
    calendarId,
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

  const TOOLTIP_W = 272;

  const positionTooltip = useCallback(() => {
    if (!pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    let top = rect.bottom + 6;
    let left = rect.left;

    if (top + 240 > viewportH) {
      top = rect.top - 240 - 6;
    }
    if (left + TOOLTIP_W > viewportW) {
      left = rect.right - TOOLTIP_W;
    }
    if (left < 0) left = 8;

    setTooltipPos({ top, left });
  }, []);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      positionTooltip();
      setShowTooltip(true);
    }, 250);
  }, [positionTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    hoverTimeout.current = setTimeout(() => {
      setShowTooltip(false);
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const priority = priorityConfig[_priority] ?? priorityConfig.medium;

  // Build dynamic styles from Schedule-X calendar color CSS variables
  const pillStyle: React.CSSProperties = calendarId
    ? {
        borderLeft: `3px solid var(--sx-color-${calendarId})`,
        backgroundColor: `var(--sx-color-${calendarId}-container)`,
        color: `var(--sx-color-on-${calendarId}-container)`,
      }
    : {
        borderLeft: '3px solid var(--accent-primary)',
        backgroundColor: 'var(--surface-raised)',
        color: 'var(--text-primary)',
      };

  // Smart pill label: prefer client/vehicle, fall back to WO number
  const hasClient = _clientName && _clientName !== '—';
  const hasVehicle = _vehicle && _vehicle !== '—' && _vehicle.toLowerCase() !== 'no vehicle';

  let pillPrimary: string;
  let pillSecondary: string | null = null;

  if (hasClient && hasVehicle) {
    pillPrimary = _clientName!;
    pillSecondary = _vehicle!;
  } else if (hasClient) {
    pillPrimary = _clientName!;
    pillSecondary = _jobNumber ?? null;
  } else if (hasVehicle) {
    pillPrimary = _vehicle!;
    pillSecondary = _jobNumber ?? null;
  } else {
    pillPrimary = _jobNumber ?? 'Untitled';
  }

  return (
    <>
      {/* ── Pill ── */}
      <div
        ref={pillRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group flex w-full cursor-pointer items-center gap-1 overflow-hidden rounded-[3px] py-[1px] pl-0 pr-1.5 transition-opacity hover:opacity-80"
        style={pillStyle}
      >
        {/* Priority dot */}
        <span className={`ml-1 inline-block h-[5px] w-[5px] shrink-0 rounded-full ${priority.dot}`} />

        {/* Primary + Secondary label */}
        <span className="truncate text-[10.5px] font-semibold leading-none tracking-tight">
          {pillPrimary}
          {pillSecondary && (
            <span className="font-normal opacity-60"> · {pillSecondary}</span>
          )}
        </span>

        {/* Day label for multi-day events */}
        {_dayLabel && (
          <span className="ml-auto shrink-0 rounded-sm bg-black/10 px-1 text-[8px] font-bold uppercase leading-[14px] tracking-wide dark:bg-white/10">
            {_dayLabel}
          </span>
        )}
      </div>

      {/* ── Tooltip (portaled) ── */}
      {showTooltip &&
        tooltipPos &&
        typeof document !== 'undefined' &&
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
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              width: TOOLTIP_W,
            }}
            className="z-50 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-card)] shadow-xl shadow-black/15 dark:shadow-black/40"
          >
            {/* Color accent bar */}
            <div
              className="h-1"
              style={{
                backgroundColor: calendarId
                  ? `var(--sx-color-${calendarId})`
                  : 'var(--accent-primary)',
              }}
            />

            <div className="p-3.5">
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold leading-tight text-[var(--text-primary)]">
                    {_jobNumber}
                  </div>
                  {_jobType && (
                    <div className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">
                      {_jobType}
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priority.bg}`}
                >
                  {priority.label}
                </span>
              </div>

              {/* Info rows */}
              <div className="space-y-1.5 text-[11.5px]">
                <InfoRow label="Client" value={_clientName} />
                <InfoRow label="Vehicle" value={_vehicle} />
                <div className="flex items-center gap-2">
                  <InfoRow label="Phase" value={_phase}>
                    {_phase && phaseStyles[_phase] && (
                      <span
                        className={`inline-block rounded px-1.5 py-[1px] text-[10px] font-semibold capitalize ${phaseStyles[_phase]}`}
                      >
                        {_phase}
                      </span>
                    )}
                  </InfoRow>
                </div>
                <InfoRow label="Status" value={_status} />
                {_dayLabel && (
                  <InfoRow label="Schedule" value={_dayLabel.replace('/', ' of ')} />
                )}
              </div>

              {/* Footer */}
              {_woId && (
                <div className="mt-3 border-t border-[var(--border)] pt-2.5">
                  <Link
                    href={`/dashboard/jobs/${_woId}`}
                    className="group/link inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-secondary)]"
                  >
                    View details
                    <svg
                      className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      {children ?? (
        <span className="truncate capitalize text-[var(--text-primary)]">
          {value ?? '—'}
        </span>
      )}
    </div>
  );
}

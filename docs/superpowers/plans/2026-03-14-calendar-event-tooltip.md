# Calendar Event Pill & Hover Tooltip — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Schedule-X month grid event pill with a custom React component that shows client + vehicle at a glance and reveals a detailed tooltip with priority badge and "View details" link on hover.

**Architecture:** Create a new `MonthGridEvent.tsx` component using Schedule-X's `monthGridEvent` custom component slot. Extend the `SXEvent` interface with underscore-prefixed custom fields so the component can access priority, phase, status, vehicle, client, etc. The tooltip is portaled to `document.body` via `createPortal` to escape overflow clipping, with viewport-aware positioning.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS 4, Schedule-X calendar, `createPortal`

**Spec:** `docs/superpowers/specs/2026-03-14-calendar-event-tooltip-design.md`

---

## Chunk 1: Data Layer & Custom Component

### Task 1: Extend SXEvent and pass custom fields

**Files:**
- Modify: `frontend/src/components/calendar/CalendarPage.tsx:223-292` (SXEvent interface + toScheduleXEvents)

- [ ] **Step 1: Extend the SXEvent interface with custom fields**

Add the underscore-prefixed fields to the `SXEvent` interface (line ~223):

```tsx
interface SXEvent {
  id: string;
  title: string;
  start: Temporal.ZonedDateTime | Temporal.PlainDate;
  end: Temporal.ZonedDateTime | Temporal.PlainDate;
  calendarId: string;
  description?: string;
  // Custom fields for MonthGridEvent component
  _priority?: 'high' | 'medium' | 'low';
  _phase?: 'design' | 'production' | 'install';
  _status?: string;
  _vehicle?: string;
  _clientName?: string;
  _jobNumber?: string;
  _woId?: string;
  _dayLabel?: string | null;
  _jobType?: string;
}
```

- [ ] **Step 2: Update toScheduleXEvents to pass custom fields**

Replace the `toScheduleXEvents` function (lines ~250-292) with:

```tsx
function toScheduleXEvents(events: CalendarEvent[]): SXEvent[] {
  const result: SXEvent[] = [];

  for (const e of events) {
    const calendarId = e.installer; // maps to work order calendar
    const description = `${e.vehicle} · ${e.clientName}`;
    // Extract job type from title (format: "{JobType} - {JobNumber}")
    const jobType = e.title.split(' - ')[0] ?? e.title;

    const isMultiDay = e.dueDate && e.dueDate !== e.date;

    // Shared custom fields for MonthGridEvent component
    const customFields = {
      _priority: e.priority,
      _phase: e.phase,
      _status: e.status,
      _vehicle: e.vehicle,
      _clientName: e.clientName,
      _jobNumber: e.jobNumber,
      _woId: e.id,
      _jobType: jobType,
    };

    if (isMultiDay) {
      const startDate = Temporal.PlainDate.from(e.date);
      const endDate = Temporal.PlainDate.from(e.dueDate!);
      const businessDays = getBusinessDays(startDate, endDate);
      const totalDays = businessDays.length;

      for (let i = 0; i < totalDays; i++) {
        const day = businessDays[i];
        const dayNum = i + 1;
        result.push({
          id: `${e.id}-day${dayNum}`,
          title: e.title,
          start: day.toPlainDateTime(Temporal.PlainTime.from('08:00')).toZonedDateTime(DISPLAY_TZ),
          end: day.toPlainDateTime(Temporal.PlainTime.from('17:00')).toZonedDateTime(DISPLAY_TZ),
          calendarId,
          description,
          ...customFields,
          _dayLabel: `Day ${dayNum}/${totalDays}`,
        });
      }
    } else {
      const date = Temporal.PlainDate.from(e.date);
      if (!isWeekday(date)) continue;
      result.push({
        id: e.id,
        title: e.title,
        start: date.toPlainDateTime(Temporal.PlainTime.from(e.startTime)).toZonedDateTime(DISPLAY_TZ),
        end: date.toPlainDateTime(Temporal.PlainTime.from(e.endTime)).toZonedDateTime(DISPLAY_TZ),
        calendarId,
        description,
        ...customFields,
        _dayLabel: null,
      });
    }
  }

  return result;
}
```

Note: The multi-day `title` no longer includes `(Day X/Y)` — that info is in `_dayLabel`. The `title` is kept as `{JobType} - {JobNumber}` for all events.

- [ ] **Step 3: Verify the app compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5` (or check the running dev server for errors)
Expected: No compilation errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/calendar/CalendarPage.tsx
git commit -m "feat(calendar): extend SXEvent with custom fields for month grid component"
```

### Task 2: Create MonthGridEvent component

**Files:**
- Create: `frontend/src/components/calendar/MonthGridEvent.tsx`

- [ ] **Step 1: Create the MonthGridEvent component**

Create `frontend/src/components/calendar/MonthGridEvent.tsx`:

```tsx
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
  hasStartDate: boolean;
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
```

- [ ] **Step 2: Verify the component compiles**

Run: Check dev server for errors
Expected: No compilation errors (component not yet mounted)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/calendar/MonthGridEvent.tsx
git commit -m "feat(calendar): create MonthGridEvent component with pill and hover tooltip"
```

### Task 3: Wire up custom component and adjust CSS

**Files:**
- Modify: `frontend/src/components/calendar/CalendarPage.tsx:394` (ScheduleXCalendar render)
- Modify: `frontend/src/components/calendar/CalendarPage.tsx:1` (imports)
- Modify: `frontend/src/app/globals.css:199-205` (month grid event styles)

- [ ] **Step 1: Import MonthGridEvent in CalendarPage**

Add the import after the existing component imports (after line ~13):

```tsx
import MonthGridEvent from './MonthGridEvent';
```

- [ ] **Step 2: Pass customComponents to ScheduleXCalendar**

Replace the return statement in `MonthCalendar` (line ~394):

```tsx
  return <ScheduleXCalendar calendarApp={calendar} customComponents={{ monthGridEvent: MonthGridEvent }} />;
```

- [ ] **Step 3: Update globals.css month grid event styles**

Replace the `.sx__month-grid-event` styles (lines ~200-205) with adjusted styles that work with the custom component:

```css
/* ── Month grid event styling ── */
.sx__month-grid-event {
  border-radius: 4px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  padding: 2px 4px !important;
  line-height: 1.2 !important;
}
```

The main change is slightly adjusted padding (from `1px 6px` to `2px 4px`) and added `line-height` to accommodate the two-line pill content.

- [ ] **Step 4: Verify the app compiles and renders**

Run: Check dev server, navigate to Calendar page
Expected: Events display with enriched two-line pills (job number + client, vehicle)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/calendar/CalendarPage.tsx frontend/src/app/globals.css
git commit -m "feat(calendar): wire up MonthGridEvent custom component"
```

## Chunk 2: Verification

> **Note on testing:** The frontend currently has no unit test infrastructure (no test runner or test files). All frontend changes in this project are validated via Playwright MCP visual verification, which is the established pattern.

### Task 4: Playwright verification

**Files:**
- No file changes — visual verification only

- [ ] **Step 1: Verify dark mode — enriched pill content**

Navigate to Calendar page. Take screenshot showing event pills.
Expected: Pills show job number + client on line 1, vehicle on line 2

- [ ] **Step 2: Verify dark mode — multi-day event day label**

Find a multi-day event. Take screenshot.
Expected: Day label (e.g., "Day 2/11") appears right-aligned on line 1

- [ ] **Step 3: Verify dark mode — hover tooltip appears**

Hover over an event pill. Take screenshot after tooltip appears.
Expected: Tooltip card with job number, job type, priority badge, client, vehicle, phase, status fields, and "View details" link

- [ ] **Step 4: Verify dark mode — priority badge colors**

Check tooltip for high/medium/low priority events.
Expected: Rose (high), amber (medium), emerald (low) badge colors

- [ ] **Step 5: Verify dark mode — "View details" link works**

Click the "View details" link in the tooltip.
Expected: Navigates to `/dashboard/work-orders/{id}` page

- [ ] **Step 6: Verify dark mode — tooltip dismisses on mouseleave**

Move mouse away from pill and tooltip.
Expected: Tooltip disappears

- [ ] **Step 7: Verify light mode**

Toggle to light mode. Take screenshot of pill and tooltip.
Expected: Styling matches app theme, readable in light mode

- [ ] **Step 8: Verify existing filters still work**

Apply a priority or client filter. Verify pills update correctly.
Expected: Filters work as before, filtered events show enriched pills

- [ ] **Step 9: Commit (if any fixes were needed)**

```bash
git add frontend/src/components/calendar/MonthGridEvent.tsx frontend/src/components/calendar/CalendarPage.tsx frontend/src/app/globals.css
git commit -m "fix(calendar): polish MonthGridEvent based on visual verification"
```

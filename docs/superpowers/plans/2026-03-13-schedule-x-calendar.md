# Schedule-X Calendar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom-built calendar views with Schedule-X for Google Calendar-quality visuals and multi-day event spanning.

**Architecture:** Install Schedule-X packages, add CSS variable overrides for theming, rewrite CalendarPage to use `useNextCalendarApp`, delete replaced view components (CalendarHeader, WeekView, DayView, MonthView, EventCard), adapt CalendarToolbar and SummaryBar for the new integration.

**Tech Stack:** Schedule-X (free tier), React 19, Next.js 15, Temporal API polyfill, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-13-schedule-x-calendar-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/package.json` | Modify | Add Schedule-X + temporal-polyfill deps |
| `frontend/src/app/globals.css` | Modify | Add `--sx-*` CSS variable overrides |
| `frontend/src/components/calendar/CalendarPage.tsx` | Rewrite | Schedule-X integration, event transform, filter sync |
| `frontend/src/components/calendar/CalendarToolbar.tsx` | Modify | Add List view toggle button |
| `frontend/src/components/calendar/SummaryBar.tsx` | Modify | Accept `viewLabel` string instead of `activeView` enum |
| `frontend/src/components/calendar/CalendarHeader.tsx` | Delete | Replaced by Schedule-X built-in nav |
| `frontend/src/components/calendar/WeekView.tsx` | Delete | Replaced by Schedule-X week view |
| `frontend/src/components/calendar/DayView.tsx` | Delete | Replaced by Schedule-X day view |
| `frontend/src/components/calendar/MonthView.tsx` | Delete | Replaced by Schedule-X month grid |
| `frontend/src/components/calendar/EventCard.tsx` | Delete | Schedule-X renders its own event elements |

---

## Chunk 1: Dependencies & Theme

### Task 1: Install Schedule-X dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm install @schedule-x/react @schedule-x/calendar @schedule-x/events-service @schedule-x/theme-default temporal-polyfill
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && node -e "require('@schedule-x/react'); require('@schedule-x/calendar'); require('@schedule-x/events-service'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && git add package.json package-lock.json && git commit -m "chore: add Schedule-X calendar dependencies"
```

---

### Task 2: Add Schedule-X CSS variable overrides

**Files:**
- Modify: `frontend/src/app/globals.css`

The Schedule-X theme uses `--sx-*` CSS variables. We override them to use WrapFlow's existing design tokens so the calendar integrates seamlessly in both dark and light modes.

Both blocks reference the same WrapFlow CSS custom properties, which already resolve to different values per theme. The light mode block is needed because Schedule-X applies its own dark mode overrides internally that must be countered.

- [ ] **Step 1: Add `--sx-*` overrides after the dark theme block**

After line 55 (end of `:root, [data-theme="dark"]` block), before the `/* ── Light theme ── */` comment, add:

```css
/* ── Schedule-X theme integration (dark) ── */
:root,
[data-theme="dark"] {
  --sx-color-surface: var(--surface-base);
  --sx-color-surface-dim: var(--surface-app);
  --sx-color-surface-bright: var(--surface-raised);
  --sx-color-background: var(--surface-app);
  --sx-color-on-surface: var(--text-primary);
  --sx-color-on-background: var(--text-primary);
  --sx-color-surface-container: var(--surface-card);
  --sx-color-surface-container-low: var(--surface-raised);
  --sx-color-surface-container-high: var(--surface-overlay);
  --sx-color-outline: var(--glass-border);
  --sx-color-outline-variant: var(--glass-border);
  --sx-color-primary: var(--accent-primary);
  --sx-color-on-primary: #ffffff;
  --sx-color-primary-container: var(--accent-primary-bg);
  --sx-color-on-primary-container: var(--accent-primary);
  --sx-color-secondary: var(--accent-secondary);
  --sx-color-on-secondary: #ffffff;
  --sx-color-secondary-container: rgba(59, 130, 246, 0.1);
  --sx-color-on-secondary-container: var(--accent-secondary);
}
```

- [ ] **Step 2: Add `--sx-*` overrides for light theme**

After line 97 (end of `[data-theme="light"]` block), add:

```css
/* ── Schedule-X theme integration (light) ── */
[data-theme="light"] {
  --sx-color-surface: var(--surface-base);
  --sx-color-surface-dim: var(--surface-app);
  --sx-color-surface-bright: var(--surface-raised);
  --sx-color-background: var(--surface-app);
  --sx-color-on-surface: var(--text-primary);
  --sx-color-on-background: var(--text-primary);
  --sx-color-surface-container: var(--surface-card);
  --sx-color-surface-container-low: var(--surface-raised);
  --sx-color-surface-container-high: var(--surface-overlay);
  --sx-color-outline: var(--glass-border);
  --sx-color-outline-variant: var(--glass-border);
  --sx-color-primary: var(--accent-primary);
  --sx-color-on-primary: #ffffff;
  --sx-color-primary-container: var(--accent-primary-bg);
  --sx-color-on-primary-container: var(--accent-primary);
  --sx-color-secondary: var(--accent-secondary);
  --sx-color-on-secondary: #ffffff;
  --sx-color-secondary-container: rgba(37, 99, 235, 0.1);
  --sx-color-on-secondary-container: var(--accent-secondary);
}
```

- [ ] **Step 3: Verify nothing broke**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npx tsc --noEmit
```

Expected: No new errors. CSS changes don't affect TS compilation, but this confirms no accidental file damage.

- [ ] **Step 4: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq && git add frontend/src/app/globals.css && git commit -m "style: add Schedule-X CSS variable overrides for dark/light themes"
```

---

## Chunk 2: Adapt SummaryBar and CalendarToolbar

### Task 3: Update SummaryBar to accept viewLabel string

**Files:**
- Modify: `frontend/src/components/calendar/SummaryBar.tsx`

The SummaryBar currently takes `activeView: 'day' | 'week' | 'month' | 'list'` and maps it to a label. With Schedule-X managing views internally, we simplify it to accept a `viewLabel` string directly.

- [ ] **Step 1: Rewrite SummaryBar.tsx**

Replace the entire file with:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq && git add frontend/src/components/calendar/SummaryBar.tsx && git commit -m "refactor: update SummaryBar to accept viewLabel string prop"
```

---

### Task 4: Add List view toggle to CalendarToolbar

**Files:**
- Modify: `frontend/src/components/calendar/CalendarToolbar.tsx`

Add a "List" toggle button to the toolbar since Schedule-X doesn't have a list view. The button switches between the Schedule-X calendar and our DataTable ListView.

- [ ] **Step 1: Add `isListView` and `onToggleListView` props**

Add to the `CalendarToolbarProps` interface (after line 18):

```typescript
  isListView: boolean;
  onToggleListView: () => void;
```

Add the corresponding parameters to the function signature (after line 43's `onToggleInstaller`):

```typescript
  isListView,
  onToggleListView,
```

- [ ] **Step 2: Add the List toggle button**

After the Color select (after the closing `</select>` on line 91), add:

```tsx
      <div className="h-4 w-px bg-[var(--glass-border)]" />
      <button
        onClick={onToggleListView}
        className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          isListView
            ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'
        }`}
      >
        List
      </button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npx tsc --noEmit
```

Note: This will show errors in CalendarPage.tsx since it doesn't pass the new props yet. That's expected — CalendarPage is rewritten in Task 5.

- [ ] **Step 4: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq && git add frontend/src/components/calendar/CalendarToolbar.tsx && git commit -m "feat: add List view toggle button to CalendarToolbar"
```

---

## Chunk 3: Rewrite CalendarPage + Delete Old Components

### Task 5: Rewrite CalendarPage with Schedule-X integration

**Files:**
- Rewrite: `frontend/src/components/calendar/CalendarPage.tsx`

This is the main task. Replace the custom view orchestration with Schedule-X's `useNextCalendarApp`. Keep all existing data fetching, transformation, filtering, and role preset logic. Add Schedule-X calendar config, event format conversion, and events service integration.

- [ ] **Step 1: Write the complete CalendarPage.tsx**

Replace the entire file with the following (preserves all API types, helpers, and filter logic from the original):

```tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import 'temporal-polyfill/global';
import '@schedule-x/theme-default/dist/index.css';

import { useRole } from '@/lib/role-context';
import { api, ApiError } from '@/lib/api-client';
import { CalendarEvent, Installer } from '@/lib/types';
import { RoleKey } from '@/lib/roles';
import { Button } from '@/components/ui/Button';
import CalendarToolbar from './CalendarToolbar';
import ListView from './ListView';
import SummaryBar from './SummaryBar';

// ---------------------------------------------------------------------------
// API types (unchanged from original)
// ---------------------------------------------------------------------------

interface WorkOrderVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface WorkOrderStatus {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface WorkOrderResponse {
  id: string;
  job_number: string;
  job_type: string;
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  status: WorkOrderStatus | null;
  vehicles: WorkOrderVehicle[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkOrderListResponse {
  items: WorkOrderResponse[];
  total: number;
}

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type Phase = 'design' | 'production' | 'install';
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';
type ColorBy = 'phase' | 'installer';

interface CalendarPreset {
  view: string; // Schedule-X view name
  phases: Phase[];
  status: StatusFilter;
}

const ROLE_PRESETS: Record<RoleKey, CalendarPreset> = {
  admin:      { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  pm:         { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  installer:  { view: 'week', phases: ['install'], status: 'all' },
  production: { view: 'list', phases: ['production', 'install'], status: 'in_progress' },
  designer:   { view: 'week', phases: ['design'], status: 'all' },
  client:     { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
};

const INSTALLER_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#e11d48',
  '#d97706', '#0891b2', '#4f46e5', '#be185d',
];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

// ---------------------------------------------------------------------------
// Schedule-X calendar configs
// ---------------------------------------------------------------------------

const PHASE_CALENDARS: Record<string, { colorName: string; lightColors: { main: string; container: string; onContainer: string }; darkColors: { main: string; container: string; onContainer: string } }> = {
  design: {
    colorName: 'design',
    darkColors:  { main: '#06b6d4', container: '#0e4a5a', onContainer: '#67e8f9' },
    lightColors: { main: '#0891b2', container: '#cffafe', onContainer: '#155e75' },
  },
  production: {
    colorName: 'production',
    darkColors:  { main: '#3b82f6', container: '#1e3a5f', onContainer: '#93c5fd' },
    lightColors: { main: '#2563eb', container: '#dbeafe', onContainer: '#1e40af' },
  },
  install: {
    colorName: 'install',
    darkColors:  { main: '#10b981', container: '#134e3a', onContainer: '#6ee7b7' },
    lightColors: { main: '#059669', container: '#d1fae5', onContainer: '#065f46' },
  },
};

function buildInstallerCalendars(installers: Installer[]) {
  const result: Record<string, typeof PHASE_CALENDARS[string]> = {};
  for (const inst of installers) {
    result[inst.id] = {
      colorName: inst.id,
      darkColors:  { main: inst.color, container: darken(inst.color, 0.6), onContainer: lighten(inst.color, 0.4) },
      lightColors: { main: inst.color, container: lighten(inst.color, 0.85), onContainer: darken(inst.color, 0.3) },
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Data helpers (unchanged from original)
// ---------------------------------------------------------------------------

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function derivePhase(wo: WorkOrderResponse): Phase {
  const sys = wo.status?.system_status?.toLowerCase() ?? '';
  if (sys === 'completed' || sys === 'in_progress') return 'install';
  const jt = wo.job_type?.toLowerCase() ?? '';
  if (jt.includes('design')) return 'design';
  if (jt.includes('print') || jt.includes('production')) return 'production';
  return 'install';
}

function vehicleLabel(vehicles: WorkOrderVehicle[]): string {
  if (!vehicles.length) return 'No vehicle';
  const v = vehicles[0];
  const parts: string[] = [];
  if (v.year) parts.push(String(v.year));
  if (v.make) parts.push(v.make);
  if (v.model) parts.push(v.model);
  return parts.length ? parts.join(' ') : 'Vehicle';
}

function jobTypeLabel(jobType: string): string {
  return jobType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function extractInstallers(workOrders: WorkOrderResponse[]): Installer[] {
  const seen = new Map<string, Installer>();
  for (const wo of workOrders) {
    const name = wo.client_name ?? 'Unassigned';
    if (!seen.has(name)) {
      const idx = seen.size % INSTALLER_COLORS.length;
      seen.set(name, { id: `installer-${seen.size}`, name, initials: initials(name), color: INSTALLER_COLORS[idx] });
    }
  }
  return Array.from(seen.values());
}

function transformWorkOrders(workOrders: WorkOrderResponse[], installerMap: Map<string, Installer>): CalendarEvent[] {
  const todayStr = formatDateStr(new Date());

  return workOrders.map((wo) => {
    const dateIn = new Date(wo.date_in);
    const dateStr = formatDateStr(dateIn);

    const installerName = wo.client_name ?? 'Unassigned';
    const inst = installerMap.get(installerName);

    const startHour = dateIn.getHours();
    const startMin = dateIn.getMinutes();
    let startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    if (startTime === '00:00') startTime = '08:00';

    let endTime = '17:00';
    if (wo.estimated_completion_date) {
      const endDate = new Date(wo.estimated_completion_date);
      if (formatDateStr(endDate) === dateStr) {
        const eh = endDate.getHours();
        const em = endDate.getMinutes();
        const et = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        if (et !== '00:00') endTime = et;
      }
    }

    const dueDateStr = wo.estimated_completion_date?.slice(0, 10) ?? null;
    const isOverdue = dueDateStr !== null && dueDateStr < todayStr && wo.status?.system_status !== 'completed';

    return {
      id: wo.id,
      jobNumber: wo.job_number,
      title: `${jobTypeLabel(wo.job_type)} - ${wo.job_number}`,
      vehicle: vehicleLabel(wo.vehicles),
      clientName: wo.client_name ?? '—',
      date: dateStr,
      startTime,
      endTime,
      phase: derivePhase(wo),
      status: wo.status?.name ?? 'Unknown',
      systemStatus: wo.status?.system_status ?? null,
      priority: wo.priority ?? 'medium',
      dueDate: dueDateStr,
      isOverdue,
      installer: inst?.id ?? 'installer-0',
      installerInitials: inst?.initials ?? '??',
      installerColor: inst?.color ?? INSTALLER_COLORS[0],
    };
  });
}

// ---------------------------------------------------------------------------
// Schedule-X event conversion
// ---------------------------------------------------------------------------

interface SXEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  calendarId: string;
  description?: string;
}

function toScheduleXEvents(events: CalendarEvent[], colorBy: ColorBy): SXEvent[] {
  return events.map((e) => {
    const calendarId = colorBy === 'installer' ? e.installer : e.phase;

    // Multi-day detection: if dueDate exists and differs from date
    const isMultiDay = e.dueDate && e.dueDate !== e.date;

    return {
      id: e.id,
      title: e.title,
      start: isMultiDay ? e.date : `${e.date} ${e.startTime}`,
      end: isMultiDay ? e.dueDate! : `${e.date} ${e.endTime}`,
      calendarId,
      description: `${e.vehicle} · ${e.clientName}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Events service bulk replace helper
// ---------------------------------------------------------------------------

function replaceAllEvents(
  eventsService: ReturnType<typeof createEventsServicePlugin>,
  newEvents: SXEvent[]
) {
  const existing = eventsService.getAll();
  for (const e of existing) {
    eventsService.remove(e.id as string);
  }
  for (const e of newEvents) {
    eventsService.add(e);
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-3">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
      </div>
      <div className="flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-overlay)]" />
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-6 w-16 animate-pulse rounded bg-[var(--surface-overlay)]" />
              <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const { currentRole } = useRole();
  const preset = ROLE_PRESETS[currentRole];

  // Data state
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [activePhases, setActivePhases] = useState<Set<Phase>>(() => new Set(preset.phases));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(preset.status);
  const [colorBy, setColorBy] = useState<ColorBy>('phase');
  const [activeInstallers, setActiveInstallers] = useState<Set<string>>(new Set());

  // View state
  const [isListView, setIsListView] = useState(preset.view === 'list');
  const [viewLabel, setViewLabel] = useState('This week');
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null);

  // Theme detection
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') !== 'light'
    : true;

  // Schedule-X events service
  const eventsService = useState(() => createEventsServicePlugin())[0];

  // Build all calendars (phase + installer) upfront
  const allCalendars = useMemo(() => {
    return { ...PHASE_CALENDARS, ...buildInstallerCalendars(installers) };
  }, [installers]);

  // Schedule-X calendar app
  const sxDefaultView = preset.view === 'list' ? 'week' : preset.view;
  const todayStr = formatDateStr(new Date());

  const calendar = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    defaultView: sxDefaultView,
    selectedDate: todayStr,
    isDark,
    locale: 'en-US',
    firstDayOfWeek: 1,
    dayBoundaries: { start: '08:00', end: '18:00' },
    weekOptions: {
      nDays: 5,
      eventWidth: 95,
    },
    monthGridOptions: {
      nEventsPerDay: 3,
    },
    calendars: allCalendars,
    events: [],
    plugins: [eventsService],
    callbacks: {
      onRangeUpdate(range) {
        setVisibleRange({ start: String(range.start), end: String(range.end) });
        // Derive view label from range span
        const start = new Date(String(range.start));
        const end = new Date(String(range.end));
        const dayDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff <= 1) setViewLabel('Today');
        else if (dayDiff <= 7) setViewLabel('This week');
        else setViewLabel('This month');
      },
      onEventClick(calendarEvent) {
        // Future: navigate to work order detail
        console.log('Event clicked:', calendarEvent.id);
      },
    },
  });

  // Fetch work orders
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<WorkOrderListResponse>('/api/work-orders?limit=100');
      const extracted = extractInstallers(data.items);
      setInstallers(extracted);
      const installerMap = new Map(extracted.map((i) => [i.name, i]));
      const events = transformWorkOrders(data.items, installerMap);
      setAllEvents(events);
      setActiveInstallers(new Set(extracted.map((i) => i.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (!activePhases.has(e.phase)) return false;
      if (colorBy === 'installer' && !activeInstallers.has(e.installer)) return false;
      if (statusFilter === 'upcoming') {
        return e.systemStatus === null || (e.systemStatus !== 'in_progress' && e.systemStatus !== 'completed');
      }
      if (statusFilter === 'in_progress') return e.systemStatus === 'in_progress';
      if (statusFilter === 'completed') return e.systemStatus === 'completed';
      return true;
    });
  }, [allEvents, activePhases, statusFilter, colorBy, activeInstallers]);

  // Sync filtered events to Schedule-X
  const prevEventsRef = useRef<string>('');
  useEffect(() => {
    if (isLoading) return;
    const sxEvents = toScheduleXEvents(filteredEvents, colorBy);
    const key = JSON.stringify(sxEvents);
    if (key !== prevEventsRef.current) {
      prevEventsRef.current = key;
      replaceAllEvents(eventsService, sxEvents);
    }
  }, [filteredEvents, colorBy, eventsService, isLoading]);

  // Visible events for SummaryBar (scoped to range)
  const summaryEvents = useMemo(() => {
    if (isListView) return filteredEvents;
    if (!visibleRange) return filteredEvents;
    const startStr = visibleRange.start.slice(0, 10);
    const endStr = visibleRange.end.slice(0, 10);
    return filteredEvents.filter((e) => e.date >= startStr && e.date <= endStr);
  }, [filteredEvents, visibleRange, isListView]);

  // Filter handlers
  const handleTogglePhase = useCallback((phase: Phase) => {
    setActivePhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  }, []);

  const handleToggleInstaller = useCallback((id: string) => {
    setActiveInstallers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleListView = useCallback(() => {
    setIsListView((prev) => !prev);
  }, []);

  // Loading / Error
  if (isLoading) return <CalendarSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-[rgba(244,63,94,0.1)] p-3">
          <svg className="h-6 w-6 text-[var(--danger-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to load calendar</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <Button variant="secondary" onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  const hasNoData = allEvents.length === 0;
  const hasNoFilteredResults = !hasNoData && filteredEvents.length === 0;

  return (
    <div className="flex h-full flex-col">
      <CalendarToolbar
        activePhases={activePhases}
        onTogglePhase={handleTogglePhase}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        colorBy={colorBy}
        onColorByChange={setColorBy}
        installers={installers}
        activeInstallers={activeInstallers}
        onToggleInstaller={handleToggleInstaller}
        isListView={isListView}
        onToggleListView={handleToggleListView}
      />

      {hasNoData ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">No work orders found</p>
        </div>
      ) : hasNoFilteredResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">No jobs match your filters</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActivePhases(new Set<Phase>(['design', 'production', 'install']));
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className={`flex-1 overflow-auto ${isListView ? 'hidden' : ''}`}>
            <ScheduleXCalendar key={isDark ? 'dark' : 'light'} calendarApp={calendar} />
          </div>
          {isListView && <ListView events={filteredEvents} />}
        </>
      )}

      <SummaryBar events={summaryEvents} viewLabel={isListView ? 'Showing' : viewLabel} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npx tsc --noEmit
```

Expected: No errors (or only warnings about unused old component files that are about to be deleted).

- [ ] **Step 3: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq && git add frontend/src/components/calendar/CalendarPage.tsx && git commit -m "feat: rewrite CalendarPage with Schedule-X integration"
```

---

### Task 6: Delete replaced components

**Files:**
- Delete: `frontend/src/components/calendar/CalendarHeader.tsx`
- Delete: `frontend/src/components/calendar/WeekView.tsx`
- Delete: `frontend/src/components/calendar/DayView.tsx`
- Delete: `frontend/src/components/calendar/MonthView.tsx`
- Delete: `frontend/src/components/calendar/EventCard.tsx`

- [ ] **Step 1: Delete the files**

```bash
cd /Users/brewinvaz/repos/wrap-iq && rm frontend/src/components/calendar/CalendarHeader.tsx frontend/src/components/calendar/WeekView.tsx frontend/src/components/calendar/DayView.tsx frontend/src/components/calendar/MonthView.tsx frontend/src/components/calendar/EventCard.tsx
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npx tsc --noEmit
```

Expected: No errors. CalendarPage no longer imports any of these files.

- [ ] **Step 3: Verify the build passes**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Verify lint passes**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run lint
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/brewinvaz/repos/wrap-iq && git add -u frontend/src/components/calendar/ && git commit -m "chore: delete replaced calendar view components (Header, Week, Day, Month, EventCard)"
```

---

## Chunk 4: Verification & Cleanup

### Task 7: Full build and visual verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Run dev server and visually verify**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run dev
```

Open `http://localhost:3000/dashboard/calendar` in the browser. Verify:
- Schedule-X calendar renders with day/week/month view switcher
- Events display with phase colors (design=cyan, production=blue, install=green)
- Phase filter chips work (toggle phases on/off)
- Status dropdown filters events
- Color-by dropdown switches between phase and installer colors
- List toggle shows DataTable view
- SummaryBar shows correct counts
- Dark mode looks correct (glass variables integrate with Schedule-X)
- Light mode looks correct (toggle theme and verify)
- Multi-day events span across cells when applicable

- [ ] **Step 4: Take screenshots for PR**

Use the Playwright MCP tools to capture screenshots of the calendar in both dark and light modes, saving to `.playwright-mcp/` directory.

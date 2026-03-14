# Schedule-X Calendar Redesign — Design Spec

## Problem

The unified calendar (built in the previous iteration) uses custom-built grid views that look flat and basic compared to polished calendar apps like Google Calendar. The month view has plain outlined boxes, no visual depth, and no multi-day event spanning. The week and day views lack refined spacing, smooth event pills, and professional typography.

## Solution

Replace the custom-built calendar views with Schedule-X, a modern React calendar library with built-in dark mode, CSS variable theming, multi-day event spanning, and a polished Material Design aesthetic. Keep the existing data fetching, filtering, role presets, toolbar, list view, and summary bar.

## Dependencies (Free Tier Only)

```
@schedule-x/react        — React component + useNextCalendarApp hook
@schedule-x/calendar     — Core views (createViewDay, createViewWeek, createViewMonthGrid)
@schedule-x/events-service — Event CRUD (add, remove, getAll, update)
@schedule-x/theme-default — Base CSS theme (overridden with WrapFlow colors)
temporal-polyfill        — Required by Schedule-X for date handling
```

No `@sx-premium/*` packages. Multi-day spanning and all views are free tier.

## Architecture

### What Changes

- **CalendarPage.tsx** — Rewritten to use `useNextCalendarApp` for Schedule-X integration, transform events to Schedule-X format, sync filters via eventsService bulk replace helper
- **globals.css** — Add `--sx-*` CSS variable overrides for dark/light theme integration
- **CalendarToolbar.tsx** — Add a "List" view toggle button since Schedule-X doesn't have list view; otherwise unchanged

### What Gets Deleted

- `CalendarHeader.tsx` — Schedule-X provides built-in navigation (prev/next/today/view switcher)
- `WeekView.tsx` — Replaced by Schedule-X week view
- `DayView.tsx` — Replaced by Schedule-X day view
- `MonthView.tsx` — Replaced by Schedule-X month grid
- `EventCard.tsx` — Schedule-X renders its own styled event elements

### What Stays the Same

- API fetching (`/api/work-orders?limit=100`) and all API types
- Data transformation (WorkOrderResponse → CalendarEvent)
- Phase derivation algorithm, overdue detection, installer extraction
- Role-based presets (ROLE_PRESETS)
- Filter logic (phase chips, status dropdown, color-by toggle, installer chips)
- `CalendarToolbar.tsx` — Phase/status/color-by filters (operates on our state layer)
- `ListView.tsx` — DataTable-based list view (Schedule-X doesn't do tables)
- `SummaryBar.tsx` — Job count and phase breakdown bar
- `frontend/src/lib/types.ts` — CalendarEvent interface unchanged
- `frontend/src/lib/roles.ts` — Navigation entries unchanged

## Schedule-X Configuration

```typescript
const calendar = useNextCalendarApp({
  views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
  defaultView: viewNameFromPreset, // mapped from ROLE_PRESETS
  selectedDate: Temporal.PlainDate.from(todayStr),
  isDark: document.documentElement.getAttribute('data-theme') !== 'light',
  locale: 'en-US',
  firstDayOfWeek: 1, // Monday
  dayBoundaries: { start: '08:00', end: '18:00' },
  weekOptions: {
    nDays: 5,       // Mon-Fri
    eventWidth: 95,  // Small right margin
  },
  monthGridOptions: {
    nEventsPerDay: 3, // Then "+N more"
  },
  calendars: { /* phase + installer color calendars */ },
  events: [], // populated via eventsService bulk replace helper
  plugins: [eventsService],
  callbacks: {
    onRangeUpdate(range) { /* sync visible range for SummaryBar */ },
    onEventClick(event) { /* future: navigate to work order detail */ },
  },
});
```

## Phase Color Calendars

Schedule-X uses a `calendars` config to define event color schemes. Each phase maps to a calendar ID:

```typescript
const PHASE_CALENDARS = {
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
```

## Installer Color Calendars

Dynamically generated from the existing 8-color palette. Each installer gets a calendar ID like `installer-0`, `installer-1`, etc.:

```typescript
function buildInstallerCalendars(installers: Installer[]): Record<string, CalendarConfig> {
  const result: Record<string, CalendarConfig> = {};
  for (const inst of installers) {
    const hex = inst.color; // e.g., '#2563eb'
    result[inst.id] = {
      colorName: inst.id,
      darkColors:  { main: hex, container: darken(hex, 0.6), onContainer: lighten(hex, 0.4) },
      lightColors: { main: hex, container: lighten(hex, 0.85), onContainer: darken(hex, 0.3) },
    };
  }
  return result;
}
```

The `darken()`/`lighten()` are new utility functions implemented in CalendarPage. They parse hex to RGB, scale channels toward black/white by the given factor, and return hex strings. No external color library needed — the math is ~10 lines each.

## Calendars Config Strategy

Include ALL calendar entries (both phase and installer) in the initial `calendars` config object. When `colorBy` changes, only the `calendarId` property on events changes — the calendars config itself never needs dynamic updates.

```typescript
const allCalendars = {
  ...PHASE_CALENDARS,
  ...buildInstallerCalendars(installers),
};
```

This is passed once to `useNextCalendarApp`. Both phase and installer calendars coexist; only events reference one set at a time.

## Color-By Toggle

When `colorBy` changes between 'phase' and 'installer':
1. Recompute `calendarId` on each event (phase name or installer ID)
2. Push updated events via the bulk replace helper (see Events Service API below)

No calendars config change needed — both phase and installer entries already exist.

## Events Service API

Schedule-X's `eventsService` plugin exposes `.add()`, `.remove()`, `.get()`, `.getAll()`, and `.update()`. There is no `.set()` bulk replace method.

**Bulk replace helper:**
```typescript
function replaceAllEvents(
  eventsService: EventsServicePlugin,
  newEvents: ScheduleXEvent[]
) {
  // Remove all existing events
  const existing = eventsService.getAll();
  for (const e of existing) {
    eventsService.remove(e.id);
  }
  // Add new events
  for (const e of newEvents) {
    eventsService.add(e);
  }
}
```

This helper is called whenever:
- Initial data loads from API
- Filters change (phase/status/colorBy)
- `colorBy` toggles (calendarId reassignment)

**Initialization pattern** (from Schedule-X React docs):
```typescript
const eventsService = useState(() => createEventsServicePlugin())[0];
```

## Event Transformation

CalendarEvent → Schedule-X event format:

```typescript
interface ScheduleXEvent {
  id: string;
  title: string;       // "Full Wrap - WO-1042"
  start: string;       // "2026-03-10 08:00" (YYYY-MM-DD HH:mm) or "2026-03-10" (full-day)
  end: string;         // "2026-03-12 17:00" or "2026-03-12" (full-day)
  calendarId: string;  // phase name or installer ID
  description?: string; // vehicle + client info
  _customData?: {      // preserved for SummaryBar/filtering
    phase: Phase;
    priority: string;
    isOverdue: boolean;
    systemStatus: string | null;
    installer: string;
  };
}
```

Schedule-X accepts date-time strings in `"YYYY-MM-DD HH:mm"` format for timed events, and `"YYYY-MM-DD"` for full-day events. The `temporal-polyfill` import enables `Temporal.PlainDate` support, but string format works for both.

### Multi-Day Event Detection

If `date_in` and `estimated_completion_date` are on different days:
- Use date-only strings: `"2026-03-10"` / `"2026-03-12"` (full-day spanning event)
- Schedule-X automatically renders these as bars spanning across day cells

If same day:
- Use datetime strings: `"2026-03-10 08:00"` / `"2026-03-10 17:00"`
- Renders as timed events in day/week views

## Dark Mode Sync

Schedule-X's `isDark` config is set on initialization by reading `document.documentElement.getAttribute('data-theme')`. If the theme toggles without a page reload, the `<ScheduleXCalendar>` component should be keyed on the theme value (e.g., `<ScheduleXCalendar key={theme} ... />`) to force a remount with the correct `isDark` setting.

## Required CSS Import

The Schedule-X default theme CSS must be imported in `CalendarPage.tsx`:

```typescript
import '@schedule-x/theme-default/dist/index.css';
```

This provides the base styles that our `--sx-*` variable overrides customize.

## CSS Theme Overrides

Added to `globals.css` to integrate Schedule-X with WrapFlow's design system:

Both blocks below reference the same WrapFlow CSS custom properties, which already resolve to different values per theme. The light mode block is needed because Schedule-X applies its own dark mode overrides internally that must be countered.

### Dark Mode (default)
```css
:root {
  --sx-color-surface: var(--surface-base);
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
}
```

### Light Mode
```css
[data-theme="light"] {
  --sx-color-surface: var(--surface-base);
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
}
```

## CalendarPage Component Flow

1. Mount → `useRole()` → get preset (view, phases, status)
2. Determine `isDark` from `data-theme` attribute
3. Initialize `eventsService` plugin: `const eventsService = useState(() => createEventsServicePlugin())[0]`
4. Initialize `useNextCalendarApp` with config (views, isDark, allCalendars, plugins, callbacks)
5. Render: `<ScheduleXCalendar calendarApp={calendar} />`
6. Fetch work orders → transform → filter by active phases/status/colorBy
7. Push filtered events via `replaceAllEvents(eventsService, transformedEvents)`
8. On filter change → recompute filtered events → `replaceAllEvents()`
9. On colorBy change → reassign calendarIds on events → `replaceAllEvents()`
10. `onRangeUpdate` callback → update `visibleRange` state (start/end strings) → SummaryBar uses range to scope counts
11. When user selects "List" view → hide `<ScheduleXCalendar>`, show `<ListView>`

## View Toggle (List Mode)

Schedule-X doesn't support table/list views. We track `activeView` in React state:

- `activeView` has values: `'schedule-x' | 'list'`
- When `activeView === 'list'`, hide the `<ScheduleXCalendar>` div (CSS `display: none`, not unmount — preserves Schedule-X state) and show `<ListView>`
- CalendarToolbar renders a "List" toggle button. Clicking it sets `activeView = 'list'`
- A separate "Calendar" button (or clicking back) sets `activeView = 'schedule-x'`
- Schedule-X's internal view switching (Day/Week/Month) is handled by Schedule-X itself — we don't track which sub-view is active

## SummaryBar Adaptation

SummaryBar receives `events` and a `viewLabel` string:

- **Events**: All filtered events from our React state (unchanged)
- **View label**: Derived from `onRangeUpdate` callback. The callback provides `range.start` and `range.end` strings. Logic:
  - If start === end → "Today" (single day)
  - If end - start <= 7 days → "This week"
  - If end - start > 7 days → "This month"
  - If `activeView === 'list'` → "Showing"
- **Phase counts**: Computed from filtered events scoped to the visible range. For list view, all filtered events are counted. For Schedule-X views, events are filtered to those within `range.start` to `range.end`.
- SummaryBar interface changes: replace `activeView: ViewMode` prop with `viewLabel: string` prop

## Error & Loading States

Unchanged from current implementation:
- **Loading**: CalendarSkeleton with animated pulse boxes
- **Error**: Centered error icon + message + retry button
- **Empty (no data)**: "No work orders found"
- **Empty (filtered)**: "No jobs match your filters" + "Clear filters" button

## File Summary

| File | Action | Notes |
|------|--------|-------|
| `CalendarPage.tsx` | Rewrite | Schedule-X integration, event transformation |
| `CalendarToolbar.tsx` | Modify | Add List view toggle button |
| `SummaryBar.tsx` | Modify | Adapt view label from Schedule-X range |
| `globals.css` | Modify | Add --sx-* variable overrides |
| `CalendarHeader.tsx` | Delete | Schedule-X has built-in nav |
| `WeekView.tsx` | Delete | Replaced by Schedule-X |
| `DayView.tsx` | Delete | Replaced by Schedule-X |
| `MonthView.tsx` | Delete | Replaced by Schedule-X |
| `EventCard.tsx` | Delete | Schedule-X renders events |
| `package.json` | Modify | Add Schedule-X dependencies |

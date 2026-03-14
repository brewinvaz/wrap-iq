# Calendar Event Pill & Hover Tooltip

## Problem

Calendar event pills currently show only the time, job type, and job number (e.g., "8:00 AM Personal - WO-0001 (Day 2/11)"). This doesn't provide enough useful information at a glance — users need to see the client and vehicle without clicking. There's also no hover state to reveal additional details like priority, phase, or status.

## Design

### Approach: Custom Month Grid Event Component

Schedule-X supports a `monthGridEvent` custom component slot via the `customComponents` prop on `ScheduleXCalendar`. We create a new React component that replaces the default pill rendering with:

1. An enriched two-line pill showing client + vehicle at a glance
2. A hover tooltip popover with full details, priority badge, and "View details" link

### New File

**`frontend/src/components/calendar/MonthGridEvent.tsx`** — Custom event component for Schedule-X month grid.

### Modified Files

- **`frontend/src/components/calendar/CalendarPage.tsx`** — Pass custom fields through Schedule-X events, wire up `customComponents` prop

### Data Flow

Schedule-X event objects only carry `id`, `title`, `description`, `calendarId`, `start`, `end`. To access priority, phase, status, vehicle, clientName, etc. in the custom component, we pass them as extra properties on the Schedule-X event object. Schedule-X preserves custom properties as "foreign properties" and passes them through to custom components via `calendarEvent`.

**SXEvent type:** The existing `SXEvent` interface in `CalendarPage.tsx` must be extended to include the custom fields so TypeScript accepts them. Add the underscore-prefixed fields to the interface.

**Custom component props:** Schedule-X passes `{ calendarEvent, hasStartDate }` to the `monthGridEvent` component. The custom fields are accessible at `calendarEvent._priority`, `calendarEvent._clientName`, etc. The `calendarEvent` object also includes `calendarId` which maps to the work order calendar (used for the color stripe).

In `toScheduleXEvents()`, each event gets additional underscore-prefixed fields:

- `_priority` — `'high' | 'medium' | 'low'`
- `_phase` — `'design' | 'production' | 'install'`
- `_status` — status string
- `_vehicle` — vehicle label
- `_clientName` — client name
- `_jobNumber` — job number string
- `_woId` — the base work order UUID (`e.id`, without the `-dayN` suffix used for multi-day event IDs)
- `_dayLabel` — `'Day 2/11'` for multi-day events, `null` for single-day
- `_jobType` — job type label (e.g., "Personal Wrap")

### Event Pill Content

**Current:** Single line — `"8:00 AM Personal - WO-0001 (Day 2/11)"`

**Proposed:** Two lines:
- **Line 1:** Job number + client name, truncated with ellipsis. For multi-day events, day label (`Day 2/11`) is right-aligned on this line.
- **Line 2:** Vehicle info in muted/secondary text color, truncated with ellipsis.

Example: `WO-0001 · Acme Corp          Day 2/11`
         `2024 Tesla Model S`

The pill retains the existing left-border color stripe and background color from the work order calendar assignment (available via `calendarEvent.calendarId`). Styling uses CSS custom properties (`var(--text-primary)`, `var(--text-muted)`, etc.) for theme compatibility.

The `title` string for multi-day events no longer includes `(Day X/Y)` — that info moves to `_dayLabel` and is rendered separately in the pill layout. The `title` is set to just `{jobType} - {jobNumber}` for all events.

### Hover Tooltip

A popover card that appears on hover, showing full event details.

**Content:**
- **Header row:** Job number (bold) + job type label (muted), with priority badge right-aligned
- **Fields grid:** Key-value pairs — Client, Vehicle, Phase, Status, Schedule (day label for multi-day events, omitted for single-day)
- **Footer:** Divider line + "View details →" link navigating to `/dashboard/work-orders/[woId]`

**Priority badge:** Uses the existing app pattern from `KanbanCard.tsx`:
- High: `bg-rose-500/20 text-rose-700 dark:text-rose-500`
- Medium: `bg-amber-500/20 text-amber-700 dark:text-amber-500`
- Low: `bg-emerald-500/20 text-emerald-700 dark:text-emerald-500`
- Rendered as `rounded-full px-2 py-0.5 text-xs font-medium`

**Behavior:**
- **Trigger:** `mouseenter` on the pill with a **200ms delay** to avoid flicker on quick mouse passes
- **Dismiss:** `mouseleave` from both the pill and the tooltip. The tooltip remains visible while the cursor is over it (allows clicking "View details")
- **Position:** Rendered via `createPortal` to `document.body` to escape any `overflow: hidden` on month grid day cells. Positioned below the pill using `getBoundingClientRect()`. If the tooltip would overflow below the viewport, it flips above the pill. If it would overflow the right edge, it right-aligns instead. Uses `z-50` stacking context.
- **"View details" link:** Uses a Next.js `<Link>` component pointing to `/dashboard/work-orders/${woId}`. This avoids `useRouter` overhead per event instance and allows middle-click / open-in-new-tab.
- **Touch devices:** Touch/mobile is out of scope for this change. The tooltip is hover-only (desktop).

**Styling:**
- `rounded-xl border border-[var(--border)] bg-[var(--surface-card)] shadow-lg`
- Width: 260px
- Uses CSS custom properties for full dark/light theme support

### Components Changed

- **`MonthGridEvent.tsx`** (new) — Custom month grid event component with pill + tooltip
- **`CalendarPage.tsx`** (modify) — Add custom fields to `toScheduleXEvents()`, pass `customComponents={{ monthGridEvent: MonthGridEvent }}` to `ScheduleXCalendar`
- **`CalendarToolbar.tsx`** — No changes
- **`SummaryBar.tsx`** — No changes
- **`globals.css`** — May need minor adjustments to `.sx__month-grid-event` styles to avoid conflicts with the custom component

## Testing

Playwright MCP visual verification:
- Pill content: enriched pills show job number, client name, and vehicle
- Multi-day label: "Day X/Y" appears on multi-day event pills
- Hover tooltip: appears with all fields and priority badge after hover
- "View details" link: navigates to work order detail page
- Tooltip dismiss: disappears on mouseleave
- Dark + light mode: both themes render correctly
- Existing filters: priority/client filters still work with new event component

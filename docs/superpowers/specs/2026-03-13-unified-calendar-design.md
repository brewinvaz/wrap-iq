# Unified Calendar — Design Spec

## Problem

Three separate pages display work orders on calendar/schedule views:
- `/dashboard/calendar` — Day/Week/Month views with installer filtering
- `/dashboard/schedule` — Simple Mon-Fri weekly kanban by phase
- `/dashboard/install-schedule` — List + Week view with status filter tabs

All three fetch the same `/api/work-orders?limit=100` endpoint. They have inconsistent styling, different feature sets, and duplicate code. Users must navigate between pages to get different perspectives on the same data.

## Solution

Consolidate all three into a single premium calendar page at `/dashboard/calendar` with a clean rebuild using Glass & Depth visual design. Role-based default presets surface the right view and filters for each user type.

## Visual Design: Glass & Depth

### Dark Mode
- Frosted glass panels: `background: rgba(255,255,255,0.04)` with `backdrop-filter: blur(8px)` and `border: 1px solid rgba(255,255,255,0.06)`
- Event cards: Phase-tinted glass backgrounds (e.g., `rgba(6,182,212,0.08)`) with matching subtle borders (`rgba(6,182,212,0.15)`)
- Today highlight: Subtle cyan glow on cell (`background: rgba(6,182,212,0.03)`, `box-shadow: 0 0 12px rgba(6,182,212,0.05)`)
- Surfaces use existing CSS variables for base layers: `--surface-app`, `--surface-card`, `--surface-raised`, `--surface-overlay`
- Glass effects use hardcoded rgba values (not CSS variables) since they require transparency that solid color variables can't provide
- Accent colors: `--accent-primary` (cyan), `--accent-secondary` (blue)
- Phase colors: `--phase-design` (cyan), `--phase-production` (blue), `--phase-install` (emerald), `--phase-done` (slate)

### Light Mode
- Glass panels: `background: rgba(255,255,255,0.8)` with `backdrop-filter: blur(8px)` and `border: 1px solid rgba(0,0,0,0.06)`
- Soft shadows: `box-shadow: 0 1px 3px rgba(0,0,0,0.04)` for depth
- Event cards: Lighter phase tints (e.g., `rgba(8,145,178,0.06)`) with matching borders
- Uses existing light theme CSS variables for text/accent colors
- Glass rgba values are conditional on theme — use `[data-theme="light"]` selectors or a `useTheme()` hook to switch between dark/light glass values

### New CSS Variables (add to globals.css)
```css
/* Glass surface helpers — dark mode */
--glass-bg: rgba(255,255,255,0.04);
--glass-border: rgba(255,255,255,0.06);
--glass-bg-hover: rgba(255,255,255,0.06);

/* Glass surface helpers — light mode */
[data-theme="light"] {
  --glass-bg: rgba(255,255,255,0.8);
  --glass-border: rgba(0,0,0,0.06);
  --glass-bg-hover: rgba(255,255,255,0.9);
}
```

## Routing & Navigation

### Pages
- **Keep**: `/dashboard/calendar` — renders the new unified `CalendarPage` component
- **Delete**: `/dashboard/schedule/page.tsx` (and directory)
- **Delete**: `/dashboard/install-schedule/page.tsx` (and directory)
- **Update**: `/dashboard/calendar/page.tsx` metadata title from "Install Calendar — WrapFlow" to "Calendar — WrapFlow"

### Navigation Updates (`roles.ts`)

Exact changes per role:

**Admin** (`navGroups[0]` Workspace):
- Line 48: Keep Calendar entry (`/dashboard/calendar`), remove badge since it's not notification-specific
- Line 50: **Delete** Schedule entry (`/dashboard/schedule`)
- `navGroups[1]` Production, line 59: **Delete** Install Schedule entry (`/dashboard/install-schedule`)

**PM** (`navGroups[0]` Projects):
- Line 101: **Change** `{ icon: 'CalendarDays', label: 'Schedule', href: '/dashboard/schedule' }` → `{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' }`

**Installer** (`navGroups[0]` My Work):
- Line 134: **Change** `{ icon: 'CalendarDays', label: 'My Schedule', href: '/dashboard/schedule' }` → `{ icon: 'Calendar', label: 'My Schedule', href: '/dashboard/calendar' }`

**Designer** (`navGroups[0]` Design):
- **Add** new entry: `{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' }` after "My Queue"

**Production** (`navGroups[1]` Jobs):
- Line 197: **Change** `{ icon: 'CalendarDays', label: 'Schedule', href: '/dashboard/schedule' }` → `{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' }`

**Client**: No changes (no nav items).

## Views

Four view modes accessible via a segmented control in the header:

### Day View
- Hourly timeline grid (8 AM – 5 PM)
- When color-by-installer: columns for each active installer (current behavior)
- When color-by-phase: single timeline column, events stacked by time with phase-colored cards
- Event blocks span hours based on start/end time

### Week View (default for most roles)
- Mon-Fri 5-column grid
- Day cells contain event cards stacked vertically
- Today column highlighted with accent glow
- Empty cells show dashed-border placeholder

### Month View
- 7-column Sun-Sat grid
- Day cells show: day number (accent circle if today), job count badge, up to 3 event title previews
- When a cell has >3 events, show "+N more" text below the 3rd preview
- Click a day to switch to Day view for that date

### List View (new — replaces install-schedule)
- Uses existing `DataTable` component
- Columns: Job #, Client, Vehicle, Phase (colored badge), Priority (colored badge), Scheduled Date, Due Date, Status (colored badge)
- Overdue detection: `dueDate < now() && !completionDate` → red "OVERDUE" badge next to status
- Sorting: Not in scope for this iteration — DataTable renders in default order (by date_in). Sorting can be added as a follow-up.
- Row click: No action for now (future: navigate to work order detail)

## Filters & Controls

### Header Layout
```
[ ← ] [ → ] [ Today ]    March 10 – 14, 2026    [ Day | Week | Month | List ]
```

### Filter Bar (below header)
```
Phase: [Design] [Production] [Install]  |  Status: [All ▾]  |  Color: [Phase ▾]  |  [Installer chips when color=installer]
```

| Filter | Component | Options | Default |
|--------|-----------|---------|---------|
| Phase | Toggle chips (multi-select) | Design, Production, Install | All active |
| Status | Dropdown | All, Upcoming, In Progress, Completed | All |
| Color by | Dropdown | Phase, Installer | Phase |
| Installer | Toggle chips (multi-select) | Extracted from work orders | All active (shown only when color=installer) |

### Phase Derivation Algorithm

Each work order is assigned a phase based on these rules (checked in order):

```
1. If status.system_status === 'completed' → phase = 'install' (completed installs)
2. If status.system_status === 'in_progress' → phase = 'install' (active installs)
3. If job_type (lowercased) contains 'design' → phase = 'design'
4. If job_type (lowercased) contains 'print' OR 'production' → phase = 'production'
5. Otherwise → phase = 'install' (default)
```

This reuses the exact logic from the existing `schedule/page.tsx` `derivePhase()` function.

### Status Filter Logic

| Filter Value | Condition |
|-------------|-----------|
| All | No filtering |
| Upcoming | `system_status` is null/undefined AND (`estimated_completion_date` is null OR `estimated_completion_date >= today`) |
| In Progress | `system_status === 'in_progress'` |
| Completed | `system_status === 'completed'` |

A work order with `system_status = null` and a past `estimated_completion_date` is still considered "Upcoming" (it may be overdue but hasn't started).

### Color Modes
- **Color by Phase** (default): Event cards use phase colors from CSS variables
  - Design: `--phase-design` (#06b6d4 dark / #0891b2 light)
  - Production: `--phase-production` (#3b82f6 dark / #2563eb light)
  - Install: `--phase-install` (#10b981 dark / #059669 light)
- **Color by Installer**: Event cards use deterministic installer colors from the 8-color palette (same as current CalendarPage)
- `--phase-done` exists in CSS but is not a filterable phase — it's available for future use in the summary bar or completed-state styling

## Role-Based Defaults

When the calendar loads, it reads the user's role via the existing `useRole()` hook from `role-context.tsx` and applies a preset. Users can change any filter after load.

```typescript
const ROLE_PRESETS: Record<RoleKey, CalendarPreset> = {
  admin:      { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  pm:         { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  installer:  { view: 'week', phases: ['install'],                        status: 'all' },
  production: { view: 'list', phases: ['production', 'install'],          status: 'in_progress' },
  designer:   { view: 'week', phases: ['design'],                         status: 'all' },
  client:     { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
};
```

Defaults are applied once on initial mount. Subsequent filter changes are user-driven.

## Component Architecture

All components live in `frontend/src/components/calendar/`.

### New Files (clean rebuild)
- `CalendarPage.tsx` — Main orchestrator (state, data fetching, filter logic, role presets)
- `CalendarHeader.tsx` — Navigation arrows, Today button, date label, view segmented control
- `CalendarToolbar.tsx` — Phase chips, status dropdown, color-by dropdown, installer chips
- `WeekView.tsx` — 5-day grid with glass event cards
- `DayView.tsx` — Hourly timeline with installer/phase columns
- `MonthView.tsx` — Month grid with event previews
- `ListView.tsx` — DataTable wrapper with columns and overdue detection
- `EventCard.tsx` — Shared glass-styled event card (used by Week, Day, Month views)
- `SummaryBar.tsx` — Bottom bar with job count and phase breakdown

### Deleted Files
- `frontend/src/app/dashboard/schedule/page.tsx` (and directory)
- `frontend/src/app/dashboard/install-schedule/page.tsx` (and directory)
- Old calendar component files are replaced in-place (same directory, new implementations)

### Shared Dependencies
- `@/components/ui/Button` — navigation buttons
- `@/components/ui/DataTable` — list view
- `@/lib/api-client` — API fetching (`api.get()`, `ApiError`)
- `@/lib/types` — Updated `CalendarEvent`, `Installer` types
- `@/lib/role-context` — `useRole()` hook for role-based defaults

## Type Changes

### CalendarEvent — Replace existing type

The current `CalendarEvent` type is installer-centric. Replace it entirely with a work-order-centric type:

```typescript
export interface CalendarEvent {
  id: string;
  jobNumber: string;
  title: string;              // e.g., "Full Wrap - WO-1042"
  vehicle: string;            // e.g., "2024 Tesla Model 3"
  clientName: string;
  date: string;               // YYYY-MM-DD (from date_in)
  startTime: string;          // HH:MM
  endTime: string;            // HH:MM
  phase: 'design' | 'production' | 'install';
  status: string;             // kanban stage name (e.g., "In Production")
  systemStatus: string | null; // raw system_status for filtering
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;     // estimated_completion_date
  isOverdue: boolean;          // computed: dueDate < today && systemStatus !== 'completed'
  // Installer fields (used when color-by=installer)
  installer: string;           // installer ID
  installerInitials: string;
  installerColor: string;
}
```

The old fields `projectId`, `difficulty`, `location`, `color`, `installerColor` are removed or replaced. Since all calendar components are being rebuilt, no migration is needed — the old type is simply replaced.

### Installer type — No changes
The existing `Installer` interface is unchanged.

## Event Card Design

### Glass Card (used in Week, Day, Month detail views)
```
┌─────────────────────────────┐  ← phase-tinted glass bg + 1px border
│ Full Wrap - WO-1042         │  ← title: 9px, font-weight 500, --text-primary
│ 2024 Tesla Model 3          │  ← vehicle: 8px, --text-muted
│ Acme Corp                   │  ← client: 8px, --text-secondary (week/day only)
│ ● Design          ▲ HIGH    │  ← phase dot+label (7px) | priority badge (high only)
│                   OVERDUE   │  ← overdue badge (when applicable)
└─────────────────────────────┘
```

- Background: `rgba({phase-color}, 0.08)` with `border: 1px solid rgba({phase-color}, 0.12)`
- When color-by-installer: swap phase-color for installer color in bg/border
- Priority badge: Only shown for `high` priority. Text `▲ HIGH` in amber/rose.
- Overdue badge: `OVERDUE` text, `font-size: 7px`, `font-weight: 600`, `background: rgba(244,63,94,0.15)`, `color: #f43f5e`, `border-radius: 3px`, `padding: 1px 5px`. Displayed on same row as phase label, right-aligned.
- Border radius: 6px
- Padding: 5px 8px
- Month view compact variant: title only (no vehicle/client/priority), phase dot only

## Summary Bar

Fixed at bottom of the page:
```
This week: 5 jobs    ● 2 design    ● 1 production    ● 2 install
```

- Glass background: `var(--glass-bg)` with `border-top: 1px solid var(--glass-border)`
- Label adapts to active view: "Today" (day) / "This week" (week) / "This month" (month) / "Showing" (list)
- Phase dots use `--phase-design`, `--phase-production`, `--phase-install` colors
- Counts reflect currently filtered/visible events only

## Data Flow

1. `CalendarPage` mounts → calls `useRole()` → applies `ROLE_PRESETS[currentRole]` to set initial view, phase filter, and status filter
2. Fetches `/api/work-orders?limit=100` via `api.get<WorkOrderListResponse>()`
3. Transforms `WorkOrderResponse[]` → `CalendarEvent[]`:
   - Derives phase via the algorithm above
   - Computes `isOverdue`: `dueDate !== null && dueDate < today && systemStatus !== 'completed'`
   - Extracts time from `date_in` (defaults to 08:00 if midnight)
   - Computes `endTime` from `estimated_completion_date` if same day, else defaults to 17:00
4. Extracts unique installers from work orders (deterministic color assignment from 8-color palette)
5. Applies active filters (phase + status) to get visible events
6. Passes filtered events + view state to the active view component
7. View components render `EventCard` for each event

## Error & Loading States

- **Loading**: Glass-styled skeleton with animated pulse boxes matching the active view layout
- **Error**: Centered error icon + message + retry button (reuses existing pattern with `ApiError`)
- **Empty state (no data)**: "No work orders found" — shown when API returns 0 items
- **Empty state (filtered)**: "No jobs match your filters" with a "Clear filters" button — shown when items exist but all are filtered out

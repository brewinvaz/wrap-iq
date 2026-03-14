# Unified Calendar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate three calendar/schedule pages into a single premium calendar with Glass & Depth design, role-based presets, and phase/status/installer filtering.

**Architecture:** Clean rebuild of all calendar components in `frontend/src/components/calendar/`. Delete schedule and install-schedule pages. Update navigation in `roles.ts` to point all roles to `/dashboard/calendar`. Add glass CSS variables to `globals.css`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-13-unified-calendar-design.md`

---

## File Structure

### Files to Create/Rewrite
| File | Responsibility |
|------|---------------|
| `frontend/src/components/calendar/CalendarPage.tsx` | Main orchestrator: state, data fetching, transforms, role presets, filter logic |
| `frontend/src/components/calendar/CalendarHeader.tsx` | Navigation arrows, Today button, date label, view segmented control |
| `frontend/src/components/calendar/CalendarToolbar.tsx` | Phase chips, status dropdown, color-by dropdown, installer chips |
| `frontend/src/components/calendar/EventCard.tsx` | Shared glass-styled event card with phase/installer coloring |
| `frontend/src/components/calendar/WeekView.tsx` | Mon-Fri 5-column grid |
| `frontend/src/components/calendar/DayView.tsx` | Hourly timeline (8AM-5PM) with columns |
| `frontend/src/components/calendar/MonthView.tsx` | 7-column month grid with event previews |
| `frontend/src/components/calendar/ListView.tsx` | DataTable wrapper with overdue detection |
| `frontend/src/components/calendar/SummaryBar.tsx` | Bottom bar: job count + phase breakdown |

### Files to Modify
| File | Changes |
|------|---------|
| `frontend/src/lib/types.ts:40-54` | Replace `CalendarEvent` interface |
| `frontend/src/lib/roles.ts:48-197` | Update nav items for all roles |
| `frontend/src/app/globals.css:45-49,83-86` | Add glass CSS variables |
| `frontend/src/app/dashboard/calendar/page.tsx` | Update metadata title |

### Files to Delete
| File | Reason |
|------|--------|
| `frontend/src/app/dashboard/schedule/page.tsx` | Consolidated into calendar |
| `frontend/src/app/dashboard/install-schedule/page.tsx` | Consolidated into calendar |

---

## Chunk 1: Foundation — Types, CSS, Navigation, and Routing

### Task 1: Add Glass CSS Variables

**Files:**
- Modify: `frontend/src/app/globals.css:45,83`

- [ ] **Step 1: Add glass variables to dark theme**

After line 45 (`--phase-done: #64748b;`), add:

```css
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.06);
  --glass-bg-hover: rgba(255, 255, 255, 0.06);
```

- [ ] **Step 2: Add glass variables to light theme**

After line 83 (`--phase-done: #71717a;`), add:

```css
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(0, 0, 0, 0.06);
  --glass-bg-hover: rgba(255, 255, 255, 0.9);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(calendar): add glass CSS variables for dark/light themes"
```

---

### Task 2: Update CalendarEvent Type

**Files:**
- Modify: `frontend/src/lib/types.ts:40-54`

- [ ] **Step 1: Replace CalendarEvent interface**

Replace lines 40-54 in `types.ts` with:

```typescript
export interface CalendarEvent {
  id: string;
  jobNumber: string;
  title: string;
  vehicle: string;
  clientName: string;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:MM
  endTime: string;            // HH:MM
  phase: 'design' | 'production' | 'install';
  status: string;
  systemStatus: string | null;
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  isOverdue: boolean;
  installer: string;
  installerInitials: string;
  installerColor: string;
}
```

- [ ] **Step 2: Verify no other files import old CalendarEvent fields**

Run: `cd /Users/brewinvaz/repos/wrap-iq && grep -rn 'projectId\|difficulty\|location.*shop\|\.color' frontend/src/components/calendar/ --include='*.tsx' --include='*.ts'`

These files will be rewritten in later tasks, so compilation errors are expected and acceptable.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(calendar): replace CalendarEvent type with work-order-centric fields"
```

---

### Task 3: Update Navigation in roles.ts

**Files:**
- Modify: `frontend/src/lib/roles.ts:48,50,59,101,134,161,197`

- [ ] **Step 1: Update Admin Workspace nav**

In the admin `Workspace` items array:
- Remove `badgeKey` and `badgeVariant` from the Calendar entry (line 48)
- Delete the Schedule entry (line 50: `{ icon: 'CalendarDays', label: 'Schedule', href: '/dashboard/schedule' }`)

- [ ] **Step 2: Delete Admin Production Install Schedule entry**

In the admin `Production` items array:
- Delete line 59: `{ icon: 'Wrench', label: 'Install Schedule', href: '/dashboard/install-schedule' }`

- [ ] **Step 3: Update PM nav**

Change the Schedule entry in PM `Projects` items (line 101):
```typescript
{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
```

- [ ] **Step 4: Update Installer nav**

Change the My Schedule entry in Installer `My Work` items (line 134):
```typescript
{ icon: 'Calendar', label: 'My Schedule', href: '/dashboard/calendar' },
```

- [ ] **Step 5: Add Calendar to Designer nav**

Add after the "My Queue" entry in Designer `Design` items (after line 161):
```typescript
{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
```

- [ ] **Step 6: Update Production nav**

Change the Schedule entry in Production `Jobs` items (line 197):
```typescript
{ icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/roles.ts
git commit -m "feat(calendar): consolidate nav entries to unified calendar"
```

---

### Task 4: Update Calendar Route and Delete Old Pages

**Files:**
- Modify: `frontend/src/app/dashboard/calendar/page.tsx`
- Delete: `frontend/src/app/dashboard/schedule/page.tsx`
- Delete: `frontend/src/app/dashboard/install-schedule/page.tsx`

- [ ] **Step 1: Update calendar page metadata**

Change the metadata title in `frontend/src/app/dashboard/calendar/page.tsx`:
```typescript
export const metadata = {
  title: 'Calendar — WrapFlow',
};
```

- [ ] **Step 2: Delete schedule page**

```bash
rm -rf frontend/src/app/dashboard/schedule
```

- [ ] **Step 3: Delete install-schedule page**

```bash
rm -rf frontend/src/app/dashboard/install-schedule
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(calendar): remove schedule and install-schedule pages, update calendar title"
```

---

## Chunk 2: Shared Components — EventCard and SummaryBar

### Task 5: Build EventCard Component

**Files:**
- Create: `frontend/src/components/calendar/EventCard.tsx`

- [ ] **Step 1: Create EventCard**

```tsx
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
  compact?: boolean; // month view: title + phase dot only
}

export default function EventCard({ event, colorBy, compact = false }: EventCardProps) {
  const phaseColor = PHASE_COLORS[event.phase];

  // When color-by-installer, use installer color for bg/border
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/EventCard.tsx
git commit -m "feat(calendar): add glass-styled EventCard component"
```

---

### Task 6: Build SummaryBar Component

**Files:**
- Create: `frontend/src/components/calendar/SummaryBar.tsx`

- [ ] **Step 1: Create SummaryBar**

```tsx
'use client';

import { CalendarEvent } from '@/lib/types';

interface SummaryBarProps {
  events: CalendarEvent[];
  activeView: 'day' | 'week' | 'month' | 'list';
}

const VIEW_LABELS: Record<SummaryBarProps['activeView'], string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  list: 'Showing',
};

export default function SummaryBar({ events, activeView }: SummaryBarProps) {
  const designCount = events.filter((e) => e.phase === 'design').length;
  const productionCount = events.filter((e) => e.phase === 'production').length;
  const installCount = events.filter((e) => e.phase === 'install').length;

  return (
    <div className="flex items-center gap-6 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">{VIEW_LABELS[activeView]}:</span>
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
git add frontend/src/components/calendar/SummaryBar.tsx
git commit -m "feat(calendar): add SummaryBar component with phase breakdown"
```

---

## Chunk 3: Header and Toolbar

### Task 7: Build CalendarHeader Component

**Files:**
- Create: `frontend/src/components/calendar/CalendarHeader.tsx`

- [ ] **Step 1: Create CalendarHeader**

```tsx
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
      {/* Left: navigation */}
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

      {/* Right: view toggle */}
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/CalendarHeader.tsx
git commit -m "feat(calendar): add CalendarHeader with nav and view toggle"
```

---

### Task 8: Build CalendarToolbar Component

**Files:**
- Create: `frontend/src/components/calendar/CalendarToolbar.tsx`

- [ ] **Step 1: Create CalendarToolbar**

```tsx
'use client';

import { Installer } from '@/lib/types';

type Phase = 'design' | 'production' | 'install';
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';
type ColorBy = 'phase' | 'installer';

interface CalendarToolbarProps {
  activePhases: Set<Phase>;
  onTogglePhase: (phase: Phase) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  colorBy: ColorBy;
  onColorByChange: (colorBy: ColorBy) => void;
  installers: Installer[];
  activeInstallers: Set<string>;
  onToggleInstaller: (id: string) => void;
}

const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: 'design', label: 'Design', color: 'var(--phase-design)' },
  { key: 'production', label: 'Production', color: 'var(--phase-production)' },
  { key: 'install', label: 'Install', color: 'var(--phase-install)' },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export default function CalendarToolbar({
  activePhases,
  onTogglePhase,
  statusFilter,
  onStatusChange,
  colorBy,
  onColorByChange,
  installers,
  activeInstallers,
  onToggleInstaller,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-2.5 backdrop-blur-sm">
      {/* Phase chips */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Phase:</span>
      <div className="flex gap-1.5">
        {PHASES.map((p) => {
          const isActive = activePhases.has(p.key);
          return (
            <button
              key={p.key}
              onClick={() => onTogglePhase(p.key)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'border border-current'
                  : 'border border-transparent opacity-40'
              }`}
              style={{
                color: p.color,
                backgroundColor: isActive ? `color-mix(in srgb, ${p.color} 12%, transparent)` : 'transparent',
                borderColor: isActive ? `color-mix(in srgb, ${p.color} 20%, transparent)` : 'transparent',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-[var(--glass-border)]" />

      {/* Status dropdown */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status:</span>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      {/* Divider */}
      <div className="h-4 w-px bg-[var(--glass-border)]" />

      {/* Color by dropdown */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Color:</span>
      <select
        value={colorBy}
        onChange={(e) => onColorByChange(e.target.value as ColorBy)}
        className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
      >
        <option value="phase">Phase</option>
        <option value="installer">Installer</option>
      </select>

      {/* Installer chips — only when color-by=installer */}
      {colorBy === 'installer' && installers.length > 0 && (
        <>
          <div className="h-4 w-px bg-[var(--glass-border)]" />
          <div className="flex flex-wrap gap-1.5">
            {installers.map((inst) => {
              const isActive = activeInstallers.has(inst.id);
              return (
                <button
                  key={inst.id}
                  onClick={() => onToggleInstaller(inst.id)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-40'
                  }`}
                  style={{
                    backgroundColor: isActive ? `${inst.color}1a` : 'transparent',
                    border: `1px solid ${isActive ? `${inst.color}33` : 'transparent'}`,
                    color: inst.color,
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white"
                    style={{ backgroundColor: inst.color }}
                  >
                    {inst.initials}
                  </span>
                  {inst.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/CalendarToolbar.tsx
git commit -m "feat(calendar): add CalendarToolbar with phase/status/color filters"
```

---

## Chunk 4: View Components

### Task 9: Build WeekView Component

**Files:**
- Create: `frontend/src/components/calendar/WeekView.tsx`

- [ ] **Step 1: Create WeekView**

```tsx
'use client';

import { CalendarEvent } from '@/lib/types';
import EventCard from './EventCard';

interface WeekDay {
  date: Date;
  label: string;
  dateStr: string;
  isToday: boolean;
}

interface WeekViewProps {
  weekDays: WeekDay[];
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
}

export default function WeekView({ weekDays, events, colorBy }: WeekViewProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-5 gap-3">
        {weekDays.map((day) => {
          const dayEvents = events.filter((e) => e.date === day.dateStr);
          return (
            <div key={day.dateStr}>
              {/* Day header */}
              <div
                className={`mb-2 rounded-md px-2 py-1 text-center text-xs font-semibold uppercase tracking-wider ${
                  day.isToday
                    ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {day.label} {day.date.getDate()}
              </div>
              {/* Day cell */}
              <div
                className={`min-h-[120px] rounded-lg border p-2 ${
                  day.isToday
                    ? 'border-[var(--accent-primary-border)] bg-[rgba(6,182,212,0.03)] shadow-[0_0_12px_rgba(6,182,212,0.05)]'
                    : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                }`}
              >
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} colorBy={colorBy} />
                  ))}
                  {dayEvents.length === 0 && (
                    <div className="flex h-20 items-center justify-center">
                      <span className="text-sm text-[var(--text-muted)] opacity-30">+</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/WeekView.tsx
git commit -m "feat(calendar): add glass-styled WeekView component"
```

---

### Task 10: Build DayView Component

**Files:**
- Create: `frontend/src/components/calendar/DayView.tsx`

- [ ] **Step 1: Create DayView**

```tsx
'use client';

import { CalendarEvent, Installer } from '@/lib/types';
import EventCard from './EventCard';

interface DayViewProps {
  dateStr: string;
  isToday: boolean;
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
  installers: Installer[];
  activeInstallers: Set<string>;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8AM - 5PM

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export default function DayView({
  dateStr,
  isToday,
  events,
  colorBy,
  installers,
  activeInstallers,
}: DayViewProps) {
  const dayEvents = events.filter((e) => e.date === dateStr);

  // When color-by-installer, show columns per installer
  // When color-by-phase, show single timeline
  const useInstallerColumns = colorBy === 'installer';
  const filteredInstallers = installers.filter((i) => activeInstallers.has(i.id));
  const columns = useInstallerColumns ? filteredInstallers : [{ id: 'all', name: 'All', initials: '', color: '' }];

  return (
    <div className="flex-1 overflow-auto">
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: `80px repeat(${columns.length}, 1fr)`,
        }}
      >
        {/* Column headers */}
        <div className="sticky top-0 z-10 border-b border-[var(--glass-border)] bg-[var(--surface-card)] p-2" />
        {columns.map((col) => (
          <div
            key={col.id}
            className="sticky top-0 z-10 border-b border-l border-[var(--glass-border)] bg-[var(--surface-card)] p-2 text-center text-xs font-semibold text-[var(--text-secondary)]"
          >
            {useInstallerColumns ? col.name : ''}
          </div>
        ))}

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <>
            <div
              key={`time-${hour}`}
              className="border-b border-[var(--glass-border)] px-3 py-3 text-right text-[10px] font-medium text-[var(--text-muted)]"
            >
              {formatHour(hour)}
            </div>
            {columns.map((col) => {
              const cellEvents = dayEvents.filter((e) => {
                const eventHour = parseInt(e.startTime.split(':')[0], 10);
                if (useInstallerColumns) {
                  return eventHour === hour && e.installer === col.id;
                }
                return eventHour === hour;
              });

              return (
                <div
                  key={`cell-${hour}-${col.id}`}
                  className={`border-b border-l border-[var(--glass-border)] p-1 ${
                    isToday ? 'bg-[rgba(6,182,212,0.02)]' : ''
                  }`}
                >
                  {cellEvents.map((event) => (
                    <EventCard key={event.id} event={event} colorBy={colorBy} />
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/DayView.tsx
git commit -m "feat(calendar): add glass-styled DayView component"
```

---

### Task 11: Build MonthView Component

**Files:**
- Create: `frontend/src/components/calendar/MonthView.tsx`

- [ ] **Step 1: Create MonthView**

```tsx
'use client';

import { CalendarEvent } from '@/lib/types';
import EventCard from './EventCard';

interface MonthViewProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  colorBy: 'phase' | 'installer';
  onDayClick: (date: Date) => void;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(startDow).fill(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthView({ year, month, events, colorBy, onDayClick }: MonthViewProps) {
  const weeks = getCalendarGrid(year, month);
  const todayStr = formatDateStr(new Date());
  const MAX_PREVIEWS = 3;

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="grid gap-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((date, di) => {
              if (!date) {
                return <div key={`empty-${di}`} className="min-h-[90px] rounded-md bg-[var(--surface-card)] opacity-30" />;
              }

              const dateStr = formatDateStr(date);
              const isToday = dateStr === todayStr;
              const dayEvents = events.filter((e) => e.date === dateStr);

              return (
                <div
                  key={dateStr}
                  onClick={() => onDayClick(date)}
                  className={`min-h-[90px] cursor-pointer rounded-md border p-1.5 transition-colors hover:bg-[var(--glass-bg-hover)] ${
                    isToday
                      ? 'border-[var(--accent-primary-border)] bg-[rgba(6,182,212,0.03)]'
                      : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isToday
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="rounded-full bg-[var(--surface-raised)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_PREVIEWS).map((event) => (
                      <EventCard key={event.id} event={event} colorBy={colorBy} compact />
                    ))}
                    {dayEvents.length > MAX_PREVIEWS && (
                      <p className="text-[8px] font-medium text-[var(--text-muted)]">
                        +{dayEvents.length - MAX_PREVIEWS} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/MonthView.tsx
git commit -m "feat(calendar): add glass-styled MonthView component"
```

---

### Task 12: Build ListView Component

**Files:**
- Create: `frontend/src/components/calendar/ListView.tsx`

- [ ] **Step 1: Create ListView**

```tsx
'use client';

import DataTable, { Column } from '@/components/ui/DataTable';
import { CalendarEvent } from '@/lib/types';

interface ListViewProps {
  events: CalendarEvent[];
}

const PHASE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  design: { bg: 'rgba(6,182,212,0.12)', text: 'var(--phase-design)' },
  production: { bg: 'rgba(59,130,246,0.12)', text: 'var(--phase-production)' },
  install: { bg: 'rgba(16,185,129,0.12)', text: 'var(--phase-install)' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'rgba(244,63,94,0.12)', text: '#f43f5e' },
  medium: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  low: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const columns: Column<CalendarEvent>[] = [
  {
    key: 'jobNumber',
    header: 'Job #',
    render: (row) => <span className="font-medium text-[var(--text-primary)]">{row.jobNumber}</span>,
  },
  {
    key: 'clientName',
    header: 'Client',
    render: (row) => <span className="text-[var(--text-secondary)]">{row.clientName}</span>,
  },
  {
    key: 'vehicle',
    header: 'Vehicle',
    render: (row) => <span className="text-[var(--text-secondary)]">{row.vehicle}</span>,
  },
  {
    key: 'phase',
    header: 'Phase',
    render: (row) => {
      const c = PHASE_BADGE_COLORS[row.phase];
      return <Badge label={row.phase} bg={c.bg} text={c.text} />;
    },
  },
  {
    key: 'priority',
    header: 'Priority',
    render: (row) => {
      const c = PRIORITY_COLORS[row.priority];
      return <Badge label={row.priority} bg={c.bg} text={c.text} />;
    },
  },
  {
    key: 'date',
    header: 'Scheduled',
    render: (row) => <span className="text-[var(--text-secondary)]">{formatDate(row.date)}</span>,
  },
  {
    key: 'dueDate',
    header: 'Due',
    render: (row) => (
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-secondary)]">{formatDate(row.dueDate)}</span>
        {row.isOverdue && (
          <span className="rounded-sm bg-[rgba(244,63,94,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#f43f5e]">
            OVERDUE
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
        {row.status}
      </span>
    ),
  },
];

export default function ListView({ events }: ListViewProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <DataTable
        columns={columns}
        data={events}
        rowKey={(row) => row.id}
        stickyHeader
        emptyState={
          <p className="text-sm text-[var(--text-muted)]">No jobs to display</p>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/calendar/ListView.tsx
git commit -m "feat(calendar): add ListView component with DataTable and overdue badges"
```

---

## Chunk 5: CalendarPage Orchestrator

### Task 13: Build CalendarPage — The Main Orchestrator

**Files:**
- Create: `frontend/src/components/calendar/CalendarPage.tsx`

This is the largest component. It handles:
- API data fetching and transformation
- Role-based preset application
- Filter state management
- Date navigation state
- View routing to sub-components

- [ ] **Step 1: Create CalendarPage**

```tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRole } from '@/lib/role-context';
import { api, ApiError } from '@/lib/api-client';
import { CalendarEvent, Installer } from '@/lib/types';
import { RoleKey } from '@/lib/roles';
import { Button } from '@/components/ui/Button';
import CalendarHeader from './CalendarHeader';
import CalendarToolbar from './CalendarToolbar';
import WeekView from './WeekView';
import DayView from './DayView';
import MonthView from './MonthView';
import ListView from './ListView';
import SummaryBar from './SummaryBar';

// ---------------------------------------------------------------------------
// API types
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
// Constants
// ---------------------------------------------------------------------------

type Phase = 'design' | 'production' | 'install';
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';
type ViewMode = 'day' | 'week' | 'month' | 'list';
type ColorBy = 'phase' | 'installer';

interface CalendarPreset {
  view: ViewMode;
  phases: Phase[];
  status: StatusFilter;
}

const ROLE_PRESETS: Record<RoleKey, CalendarPreset> = {
  admin: { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  pm: { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
  installer: { view: 'week', phases: ['install'], status: 'all' },
  production: { view: 'list', phases: ['production', 'install'], status: 'in_progress' },
  designer: { view: 'week', phases: ['design'], status: 'all' },
  client: { view: 'week', phases: ['design', 'production', 'install'], status: 'all' },
};

const INSTALLER_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#e11d48',
  '#d97706', '#0891b2', '#4f46e5', '#be185d',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
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
// Date label helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  const mLabel = monday.toLocaleDateString('en-US', opts);
  if (monday.getMonth() === friday.getMonth()) {
    return `${mLabel} – ${friday.getDate()}, ${monday.getFullYear()}`;
  }
  const fLabel = friday.toLocaleDateString('en-US', opts);
  return `${mLabel} – ${fLabel}, ${friday.getFullYear()}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonthLabel(year: number, month: number): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[month]} ${year}`;
}

// ---------------------------------------------------------------------------
// Skeleton & Error
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

  // View state
  const [activeView, setActiveView] = useState<ViewMode>(preset.view);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [monthYear, setMonthYear] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));

  // Filter state
  const [activePhases, setActivePhases] = useState<Set<Phase>>(() => new Set(preset.phases));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(preset.status);
  const [colorBy, setColorBy] = useState<ColorBy>('phase');
  const [activeInstallers, setActiveInstallers] = useState<Set<string>>(new Set());

  // Data state
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      return true; // 'all'
    });
  }, [allEvents, activePhases, statusFilter, colorBy, activeInstallers]);

  // Visible events (filtered + scoped to current view range)
  const todayStr = formatDateStr(new Date());

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateStr = formatDateStr(d);
      return {
        date: d,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        isToday: dateStr === todayStr,
      };
    });
  }, [weekStart, todayStr]);

  const visibleEvents = useMemo(() => {
    switch (activeView) {
      case 'day':
        return filteredEvents.filter((e) => e.date === formatDateStr(selectedDay));
      case 'week':
        return filteredEvents.filter((e) => weekDays.some((d) => d.dateStr === e.date));
      case 'month': {
        const first = formatDateStr(new Date(monthYear.year, monthYear.month, 1));
        const last = formatDateStr(new Date(monthYear.year, monthYear.month + 1, 0));
        return filteredEvents.filter((e) => e.date >= first && e.date <= last);
      }
      case 'list':
        return filteredEvents;
    }
  }, [activeView, filteredEvents, selectedDay, weekDays, monthYear]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    switch (activeView) {
      case 'day': setSelectedDay((p) => { const d = new Date(p); d.setDate(d.getDate() - 1); return d; }); break;
      case 'week': setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; }); break;
      case 'month': setMonthYear((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }); break;
    }
  }, [activeView]);

  const handleNext = useCallback(() => {
    switch (activeView) {
      case 'day': setSelectedDay((p) => { const d = new Date(p); d.setDate(d.getDate() + 1); return d; }); break;
      case 'week': setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; }); break;
      case 'month': setMonthYear((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }); break;
    }
  }, [activeView]);

  const handleToday = useCallback(() => {
    const now = new Date();
    switch (activeView) {
      case 'day': { const d = new Date(now); d.setHours(0,0,0,0); setSelectedDay(d); break; }
      case 'week': setWeekStart(getMonday(now)); break;
      case 'month': setMonthYear({ year: now.getFullYear(), month: now.getMonth() }); break;
    }
  }, [activeView]);

  const handleMonthDayClick = useCallback((date: Date) => {
    setSelectedDay(date);
    setActiveView('day');
  }, []);

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

  // Date label
  const dateLabel = useMemo(() => {
    switch (activeView) {
      case 'day': return formatDayLabel(selectedDay);
      case 'month': return formatMonthLabel(monthYear.year, monthYear.month);
      case 'list': return 'All Jobs';
      default: return formatWeekLabel(weekStart);
    }
  }, [activeView, selectedDay, monthYear, weekStart]);

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

  // Empty states
  const hasNoData = allEvents.length === 0;
  const hasNoFilteredResults = !hasNoData && visibleEvents.length === 0;

  const selectedDayStr = formatDateStr(selectedDay);

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        dateLabel={dateLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        activeView={activeView}
        onViewChange={setActiveView}
      />

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
              setActivePhases(new Set(['design', 'production', 'install']));
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {activeView === 'day' && (
            <DayView
              dateStr={selectedDayStr}
              isToday={selectedDayStr === todayStr}
              events={filteredEvents}
              colorBy={colorBy}
              installers={installers}
              activeInstallers={activeInstallers}
            />
          )}
          {activeView === 'week' && (
            <WeekView weekDays={weekDays} events={filteredEvents} colorBy={colorBy} />
          )}
          {activeView === 'month' && (
            <MonthView
              year={monthYear.year}
              month={monthYear.month}
              events={filteredEvents}
              colorBy={colorBy}
              onDayClick={handleMonthDayClick}
            />
          )}
          {activeView === 'list' && <ListView events={filteredEvents} />}
        </>
      )}

      <SummaryBar events={visibleEvents} activeView={activeView} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npx next build 2>&1 | tail -20`

Expected: Build succeeds or only has warnings (not errors related to calendar components).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/calendar/CalendarPage.tsx
git commit -m "feat(calendar): add unified CalendarPage orchestrator with role presets"
```

---

## Chunk 6: Final Integration and Cleanup

### Task 14: Verify Build and Test in Browser

- [ ] **Step 1: Run the dev server**

```bash
cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run dev
```

- [ ] **Step 2: Open browser and verify**

Navigate to `http://localhost:3000/dashboard/calendar`:
- Verify Week view loads with glass styling
- Switch between Day/Week/Month/List views
- Toggle phase filters
- Change status filter
- Switch color-by to Installer
- Test light/dark mode toggle
- Verify old routes `/dashboard/schedule` and `/dashboard/install-schedule` return 404

- [ ] **Step 3: Test role presets**

Switch roles via the sidebar avatar dropdown:
- Admin → Week view, all phases
- Installer → Week view, Install phase only
- Production → List view, Production+Install, In Progress status
- Designer → Week view, Design phase only

- [ ] **Step 4: Take screenshots of both themes**

Use Playwright MCP to capture dark and light mode screenshots to `.playwright-mcp/`.

- [ ] **Step 5: Final commit with all files**

```bash
cd /Users/brewinvaz/repos/wrap-iq
git add -A
git commit -m "feat(calendar): unified calendar with glass design, role presets, and 4 view modes

Consolidates /dashboard/schedule, /dashboard/install-schedule, and
/dashboard/calendar into a single premium calendar page.

- Glass & Depth visual design for dark and light modes
- Day/Week/Month/List views with segmented control
- Phase, status, and installer filtering
- Role-based default presets (view + filters per role)
- Overdue detection with visual badges
- Summary bar with phase breakdown"
```

---

### Task 15: Create GitHub Issue and PR (Standard Workflow)

- [ ] **Step 1: Create GitHub issue**

```bash
gh issue create --title "Consolidate schedule pages into unified calendar" --body "Merge /dashboard/schedule, /dashboard/install-schedule, and /dashboard/calendar into a single premium calendar page with Glass & Depth design, role-based presets, and phase/status/installer filtering."
```

- [ ] **Step 2: Add issue to project board**

```bash
gh project item-add 7 --owner brewinvaz --url <ISSUE_URL>
```

- [ ] **Step 3: Move to In Progress**

Use the project board field IDs from memory to move the item to "In progress".

- [ ] **Step 4: Create worktree and branch**

```bash
git worktree add .worktrees/unified-calendar -b feat/unified-calendar
```

- [ ] **Step 5: Apply all commits to the worktree branch**

Cherry-pick or rebase all calendar commits onto the feature branch.

- [ ] **Step 6: Push and create PR**

```bash
cd .worktrees/unified-calendar
git push -u origin feat/unified-calendar
gh pr create --title "Consolidate calendar/schedule into unified premium calendar" --body "Closes #<ISSUE_NUMBER>

## Summary
- Merge 3 calendar/schedule pages into one unified calendar
- Glass & Depth visual design (dark + light mode)
- Day/Week/Month/List views
- Phase, status, and installer filtering with role-based defaults
- Overdue detection and summary bar

## Test plan
- [ ] Verify all 4 views render correctly
- [ ] Test phase/status/color-by filters
- [ ] Test role presets (admin, installer, production, designer)
- [ ] Verify light and dark mode
- [ ] Confirm old routes return 404
- [ ] Check nav items updated for all roles"
```

- [ ] **Step 7: Move issue to In Review**

- [ ] **Step 8: Watch CI, fix any failures**

- [ ] **Step 9: Merge PR, move issue to Done, clean up worktree**

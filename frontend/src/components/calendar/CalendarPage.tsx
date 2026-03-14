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
  start: Temporal.ZonedDateTime | Temporal.PlainDate;
  end: Temporal.ZonedDateTime | Temporal.PlainDate;
  calendarId: string;
  description?: string;
}

const TZ = Temporal.Now.timeZoneId();

function toScheduleXEvents(events: CalendarEvent[], colorBy: ColorBy): SXEvent[] {
  return events.map((e) => {
    const calendarId = colorBy === 'installer' ? e.installer : e.phase;

    // Multi-day detection: if dueDate exists and differs from date
    const isMultiDay = e.dueDate && e.dueDate !== e.date;

    let start: Temporal.ZonedDateTime | Temporal.PlainDate;
    let end: Temporal.ZonedDateTime | Temporal.PlainDate;

    if (isMultiDay) {
      start = Temporal.PlainDate.from(e.date);
      end = Temporal.PlainDate.from(e.dueDate!);
    } else {
      start = Temporal.PlainDate.from(e.date)
        .toPlainDateTime(Temporal.PlainTime.from(e.startTime))
        .toZonedDateTime(TZ);
      end = Temporal.PlainDate.from(e.date)
        .toPlainDateTime(Temporal.PlainTime.from(e.endTime))
        .toZonedDateTime(TZ);
    }

    return {
      id: e.id,
      title: e.title,
      start,
      end,
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
    selectedDate: Temporal.PlainDate.from(todayStr),
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
        setVisibleRange({ start: range.start.toString(), end: range.end.toString() });
        // Derive view label from range span
        const dayDiff = range.start.until(range.end, { largestUnit: 'days' }).days;
        if (dayDiff <= 1) setViewLabel('Today');
        else if (dayDiff <= 7) setViewLabel('This week');
        else setViewLabel('This month');
      },
      onEventClick(calendarEvent, _e) {
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

'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import { createViewMonthGrid } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import 'temporal-polyfill/global';

import { api, ApiError } from '@/lib/api-client';
import { CalendarEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import CalendarToolbar from './CalendarToolbar';
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
// Types & Constants
// ---------------------------------------------------------------------------

type Phase = 'design' | 'production' | 'install';

/** 12 distinct hues for work-order color coding — visually separable in both themes. */
const WORK_ORDER_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#059669', // emerald
  '#7c3aed', // violet
  '#d97706', // amber
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#16a34a', // green
  '#e11d48', // rose
  '#4f46e5', // indigo
  '#ea580c', // orange
  '#0d9488', // teal
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
// Schedule-X calendar configs — one calendar per work order
// ---------------------------------------------------------------------------

export interface WorkOrderCalendar {
  jobNumber: string;
  color: string;
  calendarId: string;
}

type SXCalendarConfig = Record<string, {
  colorName: string;
  lightColors: { main: string; container: string; onContainer: string };
  darkColors: { main: string; container: string; onContainer: string };
}>;

function buildWorkOrderCalendars(
  workOrders: WorkOrderResponse[],
): { calendars: SXCalendarConfig; woCalendars: WorkOrderCalendar[] } {
  const seen = new Map<string, WorkOrderCalendar>();
  const calendars: SXCalendarConfig = {};

  for (const wo of workOrders) {
    if (seen.has(wo.job_number)) continue;
    const idx = seen.size % WORK_ORDER_COLORS.length;
    const color = WORK_ORDER_COLORS[idx];
    const calendarId = `wo-${wo.job_number}`;
    seen.set(wo.job_number, { jobNumber: wo.job_number, color, calendarId });
    calendars[calendarId] = {
      colorName: calendarId,
      darkColors:  { main: color, container: darken(color, 0.65), onContainer: lighten(color, 0.45) },
      lightColors: { main: darken(color, 0.1), container: lighten(color, 0.88), onContainer: darken(color, 0.35) },
    };
  }

  return { calendars, woCalendars: Array.from(seen.values()) };
}

// ---------------------------------------------------------------------------
// Data helpers
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

function transformWorkOrders(workOrders: WorkOrderResponse[], woCalendarMap: Map<string, WorkOrderCalendar>): CalendarEvent[] {
  const todayStr = formatDateStr(new Date());

  return workOrders.map((wo) => {
    const dateIn = new Date(wo.date_in);
    const dateStr = formatDateStr(dateIn);

    const woCal = woCalendarMap.get(wo.job_number);

    const startTime = '08:00';
    const endTime = '17:00';

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
      installer: woCal?.calendarId ?? 'wo-unknown',
      installerInitials: wo.job_number.slice(0, 3),
      installerColor: woCal?.color ?? WORK_ORDER_COLORS[0],
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

const DISPLAY_TZ = 'UTC';

function isWeekday(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 1 && date.dayOfWeek <= 5;
}

function getBusinessDays(start: Temporal.PlainDate, end: Temporal.PlainDate): Temporal.PlainDate[] {
  const days: Temporal.PlainDate[] = [];
  let current = start;
  while (Temporal.PlainDate.compare(current, end) <= 0) {
    if (isWeekday(current)) {
      days.push(current);
    }
    current = current.add({ days: 1 });
  }
  return days;
}

function toScheduleXEvents(events: CalendarEvent[]): SXEvent[] {
  const result: SXEvent[] = [];

  for (const e of events) {
    const calendarId = e.installer; // maps to work order calendar
    const description = `${e.vehicle} · ${e.clientName}`;

    const isMultiDay = e.dueDate && e.dueDate !== e.date;

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
          title: `${e.title} (Day ${dayNum}/${totalDays})`,
          start: day.toPlainDateTime(Temporal.PlainTime.from('08:00')).toZonedDateTime(DISPLAY_TZ),
          end: day.toPlainDateTime(Temporal.PlainTime.from('17:00')).toZonedDateTime(DISPLAY_TZ),
          calendarId,
          description,
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
      });
    }
  }

  return result;
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
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
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
// Inner calendar component — mounts only after data is ready so
// useNextCalendarApp gets the correct calendar colors at init.
// ---------------------------------------------------------------------------

interface MonthCalendarProps {
  calendars: SXCalendarConfig;
  events: CalendarEvent[];
  isDark: boolean;
  onRangeUpdate: (range: { start: string; end: string }) => void;
}

function MonthCalendar({ calendars, events, isDark, onRangeUpdate }: MonthCalendarProps) {
  const eventsService = useState(() => createEventsServicePlugin())[0];
  const todayStr = formatDateStr(new Date());

  // Capture initial events once at mount time (Schedule-X init only)
  const [initialSxEvents] = useState(() => toScheduleXEvents(events));

  const calendar = useNextCalendarApp({
    views: [createViewMonthGrid()],
    defaultView: 'month-grid',
    selectedDate: Temporal.PlainDate.from(todayStr),
    isDark,
    locale: 'en-US',
    firstDayOfWeek: 7, // Sunday (Schedule-X enum: 1=Mon..7=Sun)
    monthGridOptions: {
      nEventsPerDay: 4,
    },
    calendars,
    events: initialSxEvents,
    plugins: [eventsService],
    callbacks: {
      onRangeUpdate(range) {
        onRangeUpdate({ start: range.start.toString(), end: range.end.toString() });
      },
      onEventClick(calendarEvent) {
        console.log('Event clicked:', calendarEvent.id);
      },
    },
  });

  // Sync subsequent event changes (e.g. filter toggles) into Schedule-X
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return; // skip first render — initial events already passed to hook
    }
    const sxEvents = toScheduleXEvents(events);
    replaceAllEvents(eventsService, sxEvents);
  }, [events, eventsService]);

  return <ScheduleXCalendar calendarApp={calendar} />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  // Data state
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [woCalendars, setWoCalendars] = useState<WorkOrderCalendar[]>([]);
  const [sxCalendars, setSxCalendars] = useState<SXCalendarConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state — set of active work order job numbers
  const [activeWorkOrders, setActiveWorkOrders] = useState<Set<string>>(new Set());

  // View state
  const [viewLabel, setViewLabel] = useState('This month');
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null);

  // Theme detection — reactive via MutationObserver
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') !== 'light'
      : true
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.getAttribute('data-theme') !== 'light');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Fetch work orders
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<WorkOrderListResponse>('/api/work-orders?limit=100');
      const { calendars, woCalendars: woCals } = buildWorkOrderCalendars(data.items);
      setWoCalendars(woCals);
      setSxCalendars(calendars);
      const woCalendarMap = new Map(woCals.map((wc) => [wc.jobNumber, wc]));
      const events = transformWorkOrders(data.items, woCalendarMap);
      setAllEvents(events);
      setActiveWorkOrders(new Set(woCals.map((wc) => wc.jobNumber)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter events by active work orders
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => activeWorkOrders.has(e.jobNumber));
  }, [allEvents, activeWorkOrders]);

  // Visible events for SummaryBar (scoped to range)
  const summaryEvents = useMemo(() => {
    if (!visibleRange) return filteredEvents;
    const startStr = visibleRange.start.slice(0, 10);
    const endStr = visibleRange.end.slice(0, 10);
    return filteredEvents.filter((e) => e.date >= startStr && e.date <= endStr);
  }, [filteredEvents, visibleRange]);

  // Filter handlers
  const handleToggleWorkOrder = useCallback((jobNumber: string) => {
    setActiveWorkOrders((prev) => {
      const next = new Set(prev);
      if (next.has(jobNumber)) next.delete(jobNumber); else next.add(jobNumber);
      return next;
    });
  }, []);

  const handleSetAllWorkOrders = useCallback((jobNumbers: string[]) => {
    setActiveWorkOrders(new Set(jobNumbers));
  }, []);

  const handleRangeUpdate = useCallback((range: { start: string; end: string }) => {
    setVisibleRange(range);
    setViewLabel('This month');
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

  const uniqueWoCount = new Set(allEvents.map((e) => e.jobNumber)).size;

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">Calendar</h1>
          <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {uniqueWoCount} work {uniqueWoCount === 1 ? 'order' : 'orders'}
          </span>
        </div>
      </header>

      <CalendarToolbar
        woCalendars={woCalendars}
        activeWorkOrders={activeWorkOrders}
        onToggleWorkOrder={handleToggleWorkOrder}
        onSetAllWorkOrders={handleSetAllWorkOrders}
      />

      {hasNoData ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">No work orders found</p>
        </div>
      ) : hasNoFilteredResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">No work orders match your filter</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveWorkOrders(new Set(woCalendars.map((wc) => wc.jobNumber)))}
          >
            Show all
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <MonthCalendar
            key={`${isDark ? 'dark' : 'light'}-${woCalendars.length}`}
            calendars={sxCalendars}
            events={filteredEvents}
            isDark={isDark}
            onRangeUpdate={handleRangeUpdate}
          />
        </div>
      )}

      <SummaryBar events={summaryEvents} viewLabel={viewLabel} />
    </div>
  );
}

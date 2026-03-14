'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import CalendarHeader from './CalendarHeader';
import CalendarToolbar from './CalendarToolbar';
import WeekView from './WeekView';
import DayView from './DayView';
import MonthView from './MonthView';
import { api, ApiError } from '@/lib/api-client';
import { CalendarEvent, Installer } from '@/lib/types';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// API response interfaces
// ---------------------------------------------------------------------------

interface VehicleInWorkOrder {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface KanbanStageResponse {
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
  status: KanbanStageResponse | null;
  vehicles: VehicleInWorkOrder[];
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
// Installer color palette (assigned deterministically by index)
// ---------------------------------------------------------------------------

const INSTALLER_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#e11d48',
  '#d97706',
  '#0891b2',
  '#4f46e5',
  '#be185d',
];

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function vehicleLabel(vehicles: VehicleInWorkOrder[]): string {
  if (vehicles.length === 0) return 'No vehicle';
  const v = vehicles[0];
  const parts: string[] = [];
  if (v.year) parts.push(String(v.year));
  if (v.make) parts.push(v.make);
  if (v.model) parts.push(v.model);
  return parts.length > 0 ? parts.join(' ') : 'Vehicle';
}

function jobTypeLabel(jobType: string): string {
  return jobType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function difficultyFromPriority(
  priority: string,
): 'easy' | 'standard' | 'complex' {
  switch (priority) {
    case 'high':
      return 'complex';
    case 'low':
      return 'easy';
    default:
      return 'standard';
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Build a deterministic list of Installer objects from the work orders
 * themselves (since there is no dedicated users-list endpoint).
 */
function extractInstallers(workOrders: WorkOrderResponse[]): Installer[] {
  const seen = new Map<string, Installer>();

  for (const wo of workOrders) {
    const name = wo.client_name ?? 'Unassigned';
    if (!seen.has(name)) {
      const colorIdx = seen.size % INSTALLER_COLORS.length;
      seen.set(name, {
        id: `installer-${seen.size}`,
        name,
        initials: initials(name),
        color: INSTALLER_COLORS[colorIdx],
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Convert a list of WorkOrderResponse objects into CalendarEvent objects
 * that the existing WeekView / EventBlock components expect.
 */
function transformToCalendarEvents(
  workOrders: WorkOrderResponse[],
  installerMap: Map<string, Installer>,
): CalendarEvent[] {
  return workOrders.map((wo) => {
    const dateIn = new Date(wo.date_in);
    const endDate = wo.estimated_completion_date
      ? new Date(wo.estimated_completion_date)
      : null;

    const installerName = wo.client_name ?? 'Unassigned';
    const installer = installerMap.get(installerName);
    const color = installer?.color ?? INSTALLER_COLORS[0];

    const startHour = dateIn.getHours();
    const startMin = dateIn.getMinutes();
    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

    let endTime = '17:00'; // default full-day end
    if (endDate && formatDateStr(endDate) === formatDateStr(dateIn)) {
      const endHour = endDate.getHours();
      const endMinute = endDate.getMinutes();
      endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    }

    // If start time is midnight (00:00), default to business hours
    const effectiveStart = startTime === '00:00' ? '08:00' : startTime;
    const effectiveEnd = endTime === '00:00' ? '17:00' : endTime;

    return {
      id: wo.id,
      projectId: wo.job_number,
      title: `${jobTypeLabel(wo.job_type)} - ${wo.job_number}`,
      vehicle: vehicleLabel(wo.vehicles),
      installer: installer?.id ?? 'installer-0',
      installerInitials: installer?.initials ?? '??',
      installerColor: color,
      date: formatDateStr(dateIn),
      startTime: effectiveStart,
      endTime: effectiveEnd,
      difficulty: difficultyFromPriority(wo.priority),
      location: 'shop' as const,
      color,
    };
  });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (monday.getMonth() === friday.getMonth()) {
    return `${monthNames[monday.getMonth()]} ${monday.getDate()} \u2013 ${friday.getDate()}, ${monday.getFullYear()}`;
  }
  return `${monthNames[monday.getMonth()]} ${monday.getDate()} \u2013 ${monthNames[friday.getMonth()]} ${friday.getDate()}, ${friday.getFullYear()}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthLabel(year: number, month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${monthNames[month]} ${year}`;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-overlay)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 animate-pulse rounded bg-[var(--surface-overlay)]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-24 animate-pulse rounded-full bg-[var(--surface-overlay)]"
            />
          ))}
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="flex-1 overflow-auto bg-[var(--surface-card)] p-4">
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      </div>
      {/* Summary bar skeleton */}
      <div className="flex items-center gap-6 border-t border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-overlay)]" />
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-overlay)]" />
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-overlay)]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function CalendarError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--surface-card)]">
      <div className="rounded-full bg-red-500/10 p-3">
        <svg
          className="h-6 w-6 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Failed to load calendar
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{message}</p>
      </div>
      <Button
        variant="secondary"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [monthYear, setMonthYear] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [activeView, setActiveView] = useState<'day' | 'week' | 'month' | 'list'>('week');

  // Data state
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeInstallers, setActiveInstallers] = useState<Set<string>>(
    new Set<string>(),
  );

  type Phase = 'design' | 'production' | 'install';
  type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';
  type ColorBy = 'phase' | 'installer';

  const [activePhases, setActivePhases] = useState<Set<Phase>>(
    new Set<Phase>(['design', 'production', 'install']),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [colorBy, setColorBy] = useState<ColorBy>('phase');

  // -----------------------------------------------------------------------
  // Fetch work orders
  // -----------------------------------------------------------------------

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<WorkOrderListResponse>(
        '/api/work-orders?limit=100',
      );

      // Build installer list from work orders
      const extractedInstallers = extractInstallers(data.items);
      setInstallers(extractedInstallers);

      // Build lookup map
      const installerMap = new Map<string, Installer>();
      for (const inst of extractedInstallers) {
        installerMap.set(inst.name, inst);
      }

      // Transform work orders to calendar events
      const events = transformToCalendarEvents(data.items, installerMap);
      setCalendarEvents(events);

      // Activate all installers by default
      setActiveInstallers(new Set(extractedInstallers.map((i) => i.id)));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading work orders.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // -----------------------------------------------------------------------
  // Navigation handlers
  // -----------------------------------------------------------------------

  // Week
  const weekDays = useMemo(() => {
    const today = formatDateStr(new Date());
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = formatDateStr(date);
      return {
        date,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        isToday: dateStr === today,
      };
    });
  }, [weekStart]);

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const handleTodayWeek = useCallback(() => {
    setWeekStart(getMonday(new Date()));
  }, []);

  // Day
  const handlePrevDay = useCallback(() => {
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const handleTodayDay = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDay(d);
  }, []);

  // Month
  const handlePrevMonth = useCallback(() => {
    setMonthYear((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonthYear((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const handleTodayMonth = useCallback(() => {
    const now = new Date();
    setMonthYear({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // Click a day in month view → switch to day view
  const handleMonthDayClick = useCallback((date: Date) => {
    setSelectedDay(date);
    setActiveView('day');
  }, []);

  const handleViewChange = useCallback((view: 'day' | 'week' | 'month' | 'list') => {
    setActiveView(view);
  }, []);

  const handleTogglePhase = useCallback((phase: Phase) => {
    setActivePhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  }, []);

  const handleStatusChange = useCallback((status: StatusFilter) => {
    setStatusFilter(status);
  }, []);

  const handleColorByChange = useCallback((newColorBy: ColorBy) => {
    setColorBy(newColorBy);
  }, []);

  const handleToggleInstaller = useCallback((id: string) => {
    setActiveInstallers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Date label & nav callbacks per view
  // -----------------------------------------------------------------------

  const dateLabel = useMemo(() => {
    switch (activeView) {
      case 'day':
        return formatDayLabel(selectedDay);
      case 'month':
        return formatMonthLabel(monthYear.year, monthYear.month);
      case 'list':
        return formatMonthLabel(monthYear.year, monthYear.month);
      case 'week':
      default:
        return formatWeekLabel(weekStart);
    }
  }, [activeView, selectedDay, monthYear, weekStart]);

  const onPrev = activeView === 'day' ? handlePrevDay : (activeView === 'month' || activeView === 'list') ? handlePrevMonth : handlePrevWeek;
  const onNext = activeView === 'day' ? handleNextDay : (activeView === 'month' || activeView === 'list') ? handleNextMonth : handleNextWeek;
  const onToday = activeView === 'day' ? handleTodayDay : (activeView === 'month' || activeView === 'list') ? handleTodayMonth : handleTodayWeek;

  // -----------------------------------------------------------------------
  // Summary metrics
  // -----------------------------------------------------------------------

  const summaryLabel = useMemo(() => {
    switch (activeView) {
      case 'day':
        return 'Today';
      case 'month':
      case 'list':
        return 'This month';
      case 'week':
      default:
        return 'This week';
    }
  }, [activeView]);

  const visibleEvents = useMemo(() => {
    switch (activeView) {
      case 'day': {
        const dayStr = formatDateStr(selectedDay);
        return calendarEvents.filter((e) => e.date === dayStr);
      }
      case 'month':
      case 'list': {
        const firstDay = new Date(monthYear.year, monthYear.month, 1);
        const lastDay = new Date(monthYear.year, monthYear.month + 1, 0);
        const startStr = formatDateStr(firstDay);
        const endStr = formatDateStr(lastDay);
        return calendarEvents.filter((e) => e.date >= startStr && e.date <= endStr);
      }
      case 'week':
      default:
        return calendarEvents.filter((e) =>
          weekDays.some((d) => d.dateStr === e.date),
        );
    }
  }, [activeView, calendarEvents, selectedDay, monthYear, weekDays]);

  const totalJobs = visibleEvents.length;
  const shopJobs = visibleEvents.filter((e) => e.location === 'shop').length;
  const onsiteJobs = visibleEvents.filter((e) => e.location === 'on-site').length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (error) {
    return <CalendarError message={error} onRetry={fetchWorkOrders} />;
  }

  const selectedDayStr = formatDateStr(selectedDay);
  const todayStr = formatDateStr(new Date());

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        dateLabel={dateLabel}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        activeView={activeView}
        onViewChange={handleViewChange}
      />
      <CalendarToolbar
        activePhases={activePhases}
        onTogglePhase={handleTogglePhase}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        colorBy={colorBy}
        onColorByChange={handleColorByChange}
        installers={installers}
        activeInstallers={activeInstallers}
        onToggleInstaller={handleToggleInstaller}
      />

      {activeView === 'day' && (
        <DayView
          date={selectedDay}
          dateStr={selectedDayStr}
          isToday={selectedDayStr === todayStr}
          installers={installers}
          events={calendarEvents}
          activeInstallers={activeInstallers}
        />
      )}

      {activeView === 'week' && (
        <WeekView
          weekDays={weekDays}
          installers={installers}
          events={calendarEvents}
          activeInstallers={activeInstallers}
        />
      )}

      {activeView === 'month' && (
        <MonthView
          year={monthYear.year}
          month={monthYear.month}
          installers={installers}
          events={calendarEvents}
          activeInstallers={activeInstallers}
          onDayClick={handleMonthDayClick}
        />
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-6 border-t border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{summaryLabel}:</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{totalJobs} jobs</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--phase-production)]" />
          <span className="text-xs text-[var(--text-secondary)]">{shopJobs} shop</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs text-[var(--text-secondary)]">{onsiteJobs} on-site</span>
        </div>
      </div>
    </div>
  );
}

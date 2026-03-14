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
    return `${mLabel} \u2013 ${friday.getDate()}, ${monday.getFullYear()}`;
  }
  const fLabel = friday.toLocaleDateString('en-US', opts);
  return `${mLabel} \u2013 ${fLabel}, ${friday.getFullYear()}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonthLabel(year: number, month: number): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[month]} ${year}`;
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

  // View state
  const [activeView, setActiveView] = useState<ViewMode>(preset.view);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
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
      return true;
    });
  }, [allEvents, activePhases, statusFilter, colorBy, activeInstallers]);

  // Visible events scoped to current view range
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
      case 'day': { const d = new Date(now); d.setHours(0, 0, 0, 0); setSelectedDay(d); break; }
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
              setActivePhases(new Set<Phase>(['design', 'production', 'install']));
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

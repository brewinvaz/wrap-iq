'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import MetricsBar from '@/components/dashboard/MetricsBar';
import DepartmentCard from '@/components/dashboard/DepartmentCard';
import InsightsTable from '@/components/dashboard/InsightsTable';
import RevenueChart from '@/components/dashboard/RevenueChart';
import DateRangeFilter, { type Preset, type CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrencyCompact } from '@/lib/format';
import {
  KPIMetric,
  DepartmentScorecard,
  InstallerInsight,
  RevenueDataPoint,
} from '@/lib/types';

// --- API response types ---

interface ApiKanbanStage {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface ApiVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface ApiWorkOrder {
  id: string;
  job_number: string;
  job_type: string;
  job_value: number;
  priority: string;
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  status: ApiKanbanStage | null;
  vehicles: ApiVehicle[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiWorkOrderListResponse {
  items: ApiWorkOrder[];
  total: number;
}

// --- Derive analytics from work orders ---

function deriveKPIs(workOrders: ApiWorkOrder[]): KPIMetric[] {
  if (!Array.isArray(workOrders) || workOrders.length === 0) {
    return [
      { label: 'Active Jobs', value: '0' },
      { label: 'Pipeline Value', value: '$0' },
      { label: 'Monthly Revenue', value: '$0' },
      { label: 'Avg Completion Time', value: 'N/A' },
      { label: 'Total Jobs', value: '0' },
      { label: 'Completed', value: '0' },
    ];
  }

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const activeJobs = workOrders.filter((wo) => {
    const statusName = wo.status?.name?.toLowerCase() ?? '';
    return !['complete', 'completed', 'cancelled'].includes(statusName);
  });

  const pipelineValue = activeJobs.reduce((sum, wo) => sum + wo.job_value, 0);

  const monthlyOrders = workOrders.filter((wo) => {
    const d = new Date(wo.date_in);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthlyRevenue = monthlyOrders.reduce((sum, wo) => sum + wo.job_value, 0);

  const completedOrders = workOrders.filter((wo) => {
    const statusName = wo.status?.name?.toLowerCase() ?? '';
    return ['complete', 'completed'].includes(statusName);
  });

  const completedWithDates = completedOrders.filter((wo) => wo.completion_date && wo.date_in);
  const avgDays = completedWithDates.length > 0
    ? (completedWithDates.reduce((sum, wo) => {
        const start = new Date(wo.date_in).getTime();
        const end = new Date(wo.completion_date!).getTime();
        return sum + (end - start) / (1000 * 60 * 60 * 24);
      }, 0) / completedWithDates.length).toFixed(1)
    : 'N/A';

  return [
    { label: 'Active Jobs', value: String(activeJobs.length) },
    { label: 'Pipeline Value', value: formatCurrencyCompact(pipelineValue) },
    { label: 'Monthly Revenue', value: formatCurrencyCompact(monthlyRevenue) },
    { label: 'Avg Completion Time', value: avgDays !== 'N/A' ? `${avgDays} days` : 'N/A' },
    { label: 'Total Jobs', value: String(workOrders.length) },
    { label: 'Completed', value: String(completedOrders.length) },
  ];
}

function deriveDepartmentScorecards(workOrders: ApiWorkOrder[]): DepartmentScorecard[] {
  if (!Array.isArray(workOrders)) return [];

  const activeJobs = workOrders.filter((wo) => {
    const statusName = wo.status?.name?.toLowerCase() ?? '';
    return !['complete', 'completed', 'cancelled'].includes(statusName);
  });
  const completedJobs = workOrders.filter((wo) => {
    const statusName = wo.status?.name?.toLowerCase() ?? '';
    return ['complete', 'completed'].includes(statusName);
  });

  const totalValue = workOrders.reduce((sum, wo) => sum + wo.job_value, 0);
  const avgDealSize = workOrders.length > 0 ? Math.round(totalValue / workOrders.length) : 0;

  return [
    {
      department: 'Sales',
      color: '#2563eb',
      metrics: [
        { label: 'Total Orders', value: String(workOrders.length), subtext: `${activeJobs.length} active` },
        { label: 'Completed', value: String(completedJobs.length) },
        { label: 'Avg Deal Size', value: formatCurrencyCompact(avgDealSize) },
        { label: 'Pipeline', value: formatCurrencyCompact(activeJobs.reduce((s, wo) => s + wo.job_value, 0)), subtext: `${activeJobs.length} open` },
      ],
    },
    {
      department: 'Production',
      color: '#d97706',
      metrics: [
        { label: 'In Queue', value: String(activeJobs.length) },
        { label: 'High Priority', value: String(activeJobs.filter((wo) => wo.priority === 'high').length) },
        { label: 'Medium Priority', value: String(activeJobs.filter((wo) => wo.priority === 'medium').length) },
        { label: 'Low Priority', value: String(activeJobs.filter((wo) => wo.priority === 'low').length) },
      ],
    },
  ];
}

function deriveRevenueData(workOrders: ApiWorkOrder[]): RevenueDataPoint[] {
  if (!Array.isArray(workOrders)) return [];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTotals = new Map<string, number>();

  workOrders.forEach((wo) => {
    const date = new Date(wo.date_in);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + wo.job_value);
  });

  // Get last 6 months
  const now = new Date();
  const result: RevenueDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    result.push({
      month: months[d.getMonth()],
      value: monthlyTotals.get(key) ?? 0,
    });
  }

  return result;
}

function deriveInstallerInsights(workOrders: ApiWorkOrder[]): InstallerInsight[] {
  // Without installer assignment data in work orders, show a placeholder
  // This will be populated once the backend supports installer tracking
  if (!Array.isArray(workOrders) || workOrders.length === 0) return [];

  return [
    {
      name: 'Analytics Coming Soon',
      initials: '--',
      color: '#6b7280',
      installs: 0,
      avgTime: 'N/A',
      rating: 0,
    },
  ];
}

// --- Date range filtering ---

function filterByDateRange(
  workOrders: ApiWorkOrder[],
  preset: Preset,
  customRange?: CustomDateRange | null,
): ApiWorkOrder[] {
  if (!Array.isArray(workOrders)) return [];

  if (preset === 'Custom') {
    if (!customRange) return workOrders;
    const start = new Date(customRange.startDate);
    // Set end date to end of day so the entire end date is included
    const end = new Date(customRange.endDate);
    end.setHours(23, 59, 59, 999);
    return workOrders.filter((wo) => {
      const d = new Date(wo.date_in);
      return d >= start && d <= end;
    });
  }

  const now = new Date();
  let startDate: Date;

  switch (preset) {
    case '7D':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case '30D':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      break;
    case '90D':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
      break;
    case 'YTD':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return workOrders;
  }

  return workOrders.filter((wo) => new Date(wo.date_in) >= startDate);
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="mt-1 h-3 w-64 animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
          <div className="h-9 w-40 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        </div>
      </header>
      {/* KPI strip skeleton */}
      <div className="flex gap-4 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 animate-pulse">
            <div className="h-3 w-16 rounded bg-[var(--surface-raised)]" />
            <div className="mt-1 h-6 w-20 rounded bg-[var(--surface-raised)]" />
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
          <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
        </div>
      </div>
    </div>
  );
}

// --- Error state ---

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Reports & Insights</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-red-500/10 p-3">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load reports</p>
        <p className="text-xs text-[var(--text-secondary)]">{message}</p>
        <Button onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [allWorkOrders, setAllWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [dateRange, setDateRange] = useState<Preset>('30D');
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
      setAllWorkOrders(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePresetChange = useCallback((preset: Preset) => {
    setDateRange(preset);
    if (preset !== 'Custom') {
      setCustomRange(null);
    }
  }, []);

  const handleCustomRange = useCallback((range: CustomDateRange) => {
    setDateRange('Custom');
    setCustomRange(range);
  }, []);

  const filtered = useMemo(() => filterByDateRange(allWorkOrders, dateRange, customRange), [allWorkOrders, dateRange, customRange]);
  const kpis = useMemo(() => deriveKPIs(filtered), [filtered]);
  const scorecards = useMemo(() => deriveDepartmentScorecards(filtered), [filtered]);
  const insights = useMemo(() => deriveInstallerInsights(filtered), [filtered]);
  const revenue = useMemo(() => deriveRevenueData(filtered), [filtered]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchReports} />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Reports & Insights</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Business health overview and department performance
            </p>
          </div>
          <DateRangeFilter onChange={handlePresetChange} onCustomRange={handleCustomRange} />
        </div>
      </header>

      {/* KPI strip */}
      <MetricsBar metrics={kpis} />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Department scorecards */}
        <section>
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Department Scorecards
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {scorecards.map((sc) => (
              <DepartmentCard key={sc.department} scorecard={sc} />
            ))}
          </div>
          {scorecards.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-card)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No work order data available to generate scorecards.</p>
            </div>
          )}
        </section>

        {/* Revenue + Insights row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueChart data={revenue} />
          <div>
            {insights.length > 0 && insights[0].name === 'Analytics Coming Soon' ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-card)] p-8">
                <svg className="mb-3 h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm font-medium text-[var(--text-secondary)]">Installer Insights</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Detailed installer analytics will be available once installer tracking is configured.
                </p>
              </div>
            ) : (
              <InsightsTable data={insights} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

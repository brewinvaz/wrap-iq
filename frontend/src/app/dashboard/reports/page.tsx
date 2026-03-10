'use client';

import MetricsBar from '@/components/dashboard/MetricsBar';
import DepartmentCard from '@/components/dashboard/DepartmentCard';
import InsightsTable from '@/components/dashboard/InsightsTable';
import RevenueChart from '@/components/dashboard/RevenueChart';
import DateRangeFilter from '@/components/dashboard/DateRangeFilter';
import {
  topLevelKPIs,
  departmentScorecards,
  installerInsights,
  revenueData,
} from '@/lib/mock-kpi-data';

export default function ReportsPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#18181b]">Reports & Insights</h1>
            <p className="mt-0.5 text-xs text-[#a8a8b4]">
              Business health overview and department performance
            </p>
          </div>
          <DateRangeFilter />
        </div>
      </header>

      {/* KPI strip */}
      <MetricsBar metrics={topLevelKPIs} />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Department scorecards */}
        <section>
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-gray-400">
            Department Scorecards
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {departmentScorecards.map((sc) => (
              <DepartmentCard key={sc.department} scorecard={sc} />
            ))}
          </div>
        </section>

        {/* Revenue + Insights row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueChart data={revenueData} />
          <InsightsTable data={installerInsights} />
        </div>
      </div>
    </div>
  );
}

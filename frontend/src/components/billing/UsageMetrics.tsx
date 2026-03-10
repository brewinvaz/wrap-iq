'use client';

import { BillingUsageMetrics } from '@/lib/types';

interface UsageMetricsProps {
  metrics: BillingUsageMetrics;
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  unit: string;
  formatValue?: (v: number) => string;
}

function UsageBar({
  label,
  used,
  limit,
  unit,
  formatValue,
}: UsageBarProps) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const fmt = formatValue ?? ((v: number) => String(v));
  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#18181b]">{label}</span>
        <span className="text-sm text-[#60606a]">
          {fmt(used)} / {fmt(limit)} {unit}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function UsageMetrics({ metrics }: UsageMetricsProps) {
  return (
    <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
      <h2 className="text-base font-semibold text-[#18181b]">Usage</h2>
      <p className="mt-1 text-sm text-[#60606a]">
        Current usage for your billing period.
      </p>

      <div className="mt-5 space-y-5">
        <UsageBar
          label="Team Seats"
          used={metrics.seatsUsed}
          limit={metrics.seatsLimit}
          unit="seats"
        />
        <UsageBar
          label="Storage"
          used={metrics.storageUsedGb}
          limit={metrics.storageLimitGb}
          unit="GB"
          formatValue={(v) => v.toFixed(1)}
        />
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <span className="text-sm font-medium text-[#18181b]">
            Total Projects
          </span>
          <span className="text-lg font-semibold text-[#18181b]">
            {metrics.projectsCount}
          </span>
        </div>
      </div>
    </div>
  );
}

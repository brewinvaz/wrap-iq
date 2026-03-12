'use client';

import { APIKeyUsageStats } from '@/lib/types';

interface UsageChartProps {
  stats: APIKeyUsageStats;
}

export default function UsageChart({ stats }: UsageChartProps) {
  const maxCount =
    stats.topEndpoints.length > 0
      ? Math.max(...stats.topEndpoints.map((e) => e.count))
      : 1;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Usage Statistics
      </h3>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-[var(--surface-raised)] p-3 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            {stats.totalRequests.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Total Requests</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-raised)] p-3 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            {stats.requestsToday.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Requests Today</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-raised)] p-3 text-center">
          <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            {stats.avgResponseTime.toFixed(1)}ms
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Avg Response Time</p>
        </div>
      </div>

      {stats.topEndpoints.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            Top Endpoints
          </h4>
          <div className="space-y-2">
            {stats.topEndpoints.map((endpoint) => (
              <div key={endpoint.endpoint} className="flex items-center gap-3">
                <code className="w-48 shrink-0 truncate text-xs text-[var(--text-primary)]">
                  {endpoint.endpoint}
                </code>
                <div className="flex-1">
                  <div className="h-4 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-primary)]"
                      style={{
                        width: `${(endpoint.count / maxCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-xs text-[var(--text-secondary)]">
                  {endpoint.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

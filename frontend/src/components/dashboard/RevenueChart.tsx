'use client';

import { useEffect, useState } from 'react';
import { RevenueDataPoint } from '@/lib/types';

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [mounted, setMounted] = useState(false);
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (data.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Revenue Trend</h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Last 6 months</p>
        </div>
        <div className="px-5 py-5 text-center text-sm text-[var(--text-muted)]" style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          No revenue data available
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Revenue Trend</h3>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Last 6 months</p>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-end justify-between gap-3" style={{ height: '160px' }}>
          {data.map((point) => {
            const pct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
            return (
              <div key={point.month} className="group flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full flex justify-center" style={{ height: '130px' }}>
                  <div
                    className="w-full max-w-[40px] rounded-t-md bg-[var(--accent-primary)] transition-all duration-700 ease-out"
                    style={{
                      height: mounted ? `${pct}%` : '0%',
                    }}
                  />
                  <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[var(--text-primary)] px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                    ${(point.value / 1000).toFixed(1)}k
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {point.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

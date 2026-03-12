import { KPIMetric } from '@/lib/types';

interface MetricsBarProps {
  metrics: KPIMetric[];
}

export default function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="flex flex-wrap border-b border-[var(--border)] bg-[var(--surface-card)]">
      {metrics.map((metric, i) => (
        <div
          key={metric.label}
          className={`flex flex-1 min-w-[140px] items-center gap-3 px-5 py-3.5 ${
            i < metrics.length - 1 ? 'border-r border-[var(--border)]' : ''
          }`}
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {metric.label}
            </p>
            <p className="font-mono text-2xl font-bold tracking-tight text-[var(--accent-primary)]">
              {metric.value}
            </p>
          </div>
          {metric.delta && (
            <span
              className={`shrink-0 text-xs font-medium ${
                metric.trend === 'up'
                  ? 'text-emerald-600'
                  : metric.trend === 'down'
                    ? 'text-rose-600'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              {metric.trend === 'up' && '\u2191'}
              {metric.trend === 'down' && '\u2193'}
              {metric.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

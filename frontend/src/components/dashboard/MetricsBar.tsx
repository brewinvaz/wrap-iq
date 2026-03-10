import { KPIMetric } from '@/lib/types';

interface MetricsBarProps {
  metrics: KPIMetric[];
}

export default function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="flex flex-wrap border-b border-[#e6e6eb] bg-white">
      {metrics.map((metric, i) => (
        <div
          key={metric.label}
          className={`flex flex-1 min-w-[140px] items-center gap-3 px-5 py-3.5 ${
            i < metrics.length - 1 ? 'border-r border-[#e6e6eb]' : ''
          }`}
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
              {metric.label}
            </p>
            <p className="text-2xl font-bold tracking-tight text-[#18181b]">
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
                    : 'text-gray-400'
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

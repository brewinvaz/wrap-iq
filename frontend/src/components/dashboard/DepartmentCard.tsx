import { DepartmentScorecard } from '@/lib/types';

interface DepartmentCardProps {
  scorecard: DepartmentScorecard;
}

export default function DepartmentCard({ scorecard }: DepartmentCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] transition-shadow hover:shadow-md hover:border-[rgba(168,85,247,0.3)] hover:shadow-[0_0_16px_rgba(168,85,247,0.08)]"
      style={{ borderLeftWidth: '4px', borderLeftColor: scorecard.color }}
    >
      <div className="px-5 py-4">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{scorecard.department}</h3>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-[var(--border)] bg-[var(--border)]">
        {scorecard.metrics.map((metric) => (
          <div key={metric.label} className="bg-[var(--surface-card)] px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {metric.label}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-tight text-[var(--text-primary)]">
              {metric.value}
            </p>
            {metric.subtext && (
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{metric.subtext}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

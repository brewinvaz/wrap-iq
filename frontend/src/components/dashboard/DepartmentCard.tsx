import { DepartmentScorecard } from '@/lib/types';

interface DepartmentCardProps {
  scorecard: DepartmentScorecard;
}

export default function DepartmentCard({ scorecard }: DepartmentCardProps) {
  return (
    <div
      className="rounded-lg border border-[#e6e6eb] bg-white transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: '4px', borderLeftColor: scorecard.color }}
    >
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-[#18181b]">{scorecard.department}</h3>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-[#e6e6eb] bg-[#e6e6eb]">
        {scorecard.metrics.map((metric) => (
          <div key={metric.label} className="bg-white px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
              {metric.label}
            </p>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-[#18181b]">
              {metric.value}
            </p>
            {metric.subtext && (
              <p className="mt-0.5 text-[11px] text-[#a8a8b4]">{metric.subtext}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

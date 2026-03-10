'use client';

import { BillingPlan } from '@/lib/types';
import PlanCard from './PlanCard';

interface PlanComparisonGridProps {
  plans: BillingPlan[];
  currentPlanId: string;
  onSelectPlan: (planId: string) => void;
}

export default function PlanComparisonGrid({
  plans,
  currentPlanId,
  onSelectPlan,
}: PlanComparisonGridProps) {
  return (
    <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
      <h2 className="text-base font-semibold text-[#18181b]">
        Available Plans
      </h2>
      <p className="mt-1 text-sm text-[#60606a]">
        Choose the plan that best fits your team&apos;s needs.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === currentPlanId}
            onSelect={onSelectPlan}
          />
        ))}
      </div>
    </div>
  );
}

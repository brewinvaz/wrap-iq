'use client';

import { BillingPlan } from '@/lib/types';

interface PlanCardProps {
  plan: BillingPlan;
  isCurrent: boolean;
  onSelect: (planId: string) => void;
}

export default function PlanCard({ plan, isCurrent, onSelect }: PlanCardProps) {
  const price = plan.priceCents / 100;
  const isPopular = plan.name === 'Professional';

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        isCurrent
          ? 'border-blue-500 bg-blue-50/30'
          : isPopular
            ? 'border-blue-200 bg-white'
            : 'border-[#e6e6eb] bg-white'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
          Most Popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white">
          Current Plan
        </span>
      )}

      <h3 className="text-lg font-semibold text-[#18181b]">{plan.name}</h3>

      <div className="mt-3 flex items-baseline gap-1">
        {price === 0 ? (
          <span className="text-3xl font-bold text-[#18181b]">Free</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-[#18181b]">
              ${price}
            </span>
            <span className="text-sm text-[#60606a]">/month</span>
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#60606a]">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          isCurrent
            ? 'cursor-default bg-gray-100 text-[#60606a]'
            : isPopular
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-[#e6e6eb] bg-white text-[#18181b] hover:bg-gray-50'
        }`}
      >
        {isCurrent ? 'Current Plan' : price === 0 ? 'Downgrade' : 'Upgrade'}
      </button>
    </div>
  );
}

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
          ? 'border-[var(--accent-primary)] bg-blue-50/30'
          : isPopular
            ? 'border-[var(--accent-primary)]/40 bg-[var(--surface-card)]'
            : 'border-[var(--border)] bg-[var(--surface-card)]'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-3 py-0.5 text-xs font-medium text-white">
          Most Popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white">
          Current Plan
        </span>
      )}

      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h3>

      <div className="mt-3 flex items-baseline gap-1">
        {price === 0 ? (
          <span className="text-3xl font-bold text-[var(--text-primary)]">Free</span>
        ) : (
          <>
            <span className="font-mono text-3xl font-bold text-[var(--text-primary)]">
              ${price}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">/month</span>
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
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
            ? 'cursor-default bg-[var(--surface-raised)] text-[var(--text-secondary)]'
            : isPopular
              ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
              : 'border border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]'
        }`}
      >
        {isCurrent ? 'Current Plan' : price === 0 ? 'Downgrade' : 'Upgrade'}
      </button>
    </div>
  );
}

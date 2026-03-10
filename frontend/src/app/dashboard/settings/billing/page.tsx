'use client';

import { useState } from 'react';
import PlanComparisonGrid from '@/components/billing/PlanComparisonGrid';
import PaymentMethodCard from '@/components/billing/PaymentMethodCard';
import InvoiceTable from '@/components/billing/InvoiceTable';
import UsageMetrics from '@/components/billing/UsageMetrics';
import {
  plans,
  currentSubscription as initialSubscription,
  paymentMethods as initialPaymentMethods,
  invoices,
  usageMetrics,
} from '@/lib/mock/subscription-data';
import { BillingPaymentMethod, BillingSubscription } from '@/lib/types';

export default function BillingPage() {
  const [subscription, setSubscription] =
    useState<BillingSubscription>(initialSubscription);
  const [methods, setMethods] =
    useState<BillingPaymentMethod[]>(initialPaymentMethods);

  function handleSelectPlan(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setSubscription((prev) => ({
      ...prev,
      planId: plan.id,
      planName: plan.name,
    }));
  }

  function handleSetDefault(pmId: string) {
    setMethods((prev) =>
      prev.map((m) => ({ ...m, isDefault: m.id === pmId })),
    );
  }

  function handleRemove(pmId: string) {
    setMethods((prev) => prev.filter((m) => m.id !== pmId));
  }

  const currentPlan = plans.find((p) => p.id === subscription.planId);
  const price = currentPlan ? currentPlan.priceCents / 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">
              Billing &amp; Subscription
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {subscription.status === 'active' ? 'Active' : subscription.status}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Current plan summary */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#18181b]">
                Current Plan
              </h2>
              <p className="mt-1 text-2xl font-bold text-[#18181b]">
                {subscription.planName}
              </p>
              <p className="mt-1 text-sm text-[#60606a]">
                {price === 0
                  ? 'Free forever'
                  : `$${price}/month`}
                {' '}&middot; Renews{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                  'en-US',
                  { month: 'long', day: 'numeric', year: 'numeric' },
                )}
              </p>
            </div>
            {subscription.cancelAtPeriodEnd && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Cancels at period end
              </span>
            )}
          </div>
        </div>

        {/* Usage metrics */}
        <UsageMetrics metrics={usageMetrics} />

        {/* Plan comparison */}
        <PlanComparisonGrid
          plans={plans}
          currentPlanId={subscription.planId}
          onSelectPlan={handleSelectPlan}
        />

        {/* Payment methods */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#18181b]">
              Payment Methods
            </h2>
            <button className="rounded-lg border border-[#e6e6eb] px-4 py-2 text-sm font-medium text-[#18181b] transition-colors hover:bg-gray-50">
              + Add Method
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {methods.length === 0 ? (
              <p className="text-sm text-[#60606a]">
                No payment methods on file.
              </p>
            ) : (
              methods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  onSetDefault={handleSetDefault}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>
        </div>

        {/* Billing history */}
        <InvoiceTable invoices={invoices} />
      </div>
    </div>
  );
}

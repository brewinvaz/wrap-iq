'use client';

import { useState, useEffect, useCallback } from 'react';
import PlanComparisonGrid from '@/components/billing/PlanComparisonGrid';
import PaymentMethodCard from '@/components/billing/PaymentMethodCard';
import InvoiceTable from '@/components/billing/InvoiceTable';
import UsageMetrics from '@/components/billing/UsageMetrics';
import {
  BillingPaymentMethod,
  BillingPlan,
  BillingSubscription,
  BillingUsageMetrics,
} from '@/lib/types';
import {
  fetchPlans,
  fetchCurrentSubscription,
  updateSubscription,
  fetchPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
  fetchUsageMetrics,
  ApiError,
} from '@/lib/api/settings';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] =
    useState<BillingSubscription | null>(null);
  const [methods, setMethods] = useState<BillingPaymentMethod[]>([]);
  const [usage, setUsage] = useState<BillingUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [plansData, subData, methodsData, usageData] = await Promise.all([
        fetchPlans(),
        fetchCurrentSubscription(),
        fetchPaymentMethods(),
        fetchUsageMetrics(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
      setMethods(methodsData);
      setUsage(usageData);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load billing data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSelectPlan(planId: string) {
    try {
      setActionError(null);
      const updated = await updateSubscription(planId);
      setSubscription(updated);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to update plan';
      setActionError(message);
    }
  }

  async function handleSetDefault(pmId: string) {
    try {
      setActionError(null);
      await setDefaultPaymentMethod(pmId);
      setMethods((prev) =>
        prev.map((m) => ({ ...m, isDefault: m.id === pmId })),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to set default payment method';
      setActionError(message);
    }
  }

  async function handleRemove(pmId: string) {
    try {
      setActionError(null);
      await removePaymentMethod(pmId);
      setMethods((prev) => prev.filter((m) => m.id !== pmId));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to remove payment method';
      setActionError(message);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Billing &amp; Subscription
          </h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm text-[var(--text-secondary)]">Loading billing data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Billing &amp; Subscription
          </h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={loadData}
              className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === subscription?.planId);
  const price = currentPlan ? currentPlan.priceCents / 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Billing &amp; Subscription
            </h1>
            {subscription && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {subscription.status === 'active'
                  ? 'Active'
                  : subscription.status}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
            <button
              onClick={() => setActionError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Current plan summary */}
        {subscription && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Current Plan
                </h2>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {subscription.planName}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {price === 0 ? 'Free forever' : `$${price}/month`}{' '}
                  &middot; Renews{' '}
                  {new Date(
                    subscription.currentPeriodEnd,
                  ).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  Cancels at period end
                </span>
              )}
            </div>
          </div>
        )}

        {/* Usage metrics */}
        {usage && <UsageMetrics metrics={usage} />}

        {/* Plan comparison */}
        <PlanComparisonGrid
          plans={plans}
          currentPlanId={subscription?.planId ?? ''}
          onSelectPlan={handleSelectPlan}
        />

        {/* Payment methods */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Payment Methods
            </h2>
            <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-overlay)]">
              + Add Method
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {methods.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
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

        {/* Billing history - invoices endpoint not yet available */}
        <InvoiceTable invoices={[]} />
      </div>
    </div>
  );
}

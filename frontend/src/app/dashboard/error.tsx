'use client';

import { Button } from '@/components/ui/Button';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Failed to load dashboard</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Something went wrong while loading this page. Please try again.
        </p>
        <Button
          onClick={reset}
          variant="secondary"
          className="mt-6"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

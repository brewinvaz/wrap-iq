'use client';

import { Button } from '@/components/ui/Button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          An unexpected error occurred. Please try again.
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

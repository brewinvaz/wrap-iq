'use client';

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
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-[#18181b]">Failed to load dashboard</h2>
        <p className="mt-2 text-sm text-[#60606a]">
          Something went wrong while loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

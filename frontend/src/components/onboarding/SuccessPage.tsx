'use client';

interface Props {
  jobNumber: string;
  orgName: string;
}

export function SuccessPage({ jobNumber, orgName }: Props) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <svg
            className="h-7 w-7 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[var(--text-primary)]">You&apos;re all set!</h2>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          Your project with {orgName} has been submitted.
        </p>

        <div className="mt-5 rounded-[10px] bg-[var(--surface-raised)] px-4 py-3">
          <p className="text-[12px] text-[var(--text-muted)]">Your job number</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-[var(--text-primary)]">{jobNumber}</p>
        </div>

        <div className="mt-5 rounded-[10px] border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/10 px-4 py-3">
          <p className="text-[13px] text-[var(--accent-primary)]">
            Check your email for a magic link to access your project portal,
            where you can track progress and communicate with the team.
          </p>
        </div>
      </div>
    </div>
  );
}

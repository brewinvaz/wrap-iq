'use client';

interface Props {
  jobNumber: string;
  orgName: string;
}

export function SuccessPage({ jobNumber, orgName }: Props) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-[#e6e6eb] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-7 w-7 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[#18181b]">You&apos;re all set!</h2>
        <p className="mt-2 text-[14px] text-[#60606a]">
          Your project with {orgName} has been submitted.
        </p>

        <div className="mt-5 rounded-lg bg-[#f8f8fa] px-4 py-3">
          <p className="text-[12px] text-[#a8a8b4]">Your job number</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-[#18181b]">{jobNumber}</p>
        </div>

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-[13px] text-blue-700">
            Check your email for a magic link to access your project portal,
            where you can track progress and communicate with the team.
          </p>
        </div>
      </div>
    </div>
  );
}

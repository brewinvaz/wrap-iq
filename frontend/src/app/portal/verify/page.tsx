'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { setTokens } from '@/lib/auth';

type VerifyState = 'verifying' | 'success' | 'error';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'error');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const verify = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
        const res = await fetch(`${apiBase}/api/auth/magic-link/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        if (!res.ok) {
          setState('error');
          return;
        }

        const data = await res.json();

        // Store tokens
        setTokens(data.access_token, data.refresh_token);

        setState('success');

        // Redirect to portal
        setTimeout(() => {
          window.location.href = '/portal';
        }, 1500);
      } catch {
        if (!cancelled) setState('error');
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRequestNewLink = async () => {
    if (!requestEmail) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      await fetch(`${apiBase}/api/portal/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: requestEmail }),
      });
      setRequestSent(true);
    } catch {
      // Fail silently — don't reveal whether email exists
      setRequestSent(true);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-[#e6e6eb] bg-white p-8 shadow-sm">
        {state === 'verifying' && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-600" />
            <h2 className="text-lg font-semibold text-[#18181b]">Verifying your link...</h2>
            <p className="mt-2 text-[14px] text-[#60606a]">Please wait while we sign you in.</p>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-6 w-6 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#18181b]">Signed in successfully</h2>
            <p className="mt-2 text-[14px] text-[#60606a]">Redirecting to your portal...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#18181b]">Link expired or invalid</h2>
            <p className="mt-2 text-[14px] text-[#60606a]">
              This magic link has expired or has already been used.
            </p>

            {!requestSent ? (
              <div className="mt-6">
                <p className="mb-3 text-[13px] text-[#60606a]">Request a new link:</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleRequestNewLink}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg bg-blue-50 p-3">
                <p className="text-[13px] text-blue-700">
                  If that email is registered, a new magic link has been sent. Check your inbox.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-600" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

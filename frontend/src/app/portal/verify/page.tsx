'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { setTokens } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/config';

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
        const res = await fetch(`${API_BASE_URL}/api/auth/magic-link/verify`, {
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
      await fetch(`${API_BASE_URL}/api/portal/magic-link/request`, {
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
      <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-8 shadow-sm">
        {state === 'verifying' && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Verifying your link...</h2>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Please wait while we sign you in.</p>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <svg
                className="h-6 w-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Signed in successfully</h2>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Redirecting to your portal...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Link expired or invalid</h2>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
              This magic link has expired or has already been used.
            </p>

            {!requestSent ? (
              <div className="mt-6">
                <p className="mb-3 text-[13px] text-[var(--text-secondary)]">Request a new link:</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-2 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  <button
                    onClick={handleRequestNewLink}
                    className="rounded-[10px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[10px] bg-[var(--accent-primary)]/10 p-3">
                <p className="text-[13px] text-[var(--accent-primary)]">
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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

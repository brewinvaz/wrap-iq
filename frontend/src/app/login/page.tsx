'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { setTokens, isAuthenticated } from '@/lib/auth';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
      setTokens(data.access_token, data.refresh_token);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Invalid email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
            <span className="font-mono text-sm font-bold text-white">W</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Sign in to Wrap<span className="text-[var(--accent-primary)]">Flow</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Enter your credentials to continue</p>
        </div>

        {/* Card */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-[10px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-[var(--text-secondary)]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-[var(--accent-primary)] hover:opacity-80">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

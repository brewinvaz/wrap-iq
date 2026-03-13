'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';
import { setTokens, isAuthenticated } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasDigit;

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Password does not meet complexity requirements.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.post<AuthResponse>('/api/auth/register', {
        email,
        password,
        org_name: orgName,
        full_name: fullName,
      });
      setTokens(data.access_token, data.refresh_token);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('An account with this email already exists.');
        } else {
          setError(err.message || 'Registration failed. Please try again.');
        }
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
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
            <span className="font-mono text-xs font-bold text-white">WF</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Create your Wrap<span className="text-[var(--accent-primary)]">Flow</span> account
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Get started with your organization</p>
        </div>

        {/* Card */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="org" className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
                Organization name
              </label>
              <input
                id="org"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Wraps Inc."
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
            </div>

            <div>
              <label htmlFor="fullName" className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
            </div>

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (min. 8 characters)"
                className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
              {password.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[12px]">
                  <li className={hasMinLength ? 'text-green-400' : 'text-[var(--text-muted)]'}>
                    {hasMinLength ? '\u2713' : '\u2022'} At least 8 characters
                  </li>
                  <li className={hasUppercase ? 'text-green-400' : 'text-[var(--text-muted)]'}>
                    {hasUppercase ? '\u2713' : '\u2022'} At least one uppercase letter
                  </li>
                  <li className={hasLowercase ? 'text-green-400' : 'text-[var(--text-muted)]'}>
                    {hasLowercase ? '\u2713' : '\u2022'} At least one lowercase letter
                  </li>
                  <li className={hasDigit ? 'text-green-400' : 'text-[var(--text-muted)]'}>
                    {hasDigit ? '\u2713' : '\u2022'} At least one digit
                  </li>
                </ul>
              )}
            </div>

            {error && (
              <p className="text-[13px] text-red-400">{error}</p>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[var(--accent-primary)] hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

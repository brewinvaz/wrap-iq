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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
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

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.post<AuthResponse>('/api/auth/register', {
        email,
        password,
        org_name: orgName,
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
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f6] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#18181b]">
            <span className="font-mono text-sm font-bold text-white">WF</span>
          </div>
          <h1 className="text-xl font-bold text-[#18181b]">
            Create your Wrap<span className="text-blue-600">Flow</span> account
          </h1>
          <p className="mt-1 text-sm text-[#60606a]">Get started with your organization</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="org" className="mb-1 block text-[13px] font-medium text-[#18181b]">
                Organization name
              </label>
              <input
                id="org"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Wraps Inc."
                className="h-10 w-full rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] px-3 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-[13px] font-medium text-[#18181b]">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-10 w-full rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] px-3 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-[13px] font-medium text-[#18181b]">
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
                className="h-10 w-full rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] px-3 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-[#2563eb] text-[14px] font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-[#60606a]">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

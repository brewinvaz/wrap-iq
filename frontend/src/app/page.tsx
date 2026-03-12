'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--surface-app)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent-primary)] border-t-transparent" />
    </div>
  );
}

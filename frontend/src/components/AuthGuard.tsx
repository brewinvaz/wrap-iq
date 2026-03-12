'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

const emptySubscribe = () => () => {};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const authenticated = mounted && isAuthenticated();

  useEffect(() => {
    if (mounted && !isAuthenticated()) {
      router.replace('/login');
    }
  }, [mounted, router]);

  if (!mounted || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-app)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

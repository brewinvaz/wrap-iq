'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

const emptySubscribe = () => () => {};

/** Public portal paths that do not require authentication. */
const PUBLIC_PORTAL_PATHS = ['/portal/verify'];

export default function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isPublicPath = PUBLIC_PORTAL_PATHS.some((p) => pathname.startsWith(p));
  const authenticated = mounted && (isPublicPath || isAuthenticated());

  useEffect(() => {
    if (mounted && !isPublicPath && !isAuthenticated()) {
      router.replace('/portal/verify');
    }
  }, [mounted, isPublicPath, router]);

  if (!mounted || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f8fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

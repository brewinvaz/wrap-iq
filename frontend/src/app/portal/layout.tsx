import Link from 'next/link';
import PortalAuthGuard from '@/components/PortalAuthGuard';

export const metadata = {
  title: 'Client Portal | WrapFlow',
  description: 'Track your vehicle wrap projects',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalAuthGuard>
      <div className="flex min-h-screen flex-col bg-[var(--surface-app)]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface-card)]">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/portal" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
                <span className="font-mono text-[11px] font-bold text-white">W</span>
              </div>
              <span className="text-[15px] font-bold text-[var(--text-primary)]">
                Wrap<span className="text-[var(--accent-primary)]">Flow</span>
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/portal/notifications"
                className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Notifications
              </Link>
              <div className="h-4 w-px bg-[var(--border)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Client Portal</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </PortalAuthGuard>
  );
}

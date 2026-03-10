import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';

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
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-[#f8f8fa]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[#e6e6eb] bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/portal" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
                <span className="font-mono text-[11px] font-bold text-white">WF</span>
              </div>
              <span className="text-[15px] font-bold text-[#18181b]">
                Wrap<span className="text-blue-600">Flow</span>
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/portal/notifications"
                className="text-[13px] text-[#60606a] transition-colors hover:text-[#18181b]"
              >
                Notifications
              </Link>
              <div className="h-4 w-px bg-[#e6e6eb]" />
              <span className="text-[13px] font-medium text-[#18181b]">Client Portal</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

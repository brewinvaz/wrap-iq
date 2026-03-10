'use client';

import { usePathname } from 'next/navigation';
import { useSidebar } from '@/lib/sidebar-context';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Jobs Board',
  '/dashboard/work-orders': 'Work Orders',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/customers': 'Customers',
  '/dashboard/design-queue': 'Design Queue',
  '/dashboard/print': 'Print / Lam',
  '/dashboard/install-schedule': 'Install Schedule',
  '/dashboard/financials': 'Financials',
  '/dashboard/time-logs': 'Time Tracking',
  '/dashboard/team': 'User Management',
  '/dashboard/comms': 'Communications',
  '/dashboard/hours': 'Design Hours',
  '/dashboard/settings/billing': 'Billing & Settings',
  '/dashboard/integrations': 'Integrations',
  '/dashboard/ai': 'Shop Intelligence',
  '/dashboard/3d': '3D Rendering',
};

interface TopbarProps {
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Topbar({ subtitle, actionLabel, onAction }: TopbarProps) {
  const pathname = usePathname();
  const { toggleMobile } = useSidebar();
  const title = ROUTE_TITLES[pathname] ?? 'Dashboard';
  return (
    <header className="flex h-[54px] shrink-0 items-center border-b border-[#e6e6eb] bg-white px-3 md:px-5">
      {/* Hamburger menu - mobile only */}
      <button
        onClick={toggleMobile}
        className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#60606a] transition-colors hover:bg-[#f4f4f6] hover:text-[#18181b] md:hidden"
        aria-label="Open sidebar menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Left: Title */}
      <div className="flex-1">
        <h1 className="text-[16px] font-semibold text-[#18181b]">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-[#a8a8b4]">{subtitle}</p>
        )}
      </div>

      {/* Center-right: Search (hidden on mobile) */}
      <div className="relative hidden sm:block">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a8a8b4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          className="h-8 w-[210px] rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] pl-8 pr-3 text-[13px] text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-300 focus:bg-white"
        />
      </div>

      {/* Right: Notifications + Action */}
      <div className="ml-3 flex items-center gap-2">
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#f4f4f6]">
          <svg className="h-4.5 w-4.5 text-[#60606a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex h-8 items-center rounded-lg bg-[#18181b] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2d2d30]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}

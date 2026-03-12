'use client';

import { useState, useCallback, useRef } from 'react';
import { RoleProvider } from '@/lib/role-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { UserProvider } from '@/lib/user-context';
import AuthGuard from '@/components/AuthGuard';
import IconRail from '@/components/IconRail';
import FlyoutPanel from '@/components/FlyoutPanel';
import CommandPalette from '@/components/CommandPalette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const showFlyout = useCallback((groupIndex: number | null) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setActiveGroup(groupIndex);
  }, []);

  const scheduleFlyoutHide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setActiveGroup(null);
    }, 200);
  }, []);

  const keepFlyoutOpen = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  return (
    <AuthGuard>
      <RoleProvider>
        <UserProvider>
          <SidebarProvider>
              <div className="flex h-screen bg-[var(--surface-app)]">
                <IconRail
                  onHoverGroup={showFlyout}
                  onLeaveRail={scheduleFlyoutHide}
                />
                <FlyoutPanel
                  activeGroup={activeGroup}
                  onMouseEnter={keepFlyoutOpen}
                  onMouseLeave={scheduleFlyoutHide}
                />
                <main className="relative z-10 flex-1 overflow-auto pb-14 md:pb-0">
                  {children}
                </main>
                <CommandPalette />
              </div>
          </SidebarProvider>
        </UserProvider>
      </RoleProvider>
    </AuthGuard>
  );
}

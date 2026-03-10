import { RoleProvider } from '@/lib/role-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <RoleProvider>
        <SidebarProvider>
          <div className="flex h-screen bg-[#f4f4f6]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </RoleProvider>
    </AuthGuard>
  );
}

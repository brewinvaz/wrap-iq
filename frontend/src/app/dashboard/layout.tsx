import { RoleProvider } from '@/lib/role-context';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <div className="flex h-screen bg-[#f4f4f6]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar title="Dashboard" actionLabel="+ New Job" />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}

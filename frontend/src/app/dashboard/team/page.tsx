'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import TeamList from '@/components/team/TeamList';
import PermissionsMatrix from '@/components/team/PermissionsMatrix';
import InviteModal from '@/components/team/InviteModal';
import { TeamMemberDetail, Permission } from '@/lib/types';
import { api, ApiError } from '@/lib/api-client';
import { permissionsMatrix } from '@/lib/role-config';

// --- API response types ---

interface ApiUserResponse {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}

interface ApiInviteResponse extends ApiUserResponse {
  updated_at: string;
}

// --- Transform API user to TeamMemberDetail ---

const avatarColors = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-slate-500',
  'bg-cyan-500',
  'bg-indigo-500',
];

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.trim().slice(0, 2).toUpperCase();
  }
  // Fallback to email-based initials
  const name = email.split('@')[0];
  if (name.includes('.')) {
    const emailParts = name.split('.');
    return (emailParts[0][0] + emailParts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatJoinedDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function transformApiUser(user: ApiUserResponse, index: number): TeamMemberDetail {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    isSuperadmin: user.is_superadmin,
    initials: getInitials(user.full_name, user.email),
    color: avatarColors[index % avatarColors.length],
    joinedDate: user.created_at ? formatJoinedDate(user.created_at) : '',
  };
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-app)]" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        </div>
      </header>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <div className="h-10 w-10 rounded-full bg-[var(--surface-raised)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-[var(--surface-raised)]" />
                <div className="h-3 w-32 rounded bg-[var(--surface-app)]" />
              </div>
              <div className="h-6 w-24 rounded-full bg-[var(--surface-app)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Error state ---

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Team Management</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-red-500/10 p-3">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load team members</p>
        <p className="text-xs text-[var(--text-secondary)]">{message}</p>
        <Button onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  const [permissions] = useState<Permission[]>(permissionsMatrix);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const users = await api.get<ApiUserResponse[]>('/api/admin/users');
      setMembers(users.map((u, i) => transformApiUser(u, i)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Non-admin user: show only self
        try {
          const me = await api.get<ApiUserResponse>('/api/users/me');
          setMembers([transformApiUser(me, 0)]);
        } catch (meErr) {
          const message = meErr instanceof ApiError ? meErr.message : 'An unexpected error occurred';
          setError(message);
        }
      } else {
        const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      await api.patch<ApiUserResponse>(`/api/admin/users/${memberId}/role`, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      // Optimistic rollback not needed since we only update on success
      const message = err instanceof ApiError ? err.message : 'Failed to update role';
      alert(message);
    }
  }

  async function handleToggleActive(memberId: string) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    try {
      await api.patch<ApiUserResponse>(`/api/admin/users/${memberId}/active`, {
        is_active: !member.isActive,
      });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, isActive: !m.isActive } : m,
        ),
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to toggle status';
      alert(message);
    }
  }

  async function handleInvite(email: string, role: string) {
    try {
      const newUser = await api.post<ApiInviteResponse>('/api/admin/users/invite', { email, role });
      const newMember = transformApiUser(newUser, members.length);
      setMembers((prev) => [...prev, newMember]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to invite user';
      alert(message);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchTeam} />;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">
              Team Management
            </h1>
            <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {members.length} members
            </span>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            + Invite Member
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <TeamList
          members={members}
          onRoleChange={handleRoleChange}
          onToggleActive={handleToggleActive}
        />
        <PermissionsMatrix permissions={permissions} />
      </div>

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}

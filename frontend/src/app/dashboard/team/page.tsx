'use client';

import { useState } from 'react';
import TeamList from '@/components/team/TeamList';
import PermissionsMatrix from '@/components/team/PermissionsMatrix';
import InviteModal from '@/components/team/InviteModal';
import { TeamMemberDetail } from '@/lib/types';
import {
  teamMembers as initialMembers,
  permissionsMatrix,
} from '@/lib/mock-team-data';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberDetail[]>(initialMembers);
  const [showInvite, setShowInvite] = useState(false);

  function handleRoleChange(memberId: string, newRole: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
    );
  }

  function handleToggleActive(memberId: string) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, isActive: !m.isActive } : m,
      ),
    );
  }

  function handleInvite(email: string, role: string) {
    const initials = email
      .split('@')[0]
      .slice(0, 2)
      .toUpperCase();
    const colors = [
      'bg-blue-500',
      'bg-violet-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-slate-500',
    ];
    const newMember: TeamMemberDetail = {
      id: crypto.randomUUID(),
      email,
      role,
      isActive: true,
      isSuperadmin: false,
      initials,
      color: colors[Math.floor(Math.random() * colors.length)],
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setMembers((prev) => [...prev, newMember]);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">
              Team Management
            </h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {members.length} members
            </span>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Invite Member
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <TeamList
          members={members}
          onInvite={() => setShowInvite(true)}
          onRoleChange={handleRoleChange}
          onToggleActive={handleToggleActive}
        />
        <PermissionsMatrix permissions={permissionsMatrix} />
      </div>

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}

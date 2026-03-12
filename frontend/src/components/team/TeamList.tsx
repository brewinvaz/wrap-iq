'use client';

import { useState } from 'react';
import { TeamMemberDetail } from '@/lib/types';
import { roleLabels, roleColors } from '@/lib/role-config';

const allRoles = [
  'admin',
  'project_manager',
  'installer',
  'designer',
  'production',
  'client',
];

interface TeamListProps {
  members: TeamMemberDetail[];
  onInvite: () => void;
  onRoleChange: (memberId: string, newRole: string) => void;
  onToggleActive: (memberId: string) => void;
}

export default function TeamList({
  members,
  onInvite,
  onRoleChange,
  onToggleActive,
}: TeamListProps) {
  const [editingRole, setEditingRole] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Members</h2>
          <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {members.filter((m) => m.isActive).length} active
          </span>
        </div>
        <button
          onClick={onInvite}
          className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          + Invite Member
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {members.map((member) => (
              <tr
                key={member.id}
                className="transition-colors hover:bg-[var(--surface-raised)]"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ${member.color}`}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {member.email}
                      </p>
                      {member.lastActive && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Last active: {member.lastActive}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingRole === member.id ? (
                    <select
                      value={member.role}
                      onChange={(e) => {
                        onRoleChange(member.id, e.target.value);
                        setEditingRole(null);
                      }}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    >
                      {allRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingRole(member.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${roleColors[member.role] || 'bg-[var(--surface-raised)] text-[var(--text-primary)]'}`}
                    >
                      {roleLabels[member.role] || member.role}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      member.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        member.isActive ? 'bg-emerald-500' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {member.joinedDate}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onToggleActive(member.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      member.isActive
                        ? 'border border-red-200 text-red-600 hover:bg-red-50'
                        : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {member.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

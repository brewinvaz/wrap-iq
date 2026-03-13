'use client';

import { useState } from 'react';
import { TeamMemberDetail } from '@/lib/types';
import { roleLabels, roleColors } from '@/lib/role-config';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

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
        <Button onClick={onInvite}>
          + Invite Member
        </Button>
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
                    <Select
                      value={member.role}
                      onChange={(v) => {
                        onRoleChange(member.id, v);
                        setEditingRole(null);
                      }}
                      options={allRoles.map((role) => ({
                        value: role,
                        label: roleLabels[role],
                      }))}
                      size="sm"
                    />
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
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
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
                  <Button
                    variant={member.isActive ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() => onToggleActive(member.id)}
                  >
                    {member.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

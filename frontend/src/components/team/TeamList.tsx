'use client';

import { useState } from 'react';
import { TeamMemberDetail } from '@/lib/types';
import { roleLabels, roleColors } from '@/lib/mock-team-data';

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
    <div className="rounded-xl border border-[#e6e6eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e6e6eb] px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#18181b]">Team Members</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
            {members.filter((m) => m.isActive).length} active
          </span>
        </div>
        <button
          onClick={onInvite}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Invite Member
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e6e6eb]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e6eb]">
            {members.map((member) => (
              <tr
                key={member.id}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ${member.color}`}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#18181b]">
                        {member.email}
                      </p>
                      {member.lastActive && (
                        <p className="text-xs text-[#a8a8b4]">
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
                      className="rounded-lg border border-[#e6e6eb] px-2 py-1 text-sm text-[#18181b] focus:border-blue-500 focus:outline-none"
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
                      className={`rounded-full px-3 py-1 text-xs font-medium ${roleColors[member.role] || 'bg-gray-100 text-gray-700'}`}
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
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        member.isActive ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#60606a]">
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

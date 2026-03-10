'use client';

import { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  color: string;
  status: 'active' | 'inactive';
  lastLogin: string;
}

const initialUsers: User[] = [
  { id: '1', name: 'Marcus Johnson', email: 'marcus@wrapflow.io', role: 'Admin', initials: 'MJ', color: 'bg-blue-500', status: 'active', lastLogin: '2026-03-10' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@wrapflow.io', role: 'Designer', initials: 'SC', color: 'bg-violet-500', status: 'active', lastLogin: '2026-03-10' },
  { id: '3', name: 'Alex Rivera', email: 'alex@wrapflow.io', role: 'Production', initials: 'AR', color: 'bg-emerald-500', status: 'active', lastLogin: '2026-03-09' },
  { id: '4', name: 'Jordan Lee', email: 'jordan@wrapflow.io', role: 'Designer', initials: 'JL', color: 'bg-amber-500', status: 'active', lastLogin: '2026-03-10' },
  { id: '5', name: 'Taylor Wright', email: 'taylor@wrapflow.io', role: 'Installer', initials: 'TW', color: 'bg-rose-500', status: 'active', lastLogin: '2026-03-08' },
  { id: '6', name: 'Casey Morgan', email: 'casey@wrapflow.io', role: 'PM', initials: 'CM', color: 'bg-pink-500', status: 'inactive', lastLogin: '2026-02-15' },
  { id: '7', name: 'Devon Patel', email: 'devon@wrapflow.io', role: 'Installer', initials: 'DP', color: 'bg-teal-500', status: 'active', lastLogin: '2026-03-09' },
];

const roleColors: Record<string, string> = {
  Admin: 'bg-blue-50 text-blue-700',
  PM: 'bg-violet-50 text-violet-700',
  Designer: 'bg-pink-50 text-pink-700',
  Installer: 'bg-emerald-50 text-emerald-700',
  Production: 'bg-amber-50 text-amber-700',
};

export default function UsersPage() {
  const [users] = useState<User[]>(initialUsers);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">User Management</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {users.length} users
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + Invite User
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">User</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Email</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Role</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Last Login</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${u.color}`}>
                        {u.initials}
                      </div>
                      <span className="font-medium text-[#18181b]">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#60606a]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[u.role] ?? 'bg-gray-100 text-gray-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-xs capitalize text-[#60606a]">{u.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#60606a]">{u.lastLogin}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs font-medium text-blue-600 hover:text-blue-800">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

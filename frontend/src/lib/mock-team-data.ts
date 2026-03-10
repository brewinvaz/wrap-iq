import { TeamMemberDetail, Permission } from './types';

export const teamMembers: TeamMemberDetail[] = [
  {
    id: '1',
    email: 'brewin@wrapiq.com',
    role: 'admin',
    isActive: true,
    isSuperadmin: false,
    initials: 'BV',
    color: 'bg-blue-500',
    joinedDate: '2024-01-15',
    lastActive: '2026-03-10',
  },
  {
    id: '2',
    email: 'sarah@wrapiq.com',
    role: 'project_manager',
    isActive: true,
    isSuperadmin: false,
    initials: 'SK',
    color: 'bg-violet-500',
    joinedDate: '2024-03-20',
    lastActive: '2026-03-09',
  },
  {
    id: '3',
    email: 'mike@wrapiq.com',
    role: 'installer',
    isActive: true,
    isSuperadmin: false,
    initials: 'MR',
    color: 'bg-emerald-500',
    joinedDate: '2024-06-01',
    lastActive: '2026-03-10',
  },
  {
    id: '4',
    email: 'lisa@wrapiq.com',
    role: 'designer',
    isActive: true,
    isSuperadmin: false,
    initials: 'LC',
    color: 'bg-amber-500',
    joinedDate: '2024-07-10',
    lastActive: '2026-03-08',
  },
  {
    id: '5',
    email: 'tom@wrapiq.com',
    role: 'production',
    isActive: true,
    isSuperadmin: false,
    initials: 'TW',
    color: 'bg-slate-500',
    joinedDate: '2024-09-15',
    lastActive: '2026-03-10',
  },
  {
    id: '6',
    email: 'client@acmecorp.com',
    role: 'client',
    isActive: true,
    isSuperadmin: false,
    initials: 'AC',
    color: 'bg-rose-500',
    joinedDate: '2025-01-05',
    lastActive: '2026-02-28',
  },
  {
    id: '7',
    email: 'jake@wrapiq.com',
    role: 'installer',
    isActive: false,
    isSuperadmin: false,
    initials: 'JD',
    color: 'bg-emerald-500',
    joinedDate: '2024-04-12',
    lastActive: '2025-12-01',
  },
  {
    id: '8',
    email: 'nina@wrapiq.com',
    role: 'designer',
    isActive: true,
    isSuperadmin: false,
    initials: 'NP',
    color: 'bg-amber-500',
    joinedDate: '2025-02-20',
    lastActive: '2026-03-09',
  },
];

const allRoles = [
  'admin',
  'project_manager',
  'installer',
  'designer',
  'production',
  'client',
];

export const permissionsMatrix: Permission[] = [
  {
    feature: 'Projects',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin' || role === 'project_manager'
          ? 'full'
          : role === 'client'
            ? 'read'
            : role === 'installer' || role === 'designer' || role === 'production'
              ? 'read'
              : 'none',
    })),
  },
  {
    feature: 'Calendar',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin' || role === 'project_manager'
          ? 'full'
          : role === 'installer' || role === 'designer' || role === 'production'
            ? 'read'
            : 'none',
    })),
  },
  {
    feature: 'Clients',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin' || role === 'project_manager'
          ? 'full'
          : role === 'client'
            ? 'read'
            : 'none',
    })),
  },
  {
    feature: 'Estimates',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin' || role === 'project_manager'
          ? 'full'
          : role === 'designer'
            ? 'read'
            : role === 'client'
              ? 'read'
              : 'none',
    })),
  },
  {
    feature: 'Design Queue',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin' || role === 'designer'
          ? 'full'
          : role === 'project_manager'
            ? 'full'
            : role === 'production'
              ? 'read'
              : 'none',
    })),
  },
  {
    feature: 'Reports',
    roles: allRoles.map((role) => ({
      role,
      access:
        role === 'admin'
          ? 'full'
          : role === 'project_manager'
            ? 'read'
            : 'none',
    })),
  },
  {
    feature: 'Settings',
    roles: allRoles.map((role) => ({
      role,
      access: role === 'admin' ? 'full' : 'none',
    })),
  },
];

export const roleLabels: Record<string, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  installer: 'Installer',
  designer: 'Designer',
  production: 'Production',
  client: 'Client',
};

export const roleColors: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  project_manager: 'bg-violet-100 text-violet-700',
  installer: 'bg-emerald-100 text-emerald-700',
  designer: 'bg-amber-100 text-amber-700',
  production: 'bg-slate-100 text-slate-700',
  client: 'bg-rose-100 text-rose-700',
};

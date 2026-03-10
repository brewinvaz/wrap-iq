import { Permission } from './types';

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

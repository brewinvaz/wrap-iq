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
  admin: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  project_manager: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  installer: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  designer: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  production: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  client: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
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
    feature: 'Jobs',
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

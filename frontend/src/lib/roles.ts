export type RoleKey = 'admin' | 'pm' | 'installer' | 'designer' | 'production' | 'client';

export type BadgeVariant = 'default' | 'amber';

export interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: number;
  badgeVariant?: BadgeVariant;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface RoleConfig {
  name: string;
  title: string;
  avatarBg: string;
  avatarText: string;
  navGroups: NavGroup[];
  showPhaseKey: boolean;
}

export const ROLES: Record<RoleKey, RoleConfig> = {
  admin: {
    name: 'Admin User',
    title: 'Administrator',
    avatarBg: 'bg-blue-600',
    avatarText: 'AU',
    showPhaseKey: true,
    navGroups: [
      {
        label: 'Workspace',
        items: [
          { icon: '📋', label: 'Jobs Board', href: '/dashboard', badge: 12 },
          { icon: '📊', label: 'All Jobs Board', href: '/dashboard/jobs' },
          { icon: '📦', label: 'Work Orders', href: '/dashboard/work-orders' },
          { icon: '📅', label: 'Calendar', href: '/dashboard/calendar', badge: 3, badgeVariant: 'amber' },
          { icon: '💬', label: 'Communications', href: '/dashboard/comms' },
          { icon: '🗓️', label: 'Schedule', href: '/dashboard/schedule' },
          { icon: '👥', label: 'Customers', href: '/dashboard/customers' },
        ],
      },
      {
        label: 'Production',
        items: [
          { icon: '🎨', label: 'Design Queue', href: '/dashboard/design-queue', badge: 4 },
          { icon: '🖨️', label: 'Print / Lam', href: '/dashboard/print' },
          { icon: '🔧', label: 'Install Schedule', href: '/dashboard/install-schedule' },
        ],
      },
      {
        label: 'Business',
        items: [
          { icon: '💰', label: 'Financials', href: '/dashboard/financials' },
          { icon: '📝', label: 'Estimates', href: '/dashboard/estimates' },
          { icon: '🧾', label: 'Invoices', href: '/dashboard/invoices' },
          { icon: '📈', label: 'Reports', href: '/dashboard/reports' },
          { icon: '⏱️', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: '👤', label: 'User Management', href: '/dashboard/team' },
          { icon: '💳', label: 'Billing & Settings', href: '/dashboard/settings/billing' },
          { icon: '🔑', label: 'API Keys', href: '/dashboard/settings/api-keys' },
          { icon: '🔌', label: 'Integrations', href: '/dashboard/integrations' },
        ],
      },
      {
        label: 'AI',
        items: [
          { icon: '🤖', label: 'Shop Intelligence', href: '/dashboard/ai' },
          { icon: '🧊', label: '3D Rendering', href: '/dashboard/3d' },
        ],
      },
    ],
  },
  pm: {
    name: 'Project Manager',
    title: 'Project Manager',
    avatarBg: 'bg-violet-600',
    avatarText: 'PM',
    showPhaseKey: true,
    navGroups: [
      {
        label: 'Projects',
        items: [
          { icon: '📋', label: 'My Jobs', href: '/dashboard', badge: 8 },
          { icon: '📊', label: 'All Jobs Board', href: '/dashboard/jobs' },
          { icon: '📅', label: 'Schedule', href: '/dashboard/schedule', badge: 4 },
          { icon: '👥', label: 'Team Assignments', href: '/dashboard/team' },
        ],
      },
      {
        label: 'Clients',
        items: [
          { icon: '💬', label: 'Client Comms', href: '/dashboard/comms', badge: 2, badgeVariant: 'amber' },
          { icon: '📄', label: 'Contracts & Docs', href: '/dashboard/contracts' },
          { icon: '✅', label: 'Proof Approvals', href: '/dashboard/proofs' },
        ],
      },
      {
        label: 'Reports',
        items: [
          { icon: '⏱️', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: '📈', label: 'Job Reports', href: '/dashboard/reports' },
        ],
      },
    ],
  },
  installer: {
    name: 'Installer',
    title: 'Installer',
    avatarBg: 'bg-emerald-600',
    avatarText: 'IN',
    showPhaseKey: true,
    navGroups: [
      {
        label: 'My Work',
        items: [
          { icon: '📋', label: 'My Jobs', href: '/dashboard', badge: 4 },
          { icon: '📅', label: 'My Schedule', href: '/dashboard/schedule' },
          { icon: '📸', label: 'Photos', href: '/dashboard/photos' },
          { icon: '⏱️', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: '⚙️', label: 'Equipment', href: '/dashboard/equipment' },
          { icon: '📦', label: 'Materials', href: '/dashboard/materials' },
        ],
      },
      {
        label: 'Job Tools',
        items: [
          { icon: '✅', label: 'Checklists', href: '/dashboard/checklists' },
          { icon: '📄', label: 'Proofs & Instructions', href: '/dashboard/proofs' },
          { icon: '💬', label: 'Job Chat', href: '/dashboard/comms' },
        ],
      },
    ],
  },
  designer: {
    name: 'Designer',
    title: 'Designer',
    avatarBg: 'bg-pink-600',
    avatarText: 'DS',
    showPhaseKey: true,
    navGroups: [
      {
        label: 'Design',
        items: [
          { icon: '🎨', label: 'My Queue', href: '/dashboard', badge: 4 },
          { icon: '📤', label: 'Proofs Sent', href: '/dashboard/proofs', badge: 2, badgeVariant: 'amber' },
          { icon: '⏱️', label: 'Design Hours', href: '/dashboard/hours' },
          { icon: '💬', label: 'Team Comms', href: '/dashboard/comms' },
        ],
      },
      {
        label: 'Assets',
        items: [
          { icon: '📁', label: 'Brand Files', href: '/dashboard/brand-files' },
          { icon: '🧊', label: '3D Rendering', href: '/dashboard/3d' },
          { icon: '📝', label: 'Job Briefs', href: '/dashboard/briefs' },
        ],
      },
    ],
  },
  production: {
    name: 'Production',
    title: 'Production',
    avatarBg: 'bg-amber-600',
    avatarText: 'PR',
    showPhaseKey: true,
    navGroups: [
      {
        label: 'My Queue',
        items: [
          { icon: '🖨️', label: 'Print Queue', href: '/dashboard', badge: 3 },
          { icon: '⚙️', label: 'My Equipment', href: '/dashboard/equipment' },
          { icon: '📦', label: 'Materials', href: '/dashboard/materials' },
          { icon: '⏱️', label: 'Time Tracking', href: '/dashboard/time-logs' },
        ],
      },
      {
        label: 'Jobs',
        items: [
          { icon: '📋', label: 'Assigned Jobs', href: '/dashboard/jobs' },
          { icon: '📅', label: 'Schedule', href: '/dashboard/schedule' },
        ],
      },
    ],
  },
  client: {
    name: 'Client',
    title: 'Client Portal',
    avatarBg: 'bg-gray-600',
    avatarText: 'CL',
    showPhaseKey: false,
    navGroups: [],
  },
};

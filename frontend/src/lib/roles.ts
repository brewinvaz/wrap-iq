export type RoleKey = 'admin' | 'pm' | 'installer' | 'designer' | 'production' | 'client';

export type BadgeVariant = 'default' | 'amber';

/** Keys that map to counts returned by GET /api/sidebar/badges. */
export type BadgeKey = 'work_orders' | 'unread_notifications' | 'design_queue';

export interface NavItem {
  /** Lucide icon name (e.g. 'ClipboardList', 'Palette') */
  icon: string;
  label: string;
  href: string;
  /** Static badge value (ignored when badgeKey is set and a live count is available). */
  badge?: number;
  /** Key used to look up a live count from the sidebar badges API. */
  badgeKey?: BadgeKey;
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
          { icon: 'ClipboardList', label: 'Jobs', href: '/dashboard', badgeKey: 'work_orders' },
          { icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
          { icon: 'MessageSquare', label: 'Communications', href: '/dashboard/comms' },
          { icon: 'Users', label: 'Customers', href: '/dashboard/customers' },
        ],
      },
      {
        label: 'Production',
        items: [
          { icon: 'Palette', label: 'Design Queue', href: '/dashboard/design-queue', badgeKey: 'design_queue' },
          { icon: 'Printer', label: 'Print / Lam', href: '/dashboard/print' },
          { icon: 'Settings', label: 'Equipment', href: '/dashboard/equipment' },
        ],
      },
      {
        label: 'Business',
        items: [
          { icon: 'DollarSign', label: 'Financials', href: '/dashboard/financials' },
          { icon: 'FileText', label: 'Estimates', href: '/dashboard/estimates' },
          { icon: 'Receipt', label: 'Invoices', href: '/dashboard/invoices' },
          { icon: 'TrendingUp', label: 'Reports', href: '/dashboard/reports' },
          { icon: 'Clock', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: 'BarChart3', label: 'Analytics', href: '/dashboard/analytics' },
          { icon: 'User', label: 'User Management', href: '/dashboard/team' },
          { icon: 'CreditCard', label: 'Billing & Settings', href: '/dashboard/settings/billing' },
          { icon: 'Key', label: 'API Keys', href: '/dashboard/settings/api-keys' },
          { icon: 'Settings', label: 'Estimate Defaults', href: '/dashboard/settings/estimate-defaults' },
          { icon: 'ListChecks', label: 'Task Presets', href: '/dashboard/settings/task-presets' },
          { icon: 'Plug', label: 'Integrations', href: '/dashboard/integrations' },
        ],
      },
      {
        label: 'AI & Tools',
        items: [
          { icon: 'Bot', label: 'Shop Intelligence', href: '/dashboard/ai' },
          { icon: 'Box', label: '3D Rendering', href: '/dashboard/3d' },
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
        label: 'Jobs',
        items: [
          { icon: 'ClipboardList', label: 'My Jobs', href: '/dashboard', badgeKey: 'work_orders' },
          { icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
          { icon: 'Users', label: 'Team Assignments', href: '/dashboard/team' },
        ],
      },
      {
        label: 'Clients',
        items: [
          { icon: 'MessageSquare', label: 'Client Comms', href: '/dashboard/comms', badgeKey: 'unread_notifications', badgeVariant: 'amber' },
          { icon: 'File', label: 'Contracts & Docs', href: '/dashboard/contracts' },
          { icon: 'CheckSquare', label: 'Proof Approvals', href: '/dashboard/proofs' },
        ],
      },
      {
        label: 'Reports',
        items: [
          { icon: 'Clock', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: 'BarChart3', label: 'Analytics', href: '/dashboard/analytics' },
          { icon: 'TrendingUp', label: 'Job Reports', href: '/dashboard/reports' },
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
          { icon: 'ClipboardList', label: 'My Jobs', href: '/dashboard', badgeKey: 'work_orders' },
          { icon: 'Calendar', label: 'My Schedule', href: '/dashboard/calendar' },
          { icon: 'Camera', label: 'Photos', href: '/dashboard/photos' },
          { icon: 'Clock', label: 'Time Tracking', href: '/dashboard/time-logs' },
          { icon: 'Settings', label: 'Equipment', href: '/dashboard/equipment' },
          { icon: 'Package', label: 'Materials', href: '/dashboard/materials' },
        ],
      },
      {
        label: 'Job Tools',
        items: [
          { icon: 'CheckSquare', label: 'Checklists', href: '/dashboard/checklists' },
          { icon: 'File', label: 'Proofs & Instructions', href: '/dashboard/proofs' },
          { icon: 'MessageSquare', label: 'Job Chat', href: '/dashboard/comms' },
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
          { icon: 'Palette', label: 'My Queue', href: '/dashboard', badgeKey: 'design_queue' },
          { icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
          { icon: 'Upload', label: 'Proofs Sent', href: '/dashboard/proofs', badgeKey: 'unread_notifications', badgeVariant: 'amber' },
          { icon: 'Clock', label: 'Design Hours', href: '/dashboard/hours' },
          { icon: 'MessageSquare', label: 'Team Comms', href: '/dashboard/comms' },
        ],
      },
      {
        label: 'Assets',
        items: [
          { icon: 'FolderOpen', label: 'Brand Files', href: '/dashboard/brand-files' },
          { icon: 'Box', label: '3D Rendering', href: '/dashboard/3d' },
          { icon: 'BookOpen', label: 'Job Briefs', href: '/dashboard/briefs' },
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
          { icon: 'Printer', label: 'Print Queue', href: '/dashboard', badgeKey: 'work_orders' },
          { icon: 'Settings', label: 'My Equipment', href: '/dashboard/equipment' },
          { icon: 'Package', label: 'Materials', href: '/dashboard/materials' },
          { icon: 'Clock', label: 'Time Tracking', href: '/dashboard/time-logs' },
        ],
      },
      {
        label: 'Jobs',
        items: [
          { icon: 'ClipboardList', label: 'Assigned Jobs', href: '/dashboard' },
          { icon: 'Calendar', label: 'Calendar', href: '/dashboard/calendar' },
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

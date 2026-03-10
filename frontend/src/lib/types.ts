export type Priority = 'high' | 'medium' | 'low';

export type JobTag =
  | 'full-wrap'
  | 'partial'
  | 'commercial'
  | 'fleet'
  | 'rush'
  | 'design'
  | 'print'
  | 'install';

export interface TeamMember {
  initials: string;
  color: string;
}

export interface ProjectCard {
  id: string;
  name: string;
  vehicle: string;
  client: string;
  value: number;
  date: string;
  priority: Priority;
  tags: JobTag[];
  team: TeamMember[];
  progress?: number;
  tasks?: { label: string; done: boolean }[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: ProjectCard[];
}

export interface CalendarEvent {
  id: string;
  projectId: string;
  title: string;
  vehicle: string;
  installer: string;
  installerInitials: string;
  installerColor: string;
  date: string;
  startTime: string;
  endTime: string;
  difficulty: 'easy' | 'standard' | 'complex';
  location: 'shop' | 'on-site';
  color: string;
}

export interface Installer {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface ClientContact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface ClientVehicle {
  vin: string;
  year: string;
  make: string;
  model: string;
}

export interface ClientProject {
  id: string;
  name: string;
  date: string;
  value: number;
  status: 'completed' | 'in-progress' | 'scheduled';
}

export interface Client {
  id: string;
  name: string;
  type: 'personal' | 'business';
  email: string;
  phone: string;
  address?: string;
  tags: string[];
  referralSource?: string;
  primaryContact?: string;
  contacts?: ClientContact[];
  vehicles: ClientVehicle[];
  projects: ClientProject[];
  projectCount: number;
  totalSpent: number;
  lastProject?: string;
  joinedDate: string;
  notes?: string;
}

export interface KPIMetric {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DepartmentScorecard {
  department: string;
  color: string;
  metrics: { label: string; value: string; subtext?: string }[];
}

export interface InstallerInsight {
  name: string;
  initials: string;
  color: string;
  installs: number;
  avgTime: string;
  rating: number;
}

export interface DesignerInsight {
  name: string;
  initials: string;
  color: string;
  hoursLogged: number;
  revisions: number;
  throughput: number;
}

export interface RevenueDataPoint {
  month: string;
  value: number;
}

export interface TeamMemberDetail {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuperadmin: boolean;
  initials: string;
  color: string;
  joinedDate: string;
  lastActive?: string;
}

export interface Permission {
  feature: string;
  roles: { role: string; access: 'full' | 'read' | 'none' }[];
}

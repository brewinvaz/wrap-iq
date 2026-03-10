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

export interface VehicleDetails {
  vin: string;
  year: string;
  make: string;
  model: string;
  vehicleType: string;
  unitNumber?: string;
}

export interface WrapDetails {
  coverage: string;
  roofCoverage: string;
  windowCoverage: string;
  bumperCoverage: string;
  doorHandles: string;
  miscItems: string[];
  specialInstructions?: string;
}

export interface DesignDetails {
  designHours: number;
  versionCount: number;
  revisionCount: number;
}

export interface ProductionDetails {
  equipment: string;
  mediaBrand: string;
  mediaWidth: string;
  laminateBrand: string;
  printLength: number;
}

export interface InstallDetails {
  location: string;
  difficulty: string;
  startDate: string;
  endDate: string;
  timeLogs: { installer: string; task: string; hours: number }[];
}

export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  changedBy: string;
}

export interface Note {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface ProjectPhoto {
  url: string;
  type: 'before' | 'after';
  caption?: string;
}

// --- Subscription & Billing ---

export interface BillingPlan {
  id: string;
  name: string;
  priceCents: number;
  priceYearlyCents?: number;
  maxSeats: number;
  maxStorageGb: number;
  features: string[];
  isDefault: boolean;
}

export type SubscriptionStatusType =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing';

export interface BillingSubscription {
  id: string;
  planId: string;
  planName: string;
  status: SubscriptionStatusType;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

export interface BillingPaymentMethod {
  id: string;
  type: 'card' | 'bank';
  lastFour: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export type InvoiceStatusType = 'paid' | 'pending' | 'failed' | 'refunded';

export interface BillingInvoice {
  id: string;
  amountCents: number;
  status: InvoiceStatusType;
  invoiceDate: string;
  paidAt?: string;
  description: string;
  invoiceNumber: string;
}

export interface BillingUsageMetrics {
  seatsUsed: number;
  seatsLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
  projectsCount: number;
}

export interface ProjectDetail extends ProjectCard {
  vehicleDetails: VehicleDetails;
  vehicleSummary: string;
  wrapDetails: WrapDetails;
  designDetails: DesignDetails;
  productionDetails: ProductionDetails;
  installDetails: InstallDetails;
  statusHistory: StatusHistoryEntry[];
  notes: Note[];
  photos: ProjectPhoto[];
  estimatedHours: number;
  actualHours: number;
  revenue: number;
  cost: number;
}

export interface APIKeyScope {
  scope: string;
  description: string;
}

export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
  usageCount: number;
}

export interface APIKeyUsageStats {
  totalRequests: number;
  requestsToday: number;
  avgResponseTime: number;
  topEndpoints: { endpoint: string; count: number }[];
}

export interface APIKeyCreateRequest {
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  expiresAt: string | null;
}

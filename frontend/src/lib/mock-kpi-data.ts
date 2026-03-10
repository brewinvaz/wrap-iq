import {
  KPIMetric,
  DepartmentScorecard,
  InstallerInsight,
  DesignerInsight,
  RevenueDataPoint,
} from './types';

export const topLevelKPIs: KPIMetric[] = [
  { label: 'Active Jobs', value: '12', delta: '+3', trend: 'up' },
  { label: 'Pipeline Value', value: '$64.9k', delta: '+$8.2k', trend: 'up' },
  { label: 'Monthly Revenue', value: '$42.3k', delta: '+12%', trend: 'up' },
  { label: 'Avg Completion Time', value: '6.2 days', delta: '-0.5d', trend: 'up' },
  { label: 'On-Time Rate', value: '94%', delta: '+2%', trend: 'up' },
  { label: 'Customer Satisfaction', value: '4.8/5', delta: '+0.1', trend: 'up' },
];

export const departmentScorecards: DepartmentScorecard[] = [
  {
    department: 'Sales',
    color: '#2563eb',
    metrics: [
      { label: 'Quotes Sent', value: '28', subtext: '+5 this week' },
      { label: 'Close Rate', value: '68%', subtext: 'vs 62% last month' },
      { label: 'Avg Deal Size', value: '$5,240', subtext: '+$340' },
      { label: 'Pipeline', value: '$64.9k', subtext: '14 open deals' },
    ],
  },
  {
    department: 'Design',
    color: '#7c3aed',
    metrics: [
      { label: 'In Progress', value: '6', subtext: '3 awaiting approval' },
      { label: 'Avg Turnaround', value: '2.1 days', subtext: '-0.3d vs last month' },
      { label: 'Revision Rate', value: '1.4x', subtext: 'per project avg' },
      { label: 'Utilization', value: '87%', subtext: 'design team capacity' },
    ],
  },
  {
    department: 'Production',
    color: '#d97706',
    metrics: [
      { label: 'In Queue', value: '4', subtext: '2 printing now' },
      { label: 'Material Waste', value: '3.2%', subtext: '-0.8% vs target' },
      { label: 'Daily Output', value: '2.4 jobs', subtext: 'avg this month' },
      { label: 'QC Pass Rate', value: '97%', subtext: 'first-pass yield' },
    ],
  },
  {
    department: 'Installation',
    color: '#059669',
    metrics: [
      { label: 'Scheduled', value: '3', subtext: 'this week' },
      { label: 'Avg Install Time', value: '7.2 hrs', subtext: '-0.5 hrs vs avg' },
      { label: 'Rework Rate', value: '2.1%', subtext: 'below 3% target' },
      { label: 'Team Capacity', value: '78%', subtext: '3 of 4 bays active' },
    ],
  },
];

export const installerInsights: InstallerInsight[] = [
  { name: 'Jake Dawson', initials: 'JD', color: '#2563eb', installs: 24, avgTime: '6.8 hrs', rating: 4.9 },
  { name: 'Kevin Reeves', initials: 'KR', color: '#7c3aed', installs: 21, avgTime: '7.1 hrs', rating: 4.7 },
  { name: 'Alex Moreno', initials: 'AM', color: '#059669', installs: 19, avgTime: '7.5 hrs', rating: 4.8 },
  { name: 'Lisa Nguyen', initials: 'LN', color: '#e11d48', installs: 16, avgTime: '6.4 hrs', rating: 4.9 },
  { name: 'Tom Bradley', initials: 'TB', color: '#d97706', installs: 14, avgTime: '8.0 hrs', rating: 4.5 },
];

export const designerInsights: DesignerInsight[] = [
  { name: 'Lisa Nguyen', initials: 'LN', color: '#e11d48', hoursLogged: 142, revisions: 18, throughput: 12 },
  { name: 'Kevin Reeves', initials: 'KR', color: '#7c3aed', hoursLogged: 128, revisions: 22, throughput: 10 },
  { name: 'Sam Park', initials: 'SP', color: '#0891b2', hoursLogged: 115, revisions: 14, throughput: 9 },
];

export const revenueData: RevenueDataPoint[] = [
  { month: 'Oct', value: 31200 },
  { month: 'Nov', value: 28400 },
  { month: 'Dec', value: 35600 },
  { month: 'Jan', value: 38100 },
  { month: 'Feb', value: 41800 },
  { month: 'Mar', value: 42300 },
];

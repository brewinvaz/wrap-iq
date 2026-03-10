import { ProjectDetail } from './types';

export const mockProjectDetails: Record<string, ProjectDetail> = {
  'WIQ-101': {
    id: 'WIQ-101',
    name: 'Tesla Model 3 Full Wrap',
    vehicle: '2024 Tesla Model 3 — Satin Black',
    vehicleSummary: '2024 Tesla Model 3 — Satin Black',
    client: 'AutoLux Motors',
    value: 4200,
    date: '2026-03-15',
    priority: 'high',
    tags: ['full-wrap', 'rush'],
    team: [
      { initials: 'JD', color: '#2563eb' },
      { initials: 'KR', color: '#7c3aed' },
    ],
    progress: 35,
    tasks: [
      { label: 'Client consultation completed', done: true },
      { label: 'Deposit received', done: true },
      { label: 'Material ordered', done: true },
      { label: 'Design mockup created', done: false },
      { label: 'Client approval on design', done: false },
      { label: 'Print files prepared', done: false },
      { label: 'Material printed', done: false },
      { label: 'Lamination complete', done: false },
      { label: 'Vehicle surface prep', done: false },
      { label: 'Wrap installation', done: false },
      { label: 'Quality check & detail', done: false },
      { label: 'Final photos taken', done: false },
    ],
    vehicleDetails: {
      vin: '5YJ3E1EA8RF123456',
      year: '2024',
      make: 'Tesla',
      model: 'Model 3',
      vehicleType: 'Sedan',
    },
    wrapDetails: {
      coverage: 'Full Wrap',
      roofCoverage: 'Wrapped',
      windowCoverage: 'Chrome Delete',
      bumperCoverage: 'Full Coverage',
      doorHandles: 'Wrapped',
      miscItems: ['Mirror Caps', 'Trunk Lip Spoiler', 'Rear Diffuser'],
      specialInstructions: 'Customer requests extra care around front sensors. Keep factory PPF on hood.',
    },
    designDetails: {
      designHours: 4.5,
      versionCount: 2,
      revisionCount: 1,
    },
    productionDetails: {
      equipment: 'Roland TrueVIS VG3-640',
      mediaBrand: '3M 2080 Satin Black',
      mediaWidth: '60"',
      laminateBrand: '3M Scotchcal 8519',
      printLength: 85,
    },
    installDetails: {
      location: 'Bay 2 — Main Shop',
      difficulty: 'Medium',
      startDate: '2026-03-18',
      endDate: '2026-03-20',
      timeLogs: [
        { installer: 'JD', task: 'Surface prep & cleaning', hours: 2.0 },
        { installer: 'JD', task: 'Hood & fenders', hours: 3.5 },
        { installer: 'KR', task: 'Doors & quarter panels', hours: 4.0 },
        { installer: 'KR', task: 'Bumpers & trim', hours: 2.5 },
        { installer: 'JD', task: 'Roof & pillars', hours: 3.0 },
      ],
    },
    statusHistory: [
      { status: 'Quoted', timestamp: '2026-03-01T09:00:00Z', changedBy: 'JD' },
      { status: 'Confirmed', timestamp: '2026-03-03T14:30:00Z', changedBy: 'JD' },
      { status: 'Design', timestamp: '2026-03-05T10:15:00Z', changedBy: 'LN' },
      { status: 'Production', timestamp: '2026-03-10T08:00:00Z', changedBy: 'AM' },
    ],
    notes: [
      {
        id: 'n1',
        text: 'Client prefers satin finish over matte. Confirmed 3M 2080 Satin Black is the right call.',
        author: 'JD',
        timestamp: '2026-03-01T09:30:00Z',
      },
      {
        id: 'n2',
        text: 'Material arrived early. Moving up production timeline by one day.',
        author: 'AM',
        timestamp: '2026-03-08T11:00:00Z',
      },
      {
        id: 'n3',
        text: 'Front bumper has a small rock chip near the driver-side fog light. Flagged to client — they approved proceeding as-is.',
        author: 'KR',
        timestamp: '2026-03-10T14:00:00Z',
      },
    ],
    photos: [
      { url: '/placeholder-before-1.jpg', type: 'before', caption: 'Front 3/4 view — pre-wrap' },
      { url: '/placeholder-before-2.jpg', type: 'before', caption: 'Rear view — pre-wrap' },
      { url: '/placeholder-before-3.jpg', type: 'before', caption: 'Driver side profile' },
      { url: '/placeholder-after-1.jpg', type: 'after', caption: 'Front 3/4 — satin black complete' },
      { url: '/placeholder-after-2.jpg', type: 'after', caption: 'Rear view — final' },
    ],
    estimatedHours: 18,
    actualHours: 15,
    revenue: 4200,
    cost: 1850,
  },
  'WIQ-098': {
    id: 'WIQ-098',
    name: 'BMW M4 Color Change',
    vehicle: '2024 BMW M4 — Gloss Racing Green',
    vehicleSummary: '2024 BMW M4 — Gloss Racing Green',
    client: 'James Morton',
    value: 5500,
    date: '2026-03-12',
    priority: 'high',
    tags: ['full-wrap'],
    team: [
      { initials: 'KR', color: '#7c3aed' },
      { initials: 'LN', color: '#e11d48' },
    ],
    tasks: [
      { label: 'Deposit received', done: true },
      { label: 'Material ordered', done: true },
      { label: 'Schedule confirmed', done: false },
    ],
    vehicleDetails: {
      vin: 'WBS43AZ09R1234567',
      year: '2024',
      make: 'BMW',
      model: 'M4 Competition',
      vehicleType: 'Coupe',
    },
    wrapDetails: {
      coverage: 'Full Color Change',
      roofCoverage: 'Wrapped — Gloss Black',
      windowCoverage: 'Chrome Delete',
      bumperCoverage: 'Full Coverage',
      doorHandles: 'Color Matched',
      miscItems: ['Mirror Caps', 'Kidney Grilles', 'Diffuser Accents'],
      specialInstructions: 'Customer wants contrasting gloss black roof and mirror caps.',
    },
    designDetails: {
      designHours: 2,
      versionCount: 1,
      revisionCount: 0,
    },
    productionDetails: {
      equipment: 'Roland TrueVIS VG3-640',
      mediaBrand: 'Avery Dennison SW900 Gloss Dark Green',
      mediaWidth: '60"',
      laminateBrand: 'Avery DOL 1460Z',
      printLength: 72,
    },
    installDetails: {
      location: 'Bay 1 — Main Shop',
      difficulty: 'High',
      startDate: '2026-03-14',
      endDate: '2026-03-17',
      timeLogs: [
        { installer: 'KR', task: 'Full disassembly', hours: 3.0 },
        { installer: 'KR', task: 'Body panels', hours: 6.0 },
        { installer: 'LN', task: 'Bumpers & complex curves', hours: 4.0 },
      ],
    },
    statusHistory: [
      { status: 'Quoted', timestamp: '2026-02-20T10:00:00Z', changedBy: 'JD' },
      { status: 'Confirmed', timestamp: '2026-02-25T16:00:00Z', changedBy: 'JD' },
    ],
    notes: [
      {
        id: 'n1',
        text: 'Client is a repeat customer. Gave 10% loyalty discount.',
        author: 'JD',
        timestamp: '2026-02-20T10:15:00Z',
      },
    ],
    photos: [
      { url: '/placeholder-before-1.jpg', type: 'before', caption: 'Original Alpine White' },
    ],
    estimatedHours: 22,
    actualHours: 13,
    revenue: 5500,
    cost: 2200,
  },
};

/** Get a ProjectDetail by ID, falling back to a generated stub for any card */
export function getProjectDetail(id: string): ProjectDetail | null {
  if (mockProjectDetails[id]) {
    return mockProjectDetails[id];
  }
  return null;
}

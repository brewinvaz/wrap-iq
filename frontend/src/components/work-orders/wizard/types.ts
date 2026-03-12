export type VehicleType =
  | 'car'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'utility_van'
  | 'box_truck'
  | 'semi'
  | 'trailer';

export type WrapCoverage = 'full' | 'three_quarter' | 'half' | 'spot_graphics';
export type CoverageLevel = 'no' | 'partial' | 'full';
export type WindowCoverage = 'no' | 'solid_vinyl' | 'perforated_vinyl';
export type BumperCoverage = 'no' | 'front' | 'back' | 'both';
export type InstallLocation = 'in_shop' | 'on_site';
export type InstallDifficulty = 'easy' | 'standard' | 'complex';

export interface BasicDetailsState {
  vehicleType: VehicleType | '';
  vin: string;
  year: string;
  make: string;
  model: string;
  paintColor: string;
  unitNumber: string;
  wrapCoverage: WrapCoverage | '';
}

export interface JobPricingState {
  jobType: 'personal' | 'commercial';
  jobValue: number | '';
  priority: 'low' | 'medium' | 'high';
  dateIn: string;
  estimatedCompletionDate: string;
  clientId: string;
  internalNotes: string;
}

export interface WrapDetailsState {
  roofCoverage: CoverageLevel;
  doorHandles: CoverageLevel;
  windowCoverage: WindowCoverage;
  bumperCoverage: BumperCoverage;
  miscItems: string[];
  specialInstructions: string;
}

export interface DesignState {
  designerIds: string[];
  proofingData: {
    versions: { name: string; status: string; files?: string[] }[];
  };
}

export interface ProductionState {
  printer: string;
  laminator: string;
  plotterCutter: string;
  printMedia: string;
  laminate: string;
  windowPerf: string;
  productionNotes: string;
}

export interface InstallState {
  installLocation: InstallLocation | '';
  installDifficulty: InstallDifficulty | '';
  installStartDate: string;
  installEndDate: string;
}

export interface WizardFormState {
  basicDetails: BasicDetailsState;
  jobPricing: JobPricingState;
  wrapDetails: WrapDetailsState;
  design: DesignState;
  production: ProductionState;
  install: InstallState;
}

export const INITIAL_BASIC_DETAILS: BasicDetailsState = {
  vehicleType: '',
  vin: '',
  year: '',
  make: '',
  model: '',
  paintColor: '',
  unitNumber: '',
  wrapCoverage: '',
};

export const INITIAL_JOB_PRICING: JobPricingState = {
  jobType: 'personal',
  jobValue: '',
  priority: 'medium',
  dateIn: new Date().toISOString().split('T')[0],
  estimatedCompletionDate: '',
  clientId: '',
  internalNotes: '',
};

export const INITIAL_WRAP_DETAILS: WrapDetailsState = {
  roofCoverage: 'no',
  doorHandles: 'no',
  windowCoverage: 'no',
  bumperCoverage: 'no',
  miscItems: [],
  specialInstructions: '',
};

export const INITIAL_DESIGN: DesignState = {
  designerIds: [],
  proofingData: { versions: [{ name: 'v1', status: 'draft' }] },
};

export const INITIAL_PRODUCTION: ProductionState = {
  printer: '',
  laminator: '',
  plotterCutter: '',
  printMedia: '',
  laminate: '',
  windowPerf: '',
  productionNotes: '',
};

export const INITIAL_INSTALL: InstallState = {
  installLocation: '',
  installDifficulty: '',
  installStartDate: '',
  installEndDate: '',
};

// Options for production dropdowns (matching Dan's designs)
export const PRINT_MEDIA_OPTIONS = [
  '', '3M IJ180mc', 'Avery MPI 1105', 'Oracal 970RA',
  '3M IJ3552C', 'Avery MPI 2105', 'Custom/Other',
];

export const LAMINATE_OPTIONS = [
  '', '3M 8518 Gloss', '3M 8520 Matte', 'Avery DOL 1360',
  'Oracal 290', 'Custom/Other',
];

export const WINDOW_PERF_OPTIONS = [
  '', '3M IJ8171', 'Avery MPI 3529', 'Oracal 3635', 'Custom/Other',
];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Sedan',
  suv: 'SUV',
  pickup: 'Pickup',
  van: 'Van',
  utility_van: 'Cargo Van',
  box_truck: 'Box Truck',
  semi: 'Semi',
  trailer: 'Trailer',
};

export const WRAP_COVERAGE_LABELS: Record<WrapCoverage, { label: string; pct: string }> = {
  full: { label: 'Full Wrap', pct: '100%' },
  three_quarter: { label: '3/4 Wrap', pct: '75%' },
  half: { label: '1/2 Wrap', pct: '50%' },
  spot_graphics: { label: 'Spot Graphics', pct: '25%' },
};

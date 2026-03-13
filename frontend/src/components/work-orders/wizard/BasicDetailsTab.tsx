'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type {
  BasicDetailsState,
  VehicleType,
  WrapCoverage,
} from './types';
import {
  VEHICLE_TYPE_LABELS,
  WRAP_COVERAGE_LABELS,
} from './types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  data: BasicDetailsState;
  onChange: (data: BasicDetailsState) => void;
}

/* ------------------------------------------------------------------ */
/*  VIN decode response                                                */
/* ------------------------------------------------------------------ */

interface VinResponse {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vehicle_type: string;
}

/* ------------------------------------------------------------------ */
/*  Vehicle type icons (simple SVG placeholders)                       */
/* ------------------------------------------------------------------ */

const VEHICLE_ICONS: Record<VehicleType, React.ReactNode> = {
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path d="M5 17h14M3 13l2-5h14l2 5M6 17a2 2 0 1 1-4 0M22 17a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="13" width="18" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  suv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path d="M3 14l2-6h14l2 6M5 18a2 2 0 1 1-4 0M23 18a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="18" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8V6h10v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pickup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path d="M2 14h10V8H5L2 14zM12 14h10v3H2v-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18a2 2 0 1 1-4 0M21 18a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  van: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a2 2 0 1 1-4 0M22 18a2 2 0 1 1-4 0M12 7v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  utility_van: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <rect x="1" y="6" width="22" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a2 2 0 1 1-4 0M22 18a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6v11M8 10h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  box_truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <rect x="1" y="5" width="15" height="12" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10h5l2 4v3h-7V10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a2 2 0 1 1-4 0M21 18a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  semi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <path d="M1 12h15V6H4L1 12zM16 12h6l1 3v2H16v-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a2 2 0 1 1-4 0M22 18a2 2 0 1 1-4 0M14 18a2 2 0 1 1-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trailer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
      <rect x="3" y="5" width="18" height="11" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18a2 2 0 1 1-4 0M20 18a2 2 0 1 1-4 0M1 16h2M21 16h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Vehicle type ordering (2 rows x 4 cols)                            */
/* ------------------------------------------------------------------ */

const VEHICLE_TYPE_ORDER: VehicleType[] = [
  'car',
  'suv',
  'pickup',
  'van',
  'utility_van',
  'box_truck',
  'semi',
  'trailer',
];

/* ------------------------------------------------------------------ */
/*  Wrap coverage ordering + color map                                 */
/* ------------------------------------------------------------------ */

const WRAP_COVERAGE_ORDER: WrapCoverage[] = [
  'full',
  'three_quarter',
  'half',
  'spot_graphics',
];

const WRAP_COVERAGE_COLORS: Record<WrapCoverage, { selected: string; ring: string }> = {
  full:           { selected: 'bg-emerald-600 border-emerald-500 text-white', ring: 'ring-emerald-500' },
  three_quarter:  { selected: 'bg-blue-600 border-blue-500 text-white',      ring: 'ring-blue-500'    },
  half:           { selected: 'bg-orange-600 border-orange-500 text-white',   ring: 'ring-orange-500'  },
  spot_graphics:  { selected: 'bg-purple-600 border-purple-500 text-white',   ring: 'ring-purple-500'  },
};

/* ------------------------------------------------------------------ */
/*  Photo placeholder labels                                           */
/* ------------------------------------------------------------------ */

const PHOTO_SLOTS = [
  { key: 'driver_side', label: 'Driver Side' },
  { key: 'passenger_side', label: 'Passenger Side' },
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
];

/* ------------------------------------------------------------------ */
/*  Shared style constants                                             */
/* ------------------------------------------------------------------ */

const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]';

const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-[var(--text-primary)]';

const SECTION_HEADING = 'text-sm font-semibold text-[var(--text-primary)]';

const HELPER_TEXT = 'mt-1 text-xs text-[var(--text-muted)]';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BasicDetailsTab({ data, onChange }: Props) {
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Generate and clean up preview URLs when vehiclePhotos change
  useEffect(() => {
    const newUrls: Record<string, string> = {};
    for (const [key, file] of Object.entries(data.vehiclePhotos)) {
      newUrls[key] = URL.createObjectURL(file);
    }
    setPreviewUrls(newUrls);

    return () => {
      for (const url of Object.values(newUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [data.vehiclePhotos]);

  const update = <K extends keyof BasicDetailsState>(field: K, value: BasicDetailsState[K]) => {
    onChange({ ...data, [field]: value });
  };

  /* ---- VIN decode ---- */

  const handleVinDecode = async () => {
    const vin = data.vin.trim();
    if (!vin || vin.length < 17) {
      setVinError('VIN must be 17 characters');
      return;
    }

    setVinLoading(true);
    setVinError('');

    try {
      const result = await api.get<VinResponse>(`/api/vin/${vin}`);
      onChange({
        ...data,
        year: result.year?.toString() || '',
        make: result.make || '',
        model: result.model || '',
        vehicleType: (result.vehicle_type as VehicleType) || '',
      });
    } catch {
      setVinError('Could not decode VIN. You can fill in the fields manually.');
    } finally {
      setVinLoading(false);
    }
  };

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      {/* ========== Vehicle Type ========== */}
      <div>
        <h3 className={SECTION_HEADING}>Vehicle Type</h3>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {VEHICLE_TYPE_ORDER.map((vt) => {
            const isSelected = data.vehicleType === vt;
            return (
              <button
                key={vt}
                type="button"
                onClick={() => update('vehicleType', vt)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {VEHICLE_ICONS[vt]}
                {VEHICLE_TYPE_LABELS[vt]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== VIN ========== */}
      <div>
        <label className={LABEL_CLASS}>VIN (Vehicle Identification Number)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={data.vin}
            onChange={(e) => update('vin', e.target.value.toUpperCase())}
            maxLength={17}
            className={`${INPUT_CLASS} flex-1 font-mono`}
            placeholder="Enter 17-character VIN"
          />
          <button
            type="button"
            onClick={handleVinDecode}
            disabled={vinLoading || data.vin.trim().length < 17}
            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vinLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Decoding...
              </span>
            ) : (
              'Decode'
            )}
          </button>
        </div>
        {vinError && <p className="mt-1 text-xs text-red-400">{vinError}</p>}
        <p className={HELPER_TEXT}>Enter the VIN to auto-populate vehicle details</p>
      </div>

      {/* ========== Year / Make ========== */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Year</label>
          <input
            type="text"
            value={data.year}
            onChange={(e) => update('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={INPUT_CLASS}
            placeholder="2024"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Make</label>
          <input
            type="text"
            value={data.make}
            onChange={(e) => update('make', e.target.value)}
            className={INPUT_CLASS}
            placeholder="Ford"
          />
        </div>
      </div>

      {/* ========== Model / Paint Color ========== */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Model</label>
          <input
            type="text"
            value={data.model}
            onChange={(e) => update('model', e.target.value)}
            className={INPUT_CLASS}
            placeholder="Transit"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Paint Color</label>
          <input
            type="text"
            value={data.paintColor}
            onChange={(e) => update('paintColor', e.target.value)}
            className={INPUT_CLASS}
            placeholder="White"
          />
        </div>
      </div>

      {/* ========== Unit Number ========== */}
      <div>
        <label className={LABEL_CLASS}>Unit Number (Fleet)</label>
        <input
          type="text"
          value={data.unitNumber}
          onChange={(e) => update('unitNumber', e.target.value)}
          className={INPUT_CLASS}
          placeholder="Optional"
        />
      </div>

      {/* ========== Wrap Coverage ========== */}
      <div>
        <h3 className={SECTION_HEADING}>Wrap Coverage</h3>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {WRAP_COVERAGE_ORDER.map((wc) => {
            const isSelected = data.wrapCoverage === wc;
            const colors = WRAP_COVERAGE_COLORS[wc];
            const info = WRAP_COVERAGE_LABELS[wc];
            return (
              <button
                key={wc}
                type="button"
                onClick={() => update('wrapCoverage', wc)}
                className={`rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition-colors ${
                  isSelected
                    ? `${colors.selected} ring-1 ${colors.ring}`
                    : 'border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div>{info.label}</div>
                <div className="mt-0.5 text-[10px] opacity-80">({info.pct})</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== Vehicle Photos ========== */}
      <div>
        <h3 className={SECTION_HEADING}>Vehicle Photos</h3>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PHOTO_SLOTS.map(({ key, label }) => {
            const hasFile = !!data.vehiclePhotos[key];
            return (
              <div key={key} className="relative">
                <input
                  ref={(el) => { fileInputRefs.current[key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const updated = { ...data.vehiclePhotos, [key]: file };
                      onChange({ ...data, vehiclePhotos: updated });
                    }
                    // Reset so same file can be re-selected
                    e.target.value = '';
                  }}
                />
                {hasFile ? (
                  <div className="relative rounded-lg border border-[var(--border)] overflow-hidden">
                    <img
                      src={previewUrls[key]}
                      alt={label}
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...data.vehiclePhotos };
                        delete next[key];
                        onChange({ ...data, vehiclePhotos: next });
                      }}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      aria-label={`Remove ${label} photo`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="bg-black/50 px-1.5 py-0.5 text-center">
                      <span className="text-[10px] font-medium text-white">{label}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRefs.current[key]?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-2 py-6 text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[10px] font-medium">{label}</span>
                    <span className="text-[10px]">Click to upload</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className={HELPER_TEXT}>
          Upload photos from each angle to help with design and installation planning.
        </p>
      </div>
    </div>
  );
}

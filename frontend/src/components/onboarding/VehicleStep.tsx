'use client';

import { useState } from 'react';
import type { VehicleData } from '@/app/onboarding/[token]/page';
import { API_BASE_URL } from '@/lib/config';

const API_BASE = API_BASE_URL;

const VEHICLE_TYPES = [
  { value: '', label: 'Select type...' },
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup Truck' },
  { value: 'van', label: 'Van' },
  { value: 'utility_van', label: 'Utility Van' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'semi', label: 'Semi' },
  { value: 'trailer', label: 'Trailer' },
];

interface Props {
  data: VehicleData;
  onChange: (data: VehicleData) => void;
  token: string;
  onBack: () => void;
  onNext: () => void;
}

export function VehicleStep({ data, onChange, token, onBack, onNext }: Props) {
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState('');

  const update = (field: keyof VehicleData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleVinDecode = async () => {
    if (!data.vin.trim() || data.vin.length < 17) {
      setVinError('VIN must be 17 characters');
      return;
    }

    setVinLoading(true);
    setVinError('');

    try {
      const res = await fetch(
        `${API_BASE}/api/portal/onboarding/${token}/vin/${data.vin}`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setVinError(err?.detail || 'Could not decode VIN');
        return;
      }

      const info = await res.json();
      onChange({
        ...data,
        year: info.year?.toString() || data.year,
        make: info.make || data.make,
        model: info.model || data.model,
        vehicle_type: info.vehicle_type || data.vehicle_type,
      });
    } catch {
      setVinError('Network error. You can fill in the fields manually.');
    } finally {
      setVinLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1 text-[16px] font-semibold text-[var(--text-primary)]">Vehicle Information</h2>
      <p className="mb-5 text-[13px] text-[var(--text-secondary)]">
        Enter a VIN to auto-fill, or fill in manually.
      </p>

      {/* VIN lookup */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">VIN</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={data.vin}
            onChange={(e) => update('vin', e.target.value.toUpperCase())}
            maxLength={17}
            className="flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] font-mono text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="1HGCM82633A123456"
          />
          <button
            type="button"
            onClick={handleVinDecode}
            disabled={vinLoading || data.vin.length < 17}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vinLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
                Looking up...
              </span>
            ) : (
              'Decode'
            )}
          </button>
        </div>
        {vinError && (
          <p className="mt-1.5 text-[12px] text-red-600">{vinError}</p>
        )}
        <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">Optional — or fill in the fields below manually</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Year</label>
          <input
            type="text"
            value={data.year}
            onChange={(e) => update('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="2024"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Make</label>
          <input
            type="text"
            value={data.make}
            onChange={(e) => update('make', e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="Ford"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Model</label>
          <input
            type="text"
            value={data.model}
            onChange={(e) => update('model', e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="Transit"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Vehicle type</label>
        <select
          value={data.vehicle_type}
          onChange={(e) => update('vehicle_type', e.target.value)}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] border border-[var(--border)] px-5 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded-[10px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Next
        </button>
      </div>
    </form>
  );
}

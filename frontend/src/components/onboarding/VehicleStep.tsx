'use client';

import { useState } from 'react';
import type { VehicleData } from '@/app/onboarding/[token]/page';
import { API_BASE_URL } from '@/lib/config';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

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
          <Button
            type="button"
            onClick={handleVinDecode}
            disabled={vinLoading || data.vin.length < 17}
            variant="secondary"
            loading={vinLoading}
          >
            {vinLoading ? 'Looking up...' : 'Decode'}
          </Button>
        </div>
        {vinError && (
          <p className="mt-1.5 text-[12px] text-red-400">{vinError}</p>
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
        <label htmlFor="vehicle-type" className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Vehicle type</label>
        <Select
          id="vehicle-type"
          value={data.vehicle_type}
          onChange={(v) => update('vehicle_type', v)}
          options={VEHICLE_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
        />
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          onClick={onBack}
          variant="secondary"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="submit"
          size="lg"
        >
          Next
        </Button>
      </div>
    </form>
  );
}

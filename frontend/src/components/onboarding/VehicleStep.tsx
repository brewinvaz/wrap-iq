'use client';

import { useState } from 'react';
import type { VehicleData } from '@/app/onboarding/[token]/page';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
      <h2 className="mb-1 text-[16px] font-semibold text-[#18181b]">Vehicle Information</h2>
      <p className="mb-5 text-[13px] text-[#60606a]">
        Enter a VIN to auto-fill, or fill in manually.
      </p>

      {/* VIN lookup */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">VIN</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={data.vin}
            onChange={(e) => update('vin', e.target.value.toUpperCase())}
            maxLength={17}
            className="flex-1 rounded-lg border border-[#e6e6eb] px-3 py-2 font-mono text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="1HGCM82633A123456"
          />
          <button
            type="button"
            onClick={handleVinDecode}
            disabled={vinLoading || data.vin.length < 17}
            className="rounded-lg border border-[#e6e6eb] bg-white px-4 py-2 text-[13px] font-medium text-[#18181b] transition-colors hover:bg-[#f8f8fa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vinLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-600" />
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
        <p className="mt-1.5 text-[12px] text-[#a8a8b4]">Optional — or fill in the fields below manually</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Year</label>
          <input
            type="text"
            value={data.year}
            onChange={(e) => update('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="2024"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Make</label>
          <input
            type="text"
            value={data.make}
            onChange={(e) => update('make', e.target.value)}
            className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Ford"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Model</label>
          <input
            type="text"
            value={data.model}
            onChange={(e) => update('model', e.target.value)}
            className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Transit"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Vehicle type</label>
        <select
          value={data.vehicle_type}
          onChange={(e) => update('vehicle_type', e.target.value)}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
          className="rounded-lg border border-[#e6e6eb] px-5 py-2.5 text-[13px] font-medium text-[#18181b] transition-colors hover:bg-[#f8f8fa]"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          Next
        </button>
      </div>
    </form>
  );
}

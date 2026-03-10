'use client';

import { useState } from 'react';

const presets = ['7D', '30D', '90D', 'YTD', 'Custom'] as const;

export type Preset = (typeof presets)[number];

interface DateRangeFilterProps {
  onChange?: (preset: Preset) => void;
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [active, setActive] = useState<Preset>('30D');

  function handleClick(preset: Preset) {
    setActive(preset);
    onChange?.(preset);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#e6e6eb] bg-white p-1">
      {presets.map((preset) => (
        <button
          key={preset}
          onClick={() => handleClick(preset)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === preset
              ? 'bg-[#18181b] text-white'
              : 'text-[#60606a] hover:bg-gray-50'
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

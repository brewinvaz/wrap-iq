'use client';

import { useState } from 'react';

interface QuickHoursProps {
  value: string;
  onChange: (value: string) => void;
}

const PRESETS = [
  { label: '15m', value: '0.25' },
  { label: '30m', value: '0.5' },
  { label: '1h', value: '1' },
  { label: '2h', value: '2' },
  { label: '4h', value: '4' },
  { label: '8h', value: '8' },
];

export default function QuickHours({ value, onChange }: QuickHoursProps) {
  const [showCustom, setShowCustom] = useState(false);

  const isPresetValue = PRESETS.some((p) => p.value === value);
  const isCustomActive = showCustom || (value !== '' && !isPresetValue);

  function handlePresetClick(presetValue: string) {
    setShowCustom(false);
    onChange(presetValue);
  }

  function handleCustomClick() {
    setShowCustom(true);
    // Keep current value if it's already custom, otherwise clear
    if (isPresetValue) {
      onChange('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === preset.value && !showCustom
                ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomClick}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            isCustomActive
              ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Custom
        </button>
      </div>
      {isCustomActive && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          min="0.25"
          step="0.25"
          className="mt-2 w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
      )}
    </div>
  );
}

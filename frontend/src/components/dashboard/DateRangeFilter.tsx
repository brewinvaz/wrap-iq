'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

const presets = ['7D', '30D', '90D', 'YTD', 'Custom'] as const;

export type Preset = (typeof presets)[number];

export interface CustomDateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;
}

interface DateRangeFilterProps {
  onChange?: (preset: Preset) => void;
  onCustomRange?: (range: CustomDateRange) => void;
}

export default function DateRangeFilter({ onChange, onCustomRange }: DateRangeFilterProps) {
  const [active, setActive] = useState<Preset>('30D');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    }
    if (showCustomPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomPicker]);

  function handleClick(preset: Preset) {
    setActive(preset);
    if (preset === 'Custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onChange?.(preset);
    }
  }

  function handleApply() {
    if (startDate && endDate) {
      onCustomRange?.({ startDate, endDate });
      setShowCustomPicker(false);
    }
  }

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-1">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => handleClick(preset)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active === preset
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Custom date range picker popover */}
      {showCustomPicker && (
        <div className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-4 shadow-lg">
          <p className="mb-3 text-xs font-medium text-[var(--text-secondary)]">Select date range</p>
          <div className="flex items-center gap-2">
            <div>
              <label htmlFor="custom-start" className="mb-1 block text-[10px] text-[var(--text-muted)]">
                Start
              </label>
              <input
                id="custom-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <span className="mt-4 text-xs text-[var(--text-muted)]">to</span>
            <div>
              <label htmlFor="custom-end" className="mb-1 block text-[10px] text-[var(--text-muted)]">
                End
              </label>
              <input
                id="custom-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomPicker(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!startDate || !endDate}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

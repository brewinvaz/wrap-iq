'use client';

import { useState, useRef, useEffect } from 'react';

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

      {/* Custom date range picker popover */}
      {showCustomPicker && (
        <div className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-[#e6e6eb] bg-white p-4 shadow-lg">
          <p className="mb-3 text-xs font-medium text-[#60606a]">Select date range</p>
          <div className="flex items-center gap-2">
            <div>
              <label htmlFor="custom-start" className="mb-1 block text-[10px] text-[#a8a8b4]">
                Start
              </label>
              <input
                id="custom-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                className="rounded-md border border-[#e6e6eb] px-2 py-1.5 text-xs text-[#18181b] outline-none focus:border-blue-500"
              />
            </div>
            <span className="mt-4 text-xs text-[#a8a8b4]">to</span>
            <div>
              <label htmlFor="custom-end" className="mb-1 block text-[10px] text-[#a8a8b4]">
                End
              </label>
              <input
                id="custom-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="rounded-md border border-[#e6e6eb] px-2 py-1.5 text-xs text-[#18181b] outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowCustomPicker(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!startDate || !endDate}
              className="rounded-md bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2d2d33] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

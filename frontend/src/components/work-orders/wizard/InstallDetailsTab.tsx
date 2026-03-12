'use client';

import DatePicker from '@/components/ui/DatePicker';
import type {
  InstallState,
  InstallLocation,
  InstallDifficulty,
} from './types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  data: InstallState;
  onChange: (data: InstallState) => void;
}

/* ------------------------------------------------------------------ */
/*  Toggle options                                                     */
/* ------------------------------------------------------------------ */

const LOCATION_OPTIONS: { value: InstallLocation; label: string }[] = [
  { value: 'in_shop', label: 'In Shop' },
  { value: 'on_site', label: 'On Site' },
];

const DIFFICULTY_OPTIONS: { value: InstallDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'standard', label: 'Standard' },
  { value: 'complex', label: 'Complex' },
];

const DIFFICULTY_COLORS: Record<InstallDifficulty, string> = {
  easy: 'bg-emerald-600 text-white',
  standard: 'bg-amber-500 text-white',
  complex: 'bg-red-600 text-white',
};

/* ------------------------------------------------------------------ */
/*  Shared style constants                                             */
/* ------------------------------------------------------------------ */

const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-[var(--text-primary)]';

const SECTION_HEADING = 'text-sm font-semibold text-[var(--text-primary)]';

const TOGGLE_INACTIVE =
  'rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors';

const TOGGLE_ACTIVE = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InstallDetailsTab({ data, onChange }: Props) {
  const update = <K extends keyof InstallState>(field: K, value: InstallState[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* ========== Install Location ========== */}
      <div>
        <h3 className={SECTION_HEADING}>Install Location</h3>
        <div className="mt-2 flex gap-2">
          {LOCATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('installLocation', opt.value)}
              className={
                data.installLocation === opt.value ? TOGGLE_ACTIVE : TOGGLE_INACTIVE
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== Install Difficulty ========== */}
      <div>
        <h3 className={SECTION_HEADING}>Install Difficulty</h3>
        <div className="mt-2 flex gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => {
            const isSelected = data.installDifficulty === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('installDifficulty', opt.value)}
                className={
                  isSelected
                    ? `rounded-lg px-4 py-2.5 text-sm ${DIFFICULTY_COLORS[opt.value]}`
                    : TOGGLE_INACTIVE
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== Install Dates ========== */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Install Start Date</label>
          <DatePicker
            value={data.installStartDate}
            onChange={(v) => update('installStartDate', v)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Install End Date</label>
          <DatePicker
            value={data.installEndDate}
            onChange={(v) => update('installEndDate', v)}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import type {
  WrapDetailsState,
  CoverageLevel,
  WindowCoverage,
  BumperCoverage,
} from './types';

interface Props {
  data: WrapDetailsState;
  onChange: (data: WrapDetailsState) => void;
  wrapCoverage: string;
}

const labelClass = 'mb-1.5 block text-sm font-medium text-[var(--text-primary)]';

const toggleInactive =
  'flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors';

const toggleActive =
  'flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white transition-colors';

const sectionHeadingClass =
  'flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]';

const MISC_ITEMS = ['Mirror Caps', 'Grill', 'Plastic Trim', '100% Paint Coverage'] as const;

const COVERAGE_LABELS: Record<CoverageLevel, string> = {
  no: 'None',
  partial: 'Partial',
  full: 'Full',
};

const WINDOW_LABELS: Record<WindowCoverage, string> = {
  no: 'None',
  solid_vinyl: 'Solid Vinyl',
  perforated_vinyl: 'Perforated',
};

const BUMPER_LABELS: Record<BumperCoverage, string> = {
  no: 'None',
  front: 'Front Only',
  back: 'Back Only',
  both: 'Front & Back',
};

function SectionDot() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)]">
      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
    </span>
  );
}

function InfoIcon() {
  return (
    <svg
      className="h-4 w-4 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export default function WrapDetailsTab({ data, onChange, wrapCoverage }: Props) {
  function update(patch: Partial<WrapDetailsState>) {
    onChange({ ...data, ...patch });
  }

  function toggleMiscItem(item: string) {
    const items = data.miscItems.includes(item)
      ? data.miscItems.filter((i) => i !== item)
      : [...data.miscItems, item];
    update({ miscItems: items });
  }

  const extrasCount = data.miscItems.length;

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
        <InfoIcon />
        {wrapCoverage === '' ? (
          <span>
            <strong>Vehicle Details Not Set</strong> — Wrap coverage not selected
          </span>
        ) : (
          <span>
            Current wrap coverage:{' '}
            <strong>
              {wrapCoverage === 'full'
                ? 'Full Wrap'
                : wrapCoverage === 'three_quarter'
                  ? '3/4 Wrap'
                  : wrapCoverage === 'half'
                    ? '1/2 Wrap'
                    : wrapCoverage === 'spot_graphics'
                      ? 'Spot Graphics'
                      : wrapCoverage}
            </strong>
          </span>
        )}
      </div>

      {/* Section heading */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Wrap Coverage Details
        </h3>
        <InfoIcon />
      </div>

      {/* Roof Coverage */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Roof Coverage
        </label>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['no', 'No Roof'],
              ['partial', 'Partial Roof'],
              ['full', 'Full Roof'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={data.roofCoverage === value ? toggleActive : toggleInactive}
              onClick={() => update({ roofCoverage: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Door Handles */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Door Handles
        </label>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['no', 'No Handles'],
              ['partial', 'Partial Handle'],
              ['full', 'Full Handle'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={data.doorHandles === value ? toggleActive : toggleInactive}
              onClick={() => update({ doorHandles: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Window Coverage */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Window Coverage
        </label>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['no', 'No Windows'],
              ['solid_vinyl', 'Solid Vinyl'],
              ['perforated_vinyl', 'Perforated'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={data.windowCoverage === value ? toggleActive : toggleInactive}
              onClick={() => update({ windowCoverage: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bumpers */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Bumpers
        </label>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['no', 'No Bumpers'],
              ['front', 'Front Only'],
              ['back', 'Back Only'],
              ['both', 'Front & Back'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={data.bumperCoverage === value ? toggleActive : toggleInactive}
              onClick={() => update({ bumperCoverage: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Elements */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Additional Elements
        </label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {MISC_ITEMS.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              <input
                type="checkbox"
                checked={data.miscItems.includes(item)}
                onChange={() => toggleMiscItem(item)}
                className="h-4 w-4 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      {/* Special Instructions */}
      <div>
        <label htmlFor="special-instructions" className={labelClass}>
          Special Instructions
        </label>
        <textarea
          id="special-instructions"
          value={data.specialInstructions}
          onChange={(e) => update({ specialInstructions: e.target.value })}
          placeholder="Add any special wrapping instructions, client preferences, or important notes for the production team..."
          rows={4}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Include any specific requirements, installation notes, or client preferences
        </p>
      </div>

      {/* Wrap Coverage Summary */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
        <h4 className="mb-2 text-sm font-semibold text-blue-400">Wrap Coverage Summary</h4>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-[var(--text-muted)]">Roof</span>
          <span className="text-[var(--text-primary)]">
            {COVERAGE_LABELS[data.roofCoverage]}
          </span>
          <span className="text-[var(--text-muted)]">Door Handles</span>
          <span className="text-[var(--text-primary)]">
            {COVERAGE_LABELS[data.doorHandles]}
          </span>
          <span className="text-[var(--text-muted)]">Windows</span>
          <span className="text-[var(--text-primary)]">
            {WINDOW_LABELS[data.windowCoverage]}
          </span>
          <span className="text-[var(--text-muted)]">Bumpers</span>
          <span className="text-[var(--text-primary)]">
            {BUMPER_LABELS[data.bumperCoverage]}
          </span>
          <span className="text-[var(--text-muted)]">Extras</span>
          <span className="text-[var(--text-primary)]">
            {extrasCount > 0 ? `${extrasCount} selected` : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}

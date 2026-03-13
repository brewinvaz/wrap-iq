'use client';

import { useState, useEffect } from 'react';
import Select from '@/components/ui/Select';
import { fetchEquipment } from '@/lib/api/equipment';
import type { Equipment } from '@/lib/api/equipment';
import type { ProductionState } from './types';
import {
  PRINT_MEDIA_OPTIONS,
  LAMINATE_OPTIONS,
  WINDOW_PERF_OPTIONS,
} from './types';

interface Props {
  data: ProductionState;
  onChange: (data: ProductionState) => void;
}

const sectionHeadingClass =
  'flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]';

const toggleInactive =
  'rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors';

const toggleActive =
  'rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white transition-colors';

const subLabelClass = 'mt-1 mb-2 text-xs text-[var(--text-muted)]';

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

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

function PrinterIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="14" width="12" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: build display labels from option arrays                    */
/* ------------------------------------------------------------------ */

function mediaLabel(value: string): string {
  if (value === '') return 'No Print Media';
  return value;
}

function laminateLabel(value: string): string {
  if (value === '') return 'No Laminate';
  return value;
}

function windowPerfLabel(value: string): string {
  if (value === '') return 'No Window Perf';
  return value;
}

/* ------------------------------------------------------------------ */
/*  Option grid component                                              */
/* ------------------------------------------------------------------ */

function OptionGrid({
  options,
  value,
  labelFn,
  onSelect,
}: {
  options: readonly string[];
  value: string;
  labelFn: (v: string) => string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {options.map((opt) => (
        <button
          key={opt || '__none__'}
          type="button"
          className={value === opt ? toggleActive : toggleInactive}
          onClick={() => onSelect(opt)}
        >
          {labelFn(opt)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ProductionTab({ data, onChange }: Props) {
  const [printers, setPrinters] = useState<Equipment[]>([]);
  const [laminators, setLaminators] = useState<Equipment[]>([]);
  const [plotters, setPlotters] = useState<Equipment[]>([]);

  useEffect(() => {
    async function loadEquipment() {
      const [p, l, c] = await Promise.all([
        fetchEquipment(undefined, 'printer', true),
        fetchEquipment(undefined, 'laminator', true),
        fetchEquipment(undefined, 'plotter', true),
      ]);
      setPrinters(p.items);
      setLaminators(l.items);
      setPlotters(c.items);
    }
    loadEquipment();
  }, []);

  function equipmentOptions(items: Equipment[]) {
    return [
      { value: '', label: 'None' },
      ...items.map((eq) => ({ value: eq.id, label: eq.name })),
    ];
  }

  function update(patch: Partial<ProductionState>) {
    onChange({ ...data, ...patch });
  }

  return (
    <div className="space-y-5">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Production Specifications
        </h3>
        <InfoIcon />
      </div>

      {/* ========== Printer ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <PrinterIcon />
          Printer
        </label>
        <div className="mt-2">
          <Select
            value={data.printerId}
            onChange={(val) => update({ printerId: val })}
            options={equipmentOptions(printers)}
          />
        </div>
      </div>

      {/* ========== Laminator ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <LayersIcon />
          Laminator
        </label>
        <div className="mt-2">
          <Select
            value={data.laminatorId}
            onChange={(val) => update({ laminatorId: val })}
            options={equipmentOptions(laminators)}
          />
        </div>
      </div>

      {/* ========== Plotter/Cutter ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <ScissorsIcon />
          Plotter/Cutter
        </label>
        <div className="mt-2">
          <Select
            value={data.plotterId}
            onChange={(val) => update({ plotterId: val })}
            options={equipmentOptions(plotters)}
          />
        </div>
      </div>

      {/* ========== Print Media ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <PlusIcon />
          Print Media
        </label>
        <p className={subLabelClass}>Media Brand/Type</p>
        <OptionGrid
          options={PRINT_MEDIA_OPTIONS}
          value={data.printMedia}
          labelFn={mediaLabel}
          onSelect={(v) => update({ printMedia: v })}
        />
      </div>

      {/* ========== Laminate ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Laminate
        </label>
        <p className={subLabelClass}>Laminate Type</p>
        <OptionGrid
          options={LAMINATE_OPTIONS}
          value={data.laminate}
          labelFn={laminateLabel}
          onSelect={(v) => update({ laminate: v })}
        />
      </div>

      {/* ========== Window Perforation ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          Window Perforation
        </label>
        <p className={subLabelClass}>Window Perf Type</p>
        <OptionGrid
          options={WINDOW_PERF_OPTIONS}
          value={data.windowPerf}
          labelFn={windowPerfLabel}
          onSelect={(v) => update({ windowPerf: v })}
        />
      </div>

      {/* ========== Production Notes ========== */}
      <div>
        <label htmlFor="production-notes" className={sectionHeadingClass}>
          <SectionDot />
          Production Notes
        </label>
        <textarea
          id="production-notes"
          value={data.productionNotes}
          onChange={(e) => update({ productionNotes: e.target.value })}
          placeholder="Add any special production instructions, material requirements, or important notes for the production team..."
          rows={4}
          className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
      </div>
    </div>
  );
}

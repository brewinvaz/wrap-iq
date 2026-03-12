'use client';

import { useState } from 'react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface JobChecklist {
  id: string;
  jobName: string;
  vehicle: string;
  date: string;
  status: 'in-progress' | 'completed' | 'not-started';
  items: ChecklistItem[];
}

const INITIAL_CHECKLISTS: JobChecklist[] = [
  {
    id: 'c1',
    jobName: 'Marcus Rivera — Full Body PPF',
    vehicle: '2024 BMW M4',
    date: 'Mar 10, 2026',
    status: 'in-progress',
    items: [
      { id: 'c1i1', label: 'Vehicle inspection & photo documentation (before)', checked: true },
      { id: 'c1i2', label: 'Surface wash & clay bar decontamination', checked: true },
      { id: 'c1i3', label: 'IPA wipe-down of all panels', checked: true },
      { id: 'c1i4', label: 'Film pre-cut and aligned on plotter', checked: false },
      { id: 'c1i5', label: 'Hood panel installed & squeegeed', checked: false },
      { id: 'c1i6', label: 'Front bumper installed & edges tucked', checked: false },
      { id: 'c1i7', label: 'Fenders & mirrors installed', checked: false },
      { id: 'c1i8', label: 'Final inspection & photo documentation (after)', checked: false },
    ],
  },
  {
    id: 'c2',
    jobName: 'David Park — Full Body PPF',
    vehicle: '2024 Porsche 911 GT3',
    date: 'Mar 11, 2026',
    status: 'not-started',
    items: [
      { id: 'c2i1', label: 'Vehicle inspection & photo documentation (before)', checked: false },
      { id: 'c2i2', label: 'Surface prep & decontamination', checked: false },
      { id: 'c2i3', label: 'Paint correction on impacted areas', checked: false },
      { id: 'c2i4', label: 'Film pre-cut on plotter', checked: false },
      { id: 'c2i5', label: 'Front clip installed (hood, bumper, fenders)', checked: false },
      { id: 'c2i6', label: 'Rocker panels & A-pillars installed', checked: false },
      { id: 'c2i7', label: 'Rear bumper & trunk lid installed', checked: false },
      { id: 'c2i8', label: 'Final inspection & photo documentation (after)', checked: false },
    ],
  },
  {
    id: 'c3',
    jobName: 'Elena Vasquez — Accent Package',
    vehicle: '2023 Mercedes G-Wagon',
    date: 'Mar 8, 2026',
    status: 'completed',
    items: [
      { id: 'c3i1', label: 'Vehicle inspection & photos', checked: true },
      { id: 'c3i2', label: 'Mirror caps cleaned & prepped', checked: true },
      { id: 'c3i3', label: 'Mirror cap film installed', checked: true },
      { id: 'c3i4', label: 'Door handle cups prepped', checked: true },
      { id: 'c3i5', label: 'Door handle cup film installed', checked: true },
      { id: 'c3i6', label: 'Final inspection & photos', checked: true },
    ],
  },
];

const STATUS_STYLES = {
  'in-progress': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  'not-started': { bg: 'bg-[var(--surface-app)]', text: 'text-[var(--text-secondary)]', label: 'Not Started' },
};

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<JobChecklist[]>(INITIAL_CHECKLISTS);

  function toggleItem(checklistId: string, itemId: string) {
    setChecklists((prev) =>
      prev.map((cl) => {
        if (cl.id !== checklistId) return cl;
        const updatedItems = cl.items.map((item) =>
          item.id === itemId ? { ...item, checked: !item.checked } : item,
        );
        const allChecked = updatedItems.every((i) => i.checked);
        const someChecked = updatedItems.some((i) => i.checked);
        return {
          ...cl,
          items: updatedItems,
          status: allChecked
            ? 'completed'
            : someChecked
              ? 'in-progress'
              : 'not-started',
        };
      }),
    );
  }

  const totalJobs = checklists.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Installation Checklists
            </h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {totalJobs} jobs
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const completed = checklist.items.filter((i) => i.checked).length;
            const total = checklist.items.length;
            const pct = Math.round((completed / total) * 100);
            const style = STATUS_STYLES[checklist.status];

            return (
              <div
                key={checklist.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]"
              >
                {/* Checklist header */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {checklist.jobName}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {checklist.vehicle} &middot; {checklist.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                        {pct}%
                      </p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">
                        {completed}/{total} done
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-app)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Checklist items */}
                <div className="border-t border-[var(--border)]">
                  {checklist.items.map((item, idx) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-overlay)] ${
                        idx < checklist.items.length - 1
                          ? 'border-b border-[var(--border)]'
                          : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(checklist.id, item.id)}
                        className="h-4 w-4 shrink-0 rounded border-[var(--border)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                      />
                      <span
                        className={`text-sm ${
                          item.checked
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

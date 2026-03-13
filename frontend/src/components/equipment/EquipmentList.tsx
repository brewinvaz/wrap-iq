'use client';

import type { Equipment } from '@/lib/api/equipment';
import { EQUIPMENT_TYPE_LABELS } from '@/lib/api/equipment';

interface Props {
  items: Equipment[];
  selectedId: string | null;
  onSelect: (eq: Equipment) => void;
}

export default function EquipmentList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-xs text-[var(--text-muted)]">No equipment matches your filters</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((eq) => (
        <button
          key={eq.id}
          type="button"
          onClick={() => onSelect(eq)}
          className={`w-full border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
            selectedId === eq.id
              ? 'border-l-[3px] border-l-[var(--accent-primary)] bg-[var(--surface-raised)]'
              : 'hover:bg-[var(--surface-raised)]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {eq.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                eq.isActive
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {eq.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {EQUIPMENT_TYPE_LABELS[eq.equipmentType] ?? eq.equipmentType}
            {eq.serialNumber ? ` \u00B7 ${eq.serialNumber}` : ''}
          </p>
        </button>
      ))}
    </div>
  );
}

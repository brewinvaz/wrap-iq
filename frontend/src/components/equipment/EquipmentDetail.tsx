'use client';

import type { Equipment } from '@/lib/api/equipment';
import { EQUIPMENT_TYPE_LABELS } from '@/lib/api/equipment';
import { Button } from '@/components/ui/Button';

interface Props {
  equipment: Equipment;
  onEdit: () => void;
  onDelete: () => void;
}

export default function EquipmentDetail({ equipment, onEdit, onDelete }: Props) {
  const addedDate = new Date(equipment.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {equipment.name}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Added {addedDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Equipment Type
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {EQUIPMENT_TYPE_LABELS[equipment.equipmentType] ?? equipment.equipmentType}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Serial Number
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {equipment.serialNumber || '\u2014'}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Status
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              equipment.isActive ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {equipment.isActive ? '\u25CF Active' : '\u25CF Inactive'}
          </p>
        </div>
      </div>
    </div>
  );
}

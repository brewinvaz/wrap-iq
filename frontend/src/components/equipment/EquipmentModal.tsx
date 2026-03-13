'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import type { Equipment, EquipmentType } from '@/lib/api/equipment';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    serialNumber?: string;
    equipmentType: EquipmentType;
    isActive: boolean;
  }) => Promise<void>;
  equipment?: Equipment | null;
}

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'printer', label: 'Printer' },
  { value: 'laminator', label: 'Laminator' },
  { value: 'plotter', label: 'Plotter' },
  { value: 'other', label: 'Other' },
];

export default function EquipmentModal({ isOpen, onClose, onSubmit, equipment }: Props) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('printer');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isEdit = !!equipment;

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setSerialNumber(equipment.serialNumber || '');
      setEquipmentType(equipment.equipmentType);
      setIsActive(equipment.isActive);
    } else {
      setName('');
      setSerialNumber('');
      setEquipmentType('printer');
      setIsActive(true);
    }
    setError(null);
  }, [equipment, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        serialNumber: serialNumber.trim() || undefined,
        equipmentType,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-modal-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="equipment-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {isEdit ? 'Edit Equipment' : 'Add Equipment'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            \u2715
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="eq-name" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Equipment Name *
              </label>
              <input
                id="eq-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter equipment name/model"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label htmlFor="eq-serial" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Serial Number
              </label>
              <input
                id="eq-serial"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter serial number (optional)"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Equipment Type *
              </label>
              <Select
                value={equipmentType}
                onChange={(val) => setEquipmentType(val as EquipmentType)}
                options={EQUIPMENT_TYPE_OPTIONS}
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Equipment is active and available
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Equipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

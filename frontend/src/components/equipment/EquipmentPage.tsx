'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import {
  fetchEquipment,
  fetchEquipmentStats,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '@/lib/api/equipment';
import type { Equipment, EquipmentType, EquipmentStats } from '@/lib/api/equipment';
import { ApiError } from '@/lib/api-client';
import EquipmentStatsBar from './EquipmentStats';
import EquipmentList from './EquipmentList';
import EquipmentDetail from './EquipmentDetail';
import EquipmentModal from './EquipmentModal';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'printer', label: 'Printer' },
  { value: 'laminator', label: 'Laminator' },
  { value: 'plotter', label: 'Plotter' },
  { value: 'other', label: 'Other' },
];

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to avoid stale closure in loadData
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected?.id ?? null;
  }, [selected]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [eqResult, statsResult] = await Promise.all([
        fetchEquipment(
          search || undefined,
          (typeFilter as EquipmentType) || undefined,
        ),
        fetchEquipmentStats(),
      ]);
      setItems(eqResult.items);
      setStats(statsResult);

      // Preserve selection if still in list, otherwise clear
      const currentSelectedId = selectedRef.current;
      if (currentSelectedId) {
        const stillExists = eqResult.items.find((e) => e.id === currentSelectedId);
        if (stillExists) {
          setSelected(stillExists);
        } else {
          setSelected(null);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load equipment');
      }
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchInput, setSearchInput] = useState('');

  function handleSearchChange(value: string) {
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  // Handlers
  function handleAdd() {
    setEditingEquipment(null);
    setModalOpen(true);
  }

  function handleEdit() {
    if (selected) {
      setEditingEquipment(selected);
      setModalOpen(true);
    }
  }

  function handleDeleteClick() {
    if (selected) {
      setDeleteTarget(selected);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEquipment(deleteTarget.id);
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete equipment');
    } finally {
      setDeleting(false);
    }
  }

  async function handleModalSubmit(data: {
    name: string;
    serialNumber?: string;
    equipmentType: EquipmentType;
    isActive: boolean;
  }) {
    if (editingEquipment) {
      const updated = await updateEquipment(editingEquipment.id, data);
      setSelected(updated);
    } else {
      const created = await createEquipment(data);
      setSelected(created);
    }
    await loadData();
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[var(--surface-app)]">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
        </header>
        <div className="flex flex-1">
          <div className="w-72 border-r border-[var(--border)] bg-[var(--surface-card)] p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mb-3 h-14 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            ))}
          </div>
          <div className="flex-1 p-6">
            <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface-app)]">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">My Equipment</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Manage printers, laminators, and other equipment
            </p>
          </div>
          <Button onClick={handleAdd}>
            + Add Equipment
          </Button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-400">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 text-red-300 underline hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: filters + list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-card)]">
          {/* Search & filter */}
          <div className="space-y-2 border-b border-[var(--border)] px-4 py-3">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search equipment..."
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_FILTER_OPTIONS}
              size="sm"
              placeholder="All Types"
            />
          </div>

          {/* Equipment list */}
          <EquipmentList
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>

        {/* Right panel: detail or empty state */}
        <div className="flex flex-1 flex-col">
          {selected ? (
            <EquipmentDetail
              equipment={selected}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center">
              <svg
                width="48"
                height="48"
                fill="none"
                viewBox="0 0 24 24"
                className="text-[var(--text-muted)]"
              >
                <path
                  d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
                {items.length === 0
                  ? 'No equipment yet'
                  : 'Select equipment to view details'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {items.length === 0
                  ? 'Add your first piece of equipment to get started'
                  : 'Choose an item from the list on the left'}
              </p>
              {items.length === 0 && (
                <Button className="mt-4" onClick={handleAdd}>
                  + Add Equipment
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && <EquipmentStatsBar stats={stats} />}

      {/* Add/Edit modal */}
      <EquipmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        equipment={editingEquipment}
      />

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Delete Equipment
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This
              action cannot be undone.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                className="flex-1"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteConfirm}
                className="flex-1"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

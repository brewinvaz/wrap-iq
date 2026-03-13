'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';

interface TaskPreset {
  id: string;
  organization_id: string;
  phase: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TaskPresetListResponse {
  items: TaskPreset[];
  total: number;
}

interface FormData {
  phase: string;
  name: string;
  sort_order: number;
}

const PHASES = [
  { value: 'design', label: 'Design', color: '#8b5cf6' },
  { value: 'production', label: 'Production', color: '#f59e0b' },
  { value: 'install', label: 'Install', color: '#22c55e' },
  { value: 'other', label: 'Other', color: '#3b82f6' },
];

const emptyForm: FormData = { phase: 'design', name: '', sort_order: 0 };

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-overlay)]" />
      </div>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--surface-card)]" />
        ))}
      </div>
    </div>
  );
}

export default function TaskPresetsPage() {
  const [presets, setPresets] = useState<TaskPreset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activePhase, setActivePhase] = useState('design');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TaskPresetListResponse>('/api/task-presets?limit=200');
      setPresets(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load task presets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const filteredPresets = presets
    .filter((p) => p.phase === activePhase)
    .sort((a, b) => a.sort_order - b.sort_order);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ phase: activePhase, name: '', sort_order: filteredPresets.length });
    setShowForm(true);
  };

  const openEditForm = (preset: TaskPreset) => {
    setEditingId(preset.id);
    setForm({ phase: preset.phase, name: preset.name, sort_order: preset.sort_order });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.patch(`/api/task-presets/${editingId}`, {
          name: form.name.trim(),
          sort_order: form.sort_order,
        });
      } else {
        await api.post('/api/task-presets', {
          phase: form.phase,
          name: form.name.trim(),
          sort_order: form.sort_order,
        });
      }
      cancelForm();
      fetchPresets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (preset: TaskPreset) => {
    setError(null);
    try {
      await api.patch(`/api/task-presets/${preset.id}`, {
        is_active: !preset.is_active,
      });
      fetchPresets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update preset');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/api/task-presets/${id}`);
      fetchPresets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete preset');
    }
  };

  if (loading && presets.length === 0) return <LoadingSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Task Presets</h1>
            <span className="rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-secondary)]">
              {total} presets
            </span>
          </div>
          {!showForm && (
            <Button onClick={openAddForm}>Add Preset</Button>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs text-red-400 underline hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Phase tabs */}
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1">
          {PHASES.map((p) => (
            <button
              key={p.value}
              onClick={() => setActivePhase(p.value)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activePhase === p.value
                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.label}
              <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                ({presets.filter((pr) => pr.phase === p.value).length})
              </span>
            </button>
          ))}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
              {editingId ? 'Edit Preset' : 'Add Preset'}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Task Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Surface Prep"
                  maxLength={255}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                  min={0}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-base)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={handleSubmit} loading={saving} disabled={!form.name.trim()}>
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="secondary" onClick={cancelForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Presets list */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold capitalize text-[var(--text-primary)]">
              {activePhase} Tasks
            </h2>
          </div>

          {filteredPresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <ListChecks className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No presets for this phase</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Add task presets so your team can quickly log time.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Task Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sort Order</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Active</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPresets.map((preset) => (
                  <tr
                    key={preset.id}
                    className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)] ${
                      !preset.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{preset.name}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{preset.sort_order}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(preset)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          preset.is_active ? 'bg-[var(--accent-primary)]' : 'bg-[var(--surface-raised)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            preset.is_active ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(preset)}
                          aria-label="Edit preset"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(preset.id)}
                          aria-label="Delete preset"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

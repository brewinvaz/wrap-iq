'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';

// --- Types ---

interface EstimateDefault {
  id: string;
  organization_id: string;
  job_type: string | null;
  wrap_coverage: string | null;
  vehicle_type: string | null;
  vehicle_count_min: number | null;
  vehicle_count_max: number | null;
  design_hours: number | null;
  production_hours: number | null;
  install_hours: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EstimateDefaultsListResponse {
  items: EstimateDefault[];
  total: number;
}

interface FormData {
  job_type: string | null;
  wrap_coverage: string | null;
  vehicle_type: string | null;
  vehicle_count_min: number | null;
  vehicle_count_max: number | null;
  design_hours: number | null;
  production_hours: number | null;
  install_hours: number | null;
  priority: number;
}

// --- Enum options ---

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'personal', label: 'Personal' },
];

const WRAP_COVERAGE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'full', label: 'Full' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'half', label: 'Half' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'spot_graphics', label: 'Spot Graphics' },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Van' },
  { value: 'utility_van', label: 'Utility Van' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'semi', label: 'Semi' },
  { value: 'trailer', label: 'Trailer' },
];

// --- Helpers ---

function displayEnum(value: string | null, options: { value: string; label: string }[]): string {
  if (!value) return '\u2014';
  const match = options.find((o) => o.value === value);
  return match ? match.label : value;
}

function displayNumber(value: number | null): string {
  if (value === null || value === undefined) return '\u2014';
  return String(value);
}

const emptyForm: FormData = {
  job_type: null,
  wrap_coverage: null,
  vehicle_type: null,
  vehicle_count_min: null,
  vehicle_count_max: null,
  design_hours: null,
  production_hours: null,
  install_hours: null,
  priority: 0,
};

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-64 animate-pulse rounded bg-[var(--surface-overlay)]" />
      </div>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-overlay)]" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border)] px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Select component ---

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Number input component ---

function FormNumber({
  label,
  value,
  onChange,
  step = 1,
  min,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={value === null ? '' : value}
        placeholder={placeholder ?? '\u2014'}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-base)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
      />
    </div>
  );
}

// --- Main page ---

export default function EstimateDefaultsPage() {
  const [rules, setRules] = useState<EstimateDefault[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EstimateDefaultsListResponse>('/api/estimate-defaults?limit=100');
      setRules(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load estimate defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEditForm = (rule: EstimateDefault) => {
    setEditingId(rule.id);
    setForm({
      job_type: rule.job_type,
      wrap_coverage: rule.wrap_coverage,
      vehicle_type: rule.vehicle_type,
      vehicle_count_min: rule.vehicle_count_min,
      vehicle_count_max: rule.vehicle_count_max,
      design_hours: rule.design_hours,
      production_hours: rule.production_hours,
      install_hours: rule.install_hours,
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        job_type: form.job_type || null,
        wrap_coverage: form.wrap_coverage || null,
        vehicle_type: form.vehicle_type || null,
        vehicle_count_min: form.vehicle_count_min,
        vehicle_count_max: form.vehicle_count_max,
        design_hours: form.design_hours,
        production_hours: form.production_hours,
        install_hours: form.install_hours,
        priority: form.priority,
      };

      if (editingId) {
        await api.patch(`/api/estimate-defaults/${editingId}`, payload);
      } else {
        await api.post('/api/estimate-defaults', payload);
      }

      cancelForm();
      fetchRules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/api/estimate-defaults/${id}`);
      fetchRules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete rule');
    }
  };

  const updateForm = (field: keyof FormData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading && rules.length === 0) return <LoadingSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] text-[var(--text-primary)]">Estimate Defaults</h1>
            <span className="rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-secondary)]">
              {total} rules
            </span>
          </div>
          {!showForm && (
            <Button onClick={openAddForm}>Add Rule</Button>
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
        {/* Add/Edit Form */}
        {showForm && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
              {editingId ? 'Edit Rule' : 'Add Rule'}
            </h2>

            <div className="grid grid-cols-3 gap-4">
              <FormSelect
                label="Job Type"
                value={form.job_type || ''}
                options={JOB_TYPE_OPTIONS}
                onChange={(v) => updateForm('job_type', v || null)}
              />
              <FormSelect
                label="Wrap Coverage"
                value={form.wrap_coverage || ''}
                options={WRAP_COVERAGE_OPTIONS}
                onChange={(v) => updateForm('wrap_coverage', v || null)}
              />
              <FormSelect
                label="Vehicle Type"
                value={form.vehicle_type || ''}
                options={VEHICLE_TYPE_OPTIONS}
                onChange={(v) => updateForm('vehicle_type', v || null)}
              />
            </div>

            <div className="mt-4 grid grid-cols-6 gap-4">
              <FormNumber
                label="Vehicle Count Min"
                value={form.vehicle_count_min}
                onChange={(v) => updateForm('vehicle_count_min', v)}
                min={0}
              />
              <FormNumber
                label="Vehicle Count Max"
                value={form.vehicle_count_max}
                onChange={(v) => updateForm('vehicle_count_max', v)}
                min={0}
              />
              <FormNumber
                label="Priority"
                value={form.priority}
                onChange={(v) => updateForm('priority', v ?? 0)}
                min={0}
              />
              <FormNumber
                label="Design Hours"
                value={form.design_hours}
                onChange={(v) => updateForm('design_hours', v)}
                step={0.25}
                min={0}
              />
              <FormNumber
                label="Production Hours"
                value={form.production_hours}
                onChange={(v) => updateForm('production_hours', v)}
                step={0.25}
                min={0}
              />
              <FormNumber
                label="Install Hours"
                value={form.install_hours}
                onChange={(v) => updateForm('install_hours', v)}
                step={0.25}
                min={0}
              />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button onClick={handleSubmit} loading={saving}>
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="secondary" onClick={cancelForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Rules Table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">All Rules</h2>
          </div>

          {rules.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)]">
                <Settings2 className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No estimate defaults yet</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Add rules to automatically populate hour estimates on new work orders.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Job Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Wrap Coverage</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Vehicle Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Vehicle Count</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Design Hrs</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Production Hrs</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Install Hrs</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Priority</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-raised)]">
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {displayEnum(rule.job_type, JOB_TYPE_OPTIONS)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {displayEnum(rule.wrap_coverage, WRAP_COVERAGE_OPTIONS)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {displayEnum(rule.vehicle_type, VEHICLE_TYPE_OPTIONS)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                      {rule.vehicle_count_min !== null || rule.vehicle_count_max !== null
                        ? `${displayNumber(rule.vehicle_count_min)}–${displayNumber(rule.vehicle_count_max)}`
                        : '\u2014'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">
                      {displayNumber(rule.design_hours)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">
                      {displayNumber(rule.production_hours)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--text-primary)]">
                      {displayNumber(rule.install_hours)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                      {rule.priority}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(rule)}
                          aria-label="Edit rule"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rule.id)}
                          aria-label="Delete rule"
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

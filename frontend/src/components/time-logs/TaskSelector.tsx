'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface TaskPreset {
  id: string;
  name: string;
  sort_order: number;
}

interface TaskSelectorProps {
  phase: string;
  value: string;
  onChange: (value: string) => void;
}

export default function TaskSelector({ phase, value, onChange }: TaskSelectorProps) {
  const [presetsByPhase, setPresetsByPhase] = useState<Record<string, TaskPreset[]>>({});
  const [loading, setLoading] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [lastPhase, setLastPhase] = useState(phase);

  // Reset showOther when phase changes — via state comparison, not effect
  if (phase !== lastPhase) {
    setLastPhase(phase);
    setShowOther(false);
  }

  const fetchPresets = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const data = await api.get<{ items: TaskPreset[] }>(
        `/api/task-presets?phase=${encodeURIComponent(p)}`
      );
      const sorted = data.items.sort((a, b) => a.sort_order - b.sort_order);
      setPresetsByPhase((prev) => ({ ...prev, [p]: sorted }));
    } catch {
      setPresetsByPhase((prev) => ({ ...prev, [p]: [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!phase || presetsByPhase[phase]) return;
    fetchPresets(phase);
  }, [phase, presetsByPhase, fetchPresets]);

  const presets = phase ? (presetsByPhase[phase] ?? []) : [];

  if (!phase) {
    return (
      <p className="text-sm text-[var(--text-muted)]">Select a phase first</p>
    );
  }

  if (loading && presets.length === 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-full bg-[var(--surface-raised)]"
          />
        ))}
      </div>
    );
  }

  const isPresetValue = presets.some((p) => p.name === value);
  const isOtherActive = showOther || (value !== '' && !isPresetValue);

  function handlePresetClick(name: string) {
    setShowOther(false);
    onChange(name);
  }

  function handleOtherClick() {
    setShowOther(true);
    if (isPresetValue) {
      onChange('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePresetClick(preset.name)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === preset.name && !showOther
                ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {preset.name}
          </button>
        ))}
        <button
          type="button"
          onClick={handleOtherClick}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            isOtherActive
              ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          + Other
        </button>
      </div>
      {isOtherActive && (
        <input
          type="text"
          value={isPresetValue ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom task..."
          maxLength={255}
          className="mt-2 w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
      )}
    </div>
  );
}

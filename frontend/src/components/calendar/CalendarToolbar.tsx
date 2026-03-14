'use client';

import { Installer } from '@/lib/types';

type Phase = 'design' | 'production' | 'install';
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';
type ColorBy = 'phase' | 'installer';

interface CalendarToolbarProps {
  activePhases: Set<Phase>;
  onTogglePhase: (phase: Phase) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  colorBy: ColorBy;
  onColorByChange: (colorBy: ColorBy) => void;
  installers: Installer[];
  activeInstallers: Set<string>;
  onToggleInstaller: (id: string) => void;
  isListView: boolean;
  onToggleListView: () => void;
}

const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: 'design', label: 'Design', color: 'var(--phase-design)' },
  { key: 'production', label: 'Production', color: 'var(--phase-production)' },
  { key: 'install', label: 'Install', color: 'var(--phase-install)' },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export default function CalendarToolbar({
  activePhases,
  onTogglePhase,
  statusFilter,
  onStatusChange,
  colorBy,
  onColorByChange,
  installers,
  activeInstallers,
  onToggleInstaller,
  isListView,
  onToggleListView,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-2.5 backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Phase:</span>
      <div className="flex gap-1.5">
        {PHASES.map((p) => {
          const isActive = activePhases.has(p.key);
          return (
            <button
              key={p.key}
              onClick={() => onTogglePhase(p.key)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'border border-current'
                  : 'border border-transparent opacity-40'
              }`}
              style={{
                color: p.color,
                backgroundColor: isActive ? `color-mix(in srgb, ${p.color} 12%, transparent)` : 'transparent',
                borderColor: isActive ? `color-mix(in srgb, ${p.color} 20%, transparent)` : 'transparent',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="h-4 w-px bg-[var(--glass-border)]" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status:</span>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      <div className="h-4 w-px bg-[var(--glass-border)]" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Color:</span>
      <select
        value={colorBy}
        onChange={(e) => onColorByChange(e.target.value as ColorBy)}
        className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
      >
        <option value="phase">Phase</option>
        <option value="installer">Installer</option>
      </select>
      <div className="h-4 w-px bg-[var(--glass-border)]" />
      <button
        onClick={onToggleListView}
        className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          isListView
            ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'
        }`}
      >
        List
      </button>
      {colorBy === 'installer' && installers.length > 0 && (
        <>
          <div className="h-4 w-px bg-[var(--glass-border)]" />
          <div className="flex flex-wrap gap-1.5">
            {installers.map((inst) => {
              const isActive = activeInstallers.has(inst.id);
              return (
                <button
                  key={inst.id}
                  onClick={() => onToggleInstaller(inst.id)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-40'
                  }`}
                  style={{
                    backgroundColor: isActive ? `${inst.color}1a` : 'transparent',
                    border: `1px solid ${isActive ? `${inst.color}33` : 'transparent'}`,
                    color: inst.color,
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white"
                    style={{ backgroundColor: inst.color }}
                  >
                    {inst.initials}
                  </span>
                  {inst.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

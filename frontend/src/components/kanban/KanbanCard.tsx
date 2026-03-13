'use client';

import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import { ProjectCard } from '@/lib/types';

const priorityBadgeStyles: Record<string, { bg: string; label: string }> = {
  high: { bg: 'bg-rose-500/20 text-rose-700 dark:text-rose-500', label: 'High' },
  medium: { bg: 'bg-amber-500/20 text-amber-700 dark:text-amber-500', label: 'Medium' },
  low: { bg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-500', label: 'Low' },
};

const tagStyles: Record<string, { bg: string; text: string }> = {
  'full-wrap': { bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', text: 'Full Wrap' },
  partial: { bg: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', text: 'Partial' },
  commercial: { bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', text: 'Commercial' },
  fleet: { bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', text: 'Fleet' },
  rush: { bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400', text: 'Rush' },
  design: { bg: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', text: 'Design' },
  print: { bg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', text: 'Print' },
  install: { bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', text: 'Install' },
};


function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface KanbanCardProps {
  card: ProjectCard;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  isPending?: boolean;
}

export default function KanbanCard({ card, onDragStart, isPending }: KanbanCardProps) {
  const router = useRouter();
  const completedTasks = card.tasks?.filter((t) => t.done).length ?? 0;
  const totalTasks = card.tasks?.length ?? 0;

  // Title fallback: client → vehicle → WO number
  const title = card.client || card.vehicle || card.name;
  // Show vehicle line only if client is the title and vehicle exists
  const showVehicle = !!card.client && !!card.vehicle;

  return (
    <div
      draggable={!isPending}
      onDragStart={(e) => {
        if (isPending) {
          e.preventDefault();
          return;
        }
        onDragStart(e, card.id);
      }}
      onClick={() => router.push(`/dashboard/projects/${card.workOrderId ?? card.id}`)}
      className={`group relative min-h-[140px] flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3.5 shadow-[0_1px_4px_rgba(0,0,0,.06)] transition-all duration-200 ${
        isPending
          ? 'cursor-default opacity-70'
          : 'cursor-grab hover:-translate-y-0.5 hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)] active:cursor-grabbing'
      }`}
    >
      {/* Pending status change indicator */}
      {isPending && (
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <div className="h-0.5 w-full animate-pulse rounded-t-lg bg-[var(--accent-primary)]" />
        </div>
      )}
      {/* Header: WO ID + Priority badge */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs tracking-wide text-[var(--text-muted)]">{card.id}</span>
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityBadgeStyles[card.priority].bg}`}>
          {priorityBadgeStyles[card.priority].label}
        </span>
      </div>

      {/* Title */}
      <h4 className="mb-1 text-[15px] font-semibold text-[var(--text-primary)]">{title}</h4>

      {/* Vehicle (only when client is title and vehicle exists) */}
      {showVehicle && (
        <p data-testid="vehicle-line" className="mb-2.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25M3.375 14.25V6.375c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v7.875m6.75 0v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3.375" />
          </svg>
          {card.vehicle}
        </p>
      )}

      {/* Tags */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {card.tags.map((tag) => {
          const style = tagStyles[tag];
          return (
            <span
              key={tag}
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg}`}
            >
              {style.text}
            </span>
          );
        })}
      </div>

      {/* Progress bar */}
      {card.progress !== undefined && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">Progress</span>
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{card.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{ width: `${card.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks */}
      {card.tasks && card.tasks.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1">
            <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] text-[var(--text-muted)]">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <div className="space-y-1">
            {card.tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                    task.done
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                      : 'border-[var(--border)] bg-[var(--surface-card)]'
                  }`}
                >
                  {task.done && (
                    <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-[11px] ${
                    task.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {task.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Value, Date, Team */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2.5">
        <div className="flex items-center gap-3">
          {card.value > 0 && (
            <span data-testid="card-value" className="text-xs font-semibold font-mono text-[var(--text-primary)]">
              {formatCurrency(card.value)}
            </span>
          )}
          <span className="text-[11px] text-[var(--text-muted)]">{formatDate(card.date)}</span>
        </div>
        <div className="flex -space-x-1.5">
          {card.team.map((member) => (
            <div
              key={member.initials}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface-card)] text-[9px] font-semibold text-white"
              style={{ backgroundColor: member.color }}
              title={member.initials}
            >
              {member.initials}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

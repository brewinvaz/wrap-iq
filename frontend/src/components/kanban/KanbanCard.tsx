'use client';

import { useRouter } from 'next/navigation';
import { ProjectCard } from '@/lib/types';

const priorityColors: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const tagStyles: Record<string, { bg: string; text: string }> = {
  'full-wrap': { bg: 'bg-blue-50 text-blue-700', text: 'Full Wrap' },
  partial: { bg: 'bg-violet-50 text-violet-700', text: 'Partial' },
  commercial: { bg: 'bg-amber-50 text-amber-700', text: 'Commercial' },
  fleet: { bg: 'bg-emerald-50 text-emerald-700', text: 'Fleet' },
  rush: { bg: 'bg-rose-50 text-rose-700', text: 'Rush' },
  design: { bg: 'bg-orange-50 text-orange-700', text: 'Design' },
  print: { bg: 'bg-cyan-50 text-cyan-700', text: 'Print' },
  install: { bg: 'bg-indigo-50 text-indigo-700', text: 'Install' },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface KanbanCardProps {
  card: ProjectCard;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  onAdvance?: (cardId: string) => void;
  isPending?: boolean;
}

export default function KanbanCard({ card, onDragStart, onAdvance, isPending }: KanbanCardProps) {
  const router = useRouter();
  const completedTasks = card.tasks?.filter((t) => t.done).length ?? 0;
  const totalTasks = card.tasks?.length ?? 0;

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
      onClick={() => router.push(`/dashboard/projects/${card.id}`)}
      className={`group relative rounded-lg border border-[#e6e6eb] bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,.06)] transition-all duration-200 ${
        isPending
          ? 'cursor-default opacity-70'
          : 'cursor-grab hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,.1)] active:cursor-grabbing'
      }`}
    >
      {/* Pending status change indicator */}
      {isPending && (
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <div className="h-0.5 w-full animate-pulse rounded-t-lg bg-blue-400" />
        </div>
      )}
      {/* Header: ID + Priority */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs tracking-wide text-[#a8a8b4]">{card.id}</span>
        <span
          className={`inline-block h-2 w-2 rounded-full ${priorityColors[card.priority]}`}
          title={`${card.priority} priority`}
        />
      </div>

      {/* Name */}
      <h4 className="mb-1 text-sm font-semibold text-[#18181b]">{card.name}</h4>

      {/* Vehicle */}
      <p className="mb-2.5 text-xs text-[#60606a]">{card.vehicle}</p>

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
            <span className="text-[10px] font-medium text-[#60606a]">Progress</span>
            <span className="text-[10px] font-medium text-[#60606a]">{card.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${card.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks */}
      {card.tasks && card.tasks.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1">
            <svg className="h-3 w-3 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] text-[#a8a8b4]">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <div className="space-y-1">
            {card.tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                    task.done
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-[#e6e6eb] bg-white'
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
                    task.done ? 'text-[#a8a8b4] line-through' : 'text-[#60606a]'
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
      <div className="flex items-center justify-between border-t border-[#e6e6eb] pt-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#18181b]">{formatCurrency(card.value)}</span>
          <span className="text-[11px] text-[#a8a8b4]">{formatDate(card.date)}</span>
        </div>
        <div className="flex -space-x-1.5">
          {card.team.map((member) => (
            <div
              key={member.initials}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white"
              style={{ backgroundColor: member.color }}
              title={member.initials}
            >
              {member.initials}
            </div>
          ))}
        </div>
      </div>

      {/* Advance button */}
      {onAdvance && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isPending) onAdvance(card.id);
          }}
          disabled={isPending}
          className={`mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border border-[#e6e6eb] bg-gray-50 py-1.5 text-[11px] font-medium text-[#60606a] transition-colors ${
            isPending
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600'
          }`}
        >
          Advance to next stage
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

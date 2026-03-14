'use client';

import DataTable, { Column } from '@/components/ui/DataTable';
import { CalendarEvent } from '@/lib/types';

interface ListViewProps {
  events: CalendarEvent[];
}

const PHASE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  design: { bg: 'rgba(6,182,212,0.12)', text: 'var(--phase-design)' },
  production: { bg: 'rgba(59,130,246,0.12)', text: 'var(--phase-production)' },
  install: { bg: 'rgba(16,185,129,0.12)', text: 'var(--phase-install)' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'rgba(244,63,94,0.12)', text: '#f43f5e' },
  medium: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  low: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const columns: Column<CalendarEvent>[] = [
  {
    key: 'jobNumber',
    header: 'Job #',
    render: (row) => <span className="font-medium text-[var(--text-primary)]">{row.jobNumber}</span>,
  },
  {
    key: 'clientName',
    header: 'Client',
    render: (row) => <span className="text-[var(--text-secondary)]">{row.clientName}</span>,
  },
  {
    key: 'vehicle',
    header: 'Vehicle',
    render: (row) => <span className="text-[var(--text-secondary)]">{row.vehicle}</span>,
  },
  {
    key: 'phase',
    header: 'Phase',
    render: (row) => {
      const c = PHASE_BADGE_COLORS[row.phase];
      return <Badge label={row.phase} bg={c.bg} text={c.text} />;
    },
  },
  {
    key: 'priority',
    header: 'Priority',
    render: (row) => {
      const c = PRIORITY_COLORS[row.priority];
      return <Badge label={row.priority} bg={c.bg} text={c.text} />;
    },
  },
  {
    key: 'date',
    header: 'Scheduled',
    render: (row) => <span className="text-[var(--text-secondary)]">{formatDate(row.date)}</span>,
  },
  {
    key: 'dueDate',
    header: 'Due',
    render: (row) => (
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-secondary)]">{formatDate(row.dueDate)}</span>
        {row.isOverdue && (
          <span className="rounded-sm bg-[rgba(244,63,94,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#f43f5e]">
            OVERDUE
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
        {row.status}
      </span>
    ),
  },
];

export default function ListView({ events }: ListViewProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <DataTable
        columns={columns}
        data={events}
        rowKey={(row) => row.id}
        stickyHeader
        emptyState={
          <p className="text-sm text-[var(--text-muted)]">No jobs to display</p>
        }
      />
    </div>
  );
}

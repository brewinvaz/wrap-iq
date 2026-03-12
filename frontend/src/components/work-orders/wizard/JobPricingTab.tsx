'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import type { JobPricingState } from './types';

interface Client {
  id: string;
  name: string;
}

interface Props {
  data: JobPricingState;
  onChange: (data: JobPricingState) => void;
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]';

const labelClass = 'mb-1.5 block text-sm font-medium text-[var(--text-primary)]';

const toggleInactive =
  'rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]';

const toggleActive = 'rounded-lg bg-blue-600 px-4 py-2 text-sm text-white';

export default function JobPricingTab({ data, onChange }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: { id: string; name: string }[] }>('/api/clients?limit=500')
      .then((res) => {
        if (!cancelled) setClients(res.items);
      })
      .catch(() => {
        /* clients will remain empty */
      })
      .finally(() => {
        if (!cancelled) setIsLoadingClients(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch: Partial<JobPricingState>) {
    onChange({ ...data, ...patch });
  }

  return (
    <div className="space-y-5">
      {/* Job Type */}
      <div>
        <label className={labelClass}>Job Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={data.jobType === 'personal' ? toggleActive : toggleInactive}
            onClick={() => update({ jobType: 'personal' })}
          >
            Personal
          </button>
          <button
            type="button"
            className={data.jobType === 'commercial' ? toggleActive : toggleInactive}
            onClick={() => update({ jobType: 'commercial' })}
          >
            Commercial
          </button>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className={labelClass}>Priority</label>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map((level) => {
            const colorMap = {
              low: 'rounded-lg px-4 py-2 text-sm',
              medium: 'rounded-lg px-4 py-2 text-sm',
              high: 'rounded-lg px-4 py-2 text-sm',
            };
            const activeColorMap: Record<string, string> = {
              low: 'rounded-lg bg-green-600 px-4 py-2 text-sm text-white',
              medium: 'rounded-lg bg-yellow-600 px-4 py-2 text-sm text-white',
              high: 'rounded-lg bg-red-600 px-4 py-2 text-sm text-white',
            };
            return (
              <button
                key={level}
                type="button"
                className={
                  data.priority === level
                    ? activeColorMap[level]
                    : `${colorMap[level]} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]`
                }
                onClick={() => update({ priority: level })}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Job Value */}
      <div>
        <label htmlFor="job-value" className={labelClass}>
          Job Value ($)
        </label>
        <input
          id="job-value"
          type="number"
          min={0}
          step="0.01"
          value={data.jobValue}
          onChange={(e) =>
            update({ jobValue: e.target.value === '' ? '' : Number(e.target.value) })
          }
          placeholder="0.00"
          className={inputClass}
        />
      </div>

      {/* Date In / Est. Completion */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="date-in" className={labelClass}>
            Date In
          </label>
          <DatePicker
            id="date-in"
            value={data.dateIn}
            onChange={(v) => update({ dateIn: v })}
          />
        </div>
        <div>
          <label htmlFor="estimated-completion" className={labelClass}>
            Est. Completion
          </label>
          <DatePicker
            id="estimated-completion"
            value={data.estimatedCompletionDate}
            onChange={(v) => update({ estimatedCompletionDate: v })}
          />
        </div>
      </div>

      {/* Client */}
      <div>
        <label htmlFor="client-id" className={labelClass}>
          Client
        </label>
        <Select
          id="client-id"
          value={data.clientId}
          onChange={(v) => update({ clientId: v })}
          disabled={isLoadingClients}
          placeholder={
            isLoadingClients ? 'Loading clients...' : 'Select a client (optional)'
          }
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      {/* Internal Notes */}
      <div>
        <label htmlFor="internal-notes" className={labelClass}>
          Internal Notes
        </label>
        <textarea
          id="internal-notes"
          value={data.internalNotes}
          onChange={(e) => update({ internalNotes: e.target.value })}
          placeholder="Optional notes..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}

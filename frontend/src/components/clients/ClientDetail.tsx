'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-700',
  Repeat: 'bg-emerald-100 text-emerald-700',
  Fleet: 'bg-blue-100 text-blue-700',
  New: 'bg-violet-100 text-violet-700',
};

const statusStyles: Record<string, { dot: string; text: string }> = {
  completed: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
  'in-progress': { dot: 'bg-blue-500', text: 'text-blue-700' },
  scheduled: { dot: 'bg-amber-500', text: 'text-amber-700' },
};

function CardHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 font-[family-name:var(--font-dm-mono)] text-xs font-medium uppercase tracking-wide text-gray-400">
      {title}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="truncate text-right text-sm font-medium text-[#18181b]">{value}</span>
    </div>
  );
}

interface ClientDetailProps {
  client: Client;
}

export default function ClientDetail({ client }: ClientDetailProps) {
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reset notes when the selected client changes
  const [prevClientId, setPrevClientId] = useState(client.id);
  if (client.id !== prevClientId) {
    setPrevClientId(client.id);
    setNotes(client.notes ?? '');
    setFeedback(null);
  }

  const isDirty = notes !== (client.notes ?? '');

  async function handleSaveNotes() {
    setSaving(true);
    setFeedback(null);
    try {
      await api.patch(`/api/clients/${client.id}`, { notes });
      setFeedback({ type: 'success', message: 'Notes saved' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save notes';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f4f6]">
      {/* Header */}
      <div className="border-b border-[#e6e6eb] bg-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#18181b]">{client.name}</h1>
              <span
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-dm-mono)] text-[10px] font-medium uppercase ${
                  client.type === 'business'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                {client.type}
              </span>
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tagColors[tag] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-1 font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
              Client since {new Date(client.joinedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {client.referralSource && <> &middot; Source: {client.referralSource}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#18181b] shadow-sm transition-colors hover:bg-gray-50">
              Edit
            </button>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
              Email
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Info cards grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <CardHeader title="Contact Info" />
            <InfoRow label="Email" value={client.email} />
            <InfoRow label="Phone" value={client.phone} />
            {client.address && <InfoRow label="Address" value={client.address} />}
            {client.primaryContact && (
              <InfoRow label="Primary Contact" value={client.primaryContact} />
            )}
          </div>

          {/* Account Summary */}
          <div className="rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <CardHeader title="Account Summary" />
            <InfoRow label="Total Projects" value={String(client.projectCount)} />
            <InfoRow
              label="Total Spent"
              value={formatCurrency(client.totalSpent)}
            />
            {client.lastProject && (
              <InfoRow
                label="Last Project"
                value={new Date(client.lastProject).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />
            )}
            <InfoRow
              label="Joined"
              value={new Date(client.joinedDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          </div>
        </div>

        {/* Business Contacts */}
        {client.type === 'business' && client.contacts && client.contacts.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <CardHeader title="Contacts" />
            <div className="divide-y divide-gray-100">
              {client.contacts.map((contact) => (
                <div key={contact.email} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-[#18181b]">{contact.name}</p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
                      {contact.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{contact.email}</p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
                      {contact.phone}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicles */}
        {client.vehicles.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <CardHeader title="Tracked Vehicles" />
            <div className="divide-y divide-gray-100">
              {client.vehicles.map((vehicle) => (
                <div key={vehicle.vin} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-[#18181b]">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
                      VIN: {vehicle.vin}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project History */}
        {client.projects.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
            <CardHeader title="Project History" />
            <div className="divide-y divide-gray-100">
              {client.projects.map((project) => {
                const style = statusStyles[project.status] ?? statusStyles.completed;
                return (
                  <div key={project.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <div>
                        <p className="text-sm font-medium text-[#18181b]">{project.name}</p>
                        <p className="font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
                          {new Date(project.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#18181b]">
                        ${project.value.toLocaleString()}
                      </p>
                      <p className={`font-[family-name:var(--font-dm-mono)] text-[10px] font-medium uppercase ${style.text}`}>
                        {project.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-6 rounded-xl border border-[#e6e6eb] bg-white p-5 shadow-sm">
          <CardHeader title="Notes" />
          <textarea
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-[#18181b] placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            rows={4}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setFeedback(null);
            }}
            placeholder="Add notes about this client..."
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={handleSaveNotes}
              disabled={saving || !isDirty}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
            {feedback && (
              <span
                className={`text-sm font-medium ${
                  feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {feedback.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

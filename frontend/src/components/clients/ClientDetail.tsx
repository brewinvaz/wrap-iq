'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-500/10 text-amber-400',
  Repeat: 'bg-emerald-500/10 text-emerald-400',
  Fleet: 'bg-blue-500/10 text-blue-400',
  New: 'bg-violet-500/10 text-violet-400',
};

const statusStyles: Record<string, { dot: string; text: string }> = {
  completed: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  'in-progress': { dot: 'bg-blue-500', text: 'text-blue-400' },
  scheduled: { dot: 'bg-amber-500', text: 'text-amber-400' },
};

function CardHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 font-[family-name:var(--font-dm-mono)] text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
      {title}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="truncate text-right text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

interface ClientDetailProps {
  client: Client;
  onClientUpdated?: (updatedClient: Client) => void;
}

export default function ClientDetail({ client, onClientUpdated }: ClientDetailProps) {
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editEmail, setEditEmail] = useState(client.email);
  const [editPhone, setEditPhone] = useState(client.phone);
  const [editAddress, setEditAddress] = useState(client.address ?? '');
  const [editSaving, setEditSaving] = useState(false);

  // Reset notes when the selected client changes
  const [prevClientId, setPrevClientId] = useState(client.id);
  if (client.id !== prevClientId) {
    setPrevClientId(client.id);
    setNotes(client.notes ?? '');
    setFeedback(null);
    setIsEditing(false);
    setEditName(client.name);
    setEditEmail(client.email);
    setEditPhone(client.phone);
    setEditAddress(client.address ?? '');
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

  function handleStartEdit() {
    setEditName(client.name);
    setEditEmail(client.email);
    setEditPhone(client.phone);
    setEditAddress(client.address ?? '');
    setIsEditing(true);
    setFeedback(null);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFeedback(null);
  }

  async function handleSaveEdit() {
    setEditSaving(true);
    setFeedback(null);
    try {
      await api.patch(`/api/clients/${client.id}`, {
        name: editName,
        email: editEmail || null,
        phone: editPhone || null,
        address: editAddress || null,
      });
      setFeedback({ type: 'success', message: 'Client updated' });
      setIsEditing(false);
      if (onClientUpdated) {
        onClientUpdated({
          ...client,
          name: editName,
          email: editEmail,
          phone: editPhone,
          address: editAddress || undefined,
        });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update client';
      setFeedback({ type: 'error', message });
    } finally {
      setEditSaving(false);
    }
  }

  function handleEmail() {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-app)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-card)] px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">{client.name}</h1>
              <span
                className={`rounded px-2 py-0.5 font-[family-name:var(--font-dm-mono)] text-[10px] font-medium uppercase ${
                  client.type === 'business'
                    ? 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                    : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                }`}
              >
                {client.type}
              </span>
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tagColors[tag] ?? 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-1 font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
              Client since {new Date(client.joinedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {client.referralSource && <> &middot; Source: {client.referralSource}</>}
            </p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCancelEdit}
                  disabled={editSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  loading={editSaving}
                >
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={handleStartEdit}
                >
                  Edit
                </Button>
                <Button
                  onClick={handleEmail}
                  disabled={!client.email}
                >
                  Email
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Info cards grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
            <CardHeader title="Contact Info" />
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
                  />
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                {client.address && <InfoRow label="Address" value={client.address} />}
                {client.primaryContact && (
                  <InfoRow label="Primary Contact" value={client.primaryContact} />
                )}
              </>
            )}
          </div>

          {/* Account Summary */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
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
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
            <CardHeader title="Contacts" />
            <div className="divide-y divide-[var(--border-subtle)]">
              {client.contacts.map((contact) => (
                <div key={contact.email} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{contact.name}</p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
                      {contact.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--text-secondary)]">{contact.email}</p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
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
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
            <CardHeader title="Tracked Vehicles" />
            <div className="divide-y divide-[var(--border-subtle)]">
              {client.vehicles.map((vehicle) => (
                <div key={vehicle.vin} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
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
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
            <CardHeader title="Project History" />
            <div className="divide-y divide-[var(--border-subtle)]">
              {client.projects.map((project) => {
                const style = statusStyles[project.status] ?? statusStyles.completed;
                return (
                  <div key={project.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{project.name}</p>
                        <p className="font-[family-name:var(--font-dm-mono)] text-xs text-[var(--text-muted)]">
                          {new Date(project.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium text-[var(--text-primary)]">
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
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-[18px] shadow-sm transition-all hover:border-[var(--accent-primary-border)] hover:shadow-[0_0_16px_var(--accent-primary-glow)]">
          <CardHeader title="Notes" />
          <textarea
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/30"
            rows={4}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setFeedback(null);
            }}
            placeholder="Add notes about this client..."
          />
          <div className="mt-2 flex items-center gap-3">
            <Button
              onClick={handleSaveNotes}
              disabled={saving || !isDirty}
              loading={saving}
            >
              Save Notes
            </Button>
            {feedback && (
              <span
                className={`text-sm font-medium ${
                  feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'
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

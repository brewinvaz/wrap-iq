'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

const PREDEFINED_TAGS = ['VIP', 'Repeat', 'Fleet', 'New'] as const;

const REFERRAL_SOURCES = [
  { value: '', label: 'Select a source...' },
  { value: 'Google', label: 'Google' },
  { value: 'Word of Mouth', label: 'Word of Mouth' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
] as const;

export default function CreateClientModal({
  isOpen,
  onClose,
  onCreate,
}: CreateClientModalProps) {
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState('personal');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState('');
  const [customReferral, setCustomReferral] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function resetForm() {
    setName('');
    setClientType('personal');
    setEmail('');
    setPhone('');
    setAddress('');
    setTags([]);
    setReferralSource('');
    setCustomReferral('');
    setNotes('');
    setError(null);
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/clients', {
        name: name.trim(),
        client_type: clientType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        referral_source:
          referralSource === 'other'
            ? customReferral.trim() || undefined
            : referralSource || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onCreate();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-client-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="create-client-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Create New Client
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="client-name"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Name
            </label>
            <input
              id="client-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              required
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="client-type"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Client Type
            </label>
            <Select
              id="client-type"
              value={clientType}
              onChange={setClientType}
              options={[
                { value: 'personal', label: 'Personal' },
                { value: 'business', label: 'Business' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="client-email"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Email
              </label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="client-phone"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Phone
              </label>
              <input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="client-address"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Address
            </label>
            <input
              id="client-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div role="group" aria-labelledby="tags-label">
            <span id="tags-label" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="client-referral"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Referral Source
            </label>
            <Select
              id="client-referral"
              value={referralSource}
              onChange={(v) => {
                setReferralSource(v);
                if (v !== 'other') setCustomReferral('');
              }}
              options={REFERRAL_SOURCES.map((src) => ({
                value: src.value,
                label: src.label,
              }))}
            />
            {referralSource === 'other' && (
              <input
                type="text"
                aria-label="Custom referral source"
                value={customReferral}
                onChange={(e) => setCustomReferral(e.target.value)}
                placeholder="Please specify..."
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            )}
          </div>

          <div>
            <label
              htmlFor="client-notes"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Notes
            </label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="flex-1"
            >
              Create Client
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

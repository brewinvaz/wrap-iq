'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

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

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#18181b]">
            Create New Client
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
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
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="client-name"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
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
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="client-type"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Client Type
            </label>
            <select
              id="client-type"
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="client-email"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Email
              </label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="client-phone"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Phone
              </label>
              <input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="client-address"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Address
            </label>
            <input
              id="client-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#18181b]">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-[#e6e6eb] bg-white text-[#60606a] hover:bg-gray-50'
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
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Referral Source
            </label>
            <select
              id="client-referral"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {REFERRAL_SOURCES.map((src) => (
                <option key={src.value} value={src.value}>
                  {src.label}
                </option>
              ))}
            </select>
            {referralSource === 'other' && (
              <input
                type="text"
                value={customReferral}
                onChange={(e) => setCustomReferral(e.target.value)}
                placeholder="Please specify..."
                className="mt-2 w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label
              htmlFor="client-notes"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Notes
            </label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

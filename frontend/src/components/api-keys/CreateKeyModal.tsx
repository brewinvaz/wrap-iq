'use client';

import { useState } from 'react';
import { APIKeyScope } from '@/lib/types';
import ScopeSelector from './ScopeSelector';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
  }) => void;
  availableScopes: APIKeyScope[];
}

export default function CreateKeyModal({
  isOpen,
  onClose,
  onCreate,
  availableScopes,
}: CreateKeyModalProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(60);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(10000);
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      scopes,
      rateLimitPerMinute,
      rateLimitPerDay,
    });
    setName('');
    setScopes([]);
    setRateLimitPerMinute(60);
    setRateLimitPerDay(10000);
    onClose();
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
        aria-labelledby="create-key-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="create-key-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Generate New API Key
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="key-name"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Integration"
              required
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <ScopeSelector
            availableScopes={availableScopes}
            selectedScopes={scopes}
            onChange={setScopes}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rate-minute"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Rate limit / minute
              </label>
              <input
                id="rate-minute"
                type="number"
                min={1}
                max={10000}
                value={rateLimitPerMinute}
                onChange={(e) => setRateLimitPerMinute(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="rate-day"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Rate limit / day
              </label>
              <input
                id="rate-day"
                type="number"
                min={1}
                max={1000000}
                value={rateLimitPerDay}
                onChange={(e) => setRateLimitPerDay(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Generate Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

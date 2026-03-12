'use client';

import { useState } from 'react';
import { roleLabels } from '@/lib/role-config';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const invitableRoles = [
  'project_manager',
  'installer',
  'designer',
  'production',
  'client',
];

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: string) => void;
}

export default function InviteModal({
  isOpen,
  onClose,
  onInvite,
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('installer');
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim(), role);
    setEmail('');
    setRole('installer');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="invite-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            Invite Team Member
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="invite-role"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Role
            </label>
            <Select
              id="invite-role"
              value={role}
              onChange={setRole}
              options={invitableRoles.map((r) => ({
                value: r,
                label: roleLabels[r],
              }))}
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
              className="flex-1"
            >
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

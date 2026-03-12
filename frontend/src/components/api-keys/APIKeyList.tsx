'use client';

import { useState } from 'react';
import { APIKey } from '@/lib/types';

interface APIKeyListProps {
  keys: APIKey[];
  onRevoke: (id: string) => void;
  onRotate: (id: string) => void;
  onSelect: (key: APIKey) => void;
}

export default function APIKeyList({
  keys,
  onRevoke,
  onRotate,
  onSelect,
}: APIKeyListProps) {
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    type: 'revoke' | 'rotate';
  } | null>(null);

  function handleAction(id: string, type: 'revoke' | 'rotate') {
    if (confirmAction?.id === id && confirmAction?.type === type) {
      if (type === 'revoke') onRevoke(id);
      else onRotate(id);
      setConfirmAction(null);
    } else {
      setConfirmAction({ id, type });
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Scopes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Usage
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {keys.map((key) => (
              <tr
                key={key.id}
                className="cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                onClick={() => onSelect(key)}
              >
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {key.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Created {formatDate(key.createdAt)}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <code className="rounded bg-[var(--surface-raised)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                    {key.keyPrefix}...
                  </code>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.slice(0, 2).map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs text-[var(--accent-primary)]"
                      >
                        {scope}
                      </span>
                    ))}
                    {key.scopes.length > 2 && (
                      <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                        +{key.scopes.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      key.isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        key.isActive ? 'bg-emerald-500' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    {key.isActive ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {formatDate(key.lastUsedAt)}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {key.usageCount.toLocaleString()}
                </td>
                <td
                  className="px-6 py-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {key.isActive && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(key.id, 'rotate')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          confirmAction?.id === key.id &&
                          confirmAction?.type === 'rotate'
                            ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
                            : 'border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10'
                        }`}
                      >
                        {confirmAction?.id === key.id &&
                        confirmAction?.type === 'rotate'
                          ? 'Confirm?'
                          : 'Rotate'}
                      </button>
                      <button
                        onClick={() => handleAction(key.id, 'revoke')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          confirmAction?.id === key.id &&
                          confirmAction?.type === 'revoke'
                            ? 'bg-red-600 text-white'
                            : 'border border-red-500/20 text-red-400 hover:bg-red-500/10'
                        }`}
                      >
                        {confirmAction?.id === key.id &&
                        confirmAction?.type === 'revoke'
                          ? 'Confirm?'
                          : 'Revoke'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

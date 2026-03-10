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
    <div className="rounded-xl border border-[#e6e6eb] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e6e6eb]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Scopes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Usage
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e6eb]">
            {keys.map((key) => (
              <tr
                key={key.id}
                className="cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => onSelect(key)}
              >
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-[#18181b]">
                    {key.name}
                  </p>
                  <p className="text-xs text-[#a8a8b4]">
                    Created {formatDate(key.createdAt)}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-[#60606a]">
                    {key.keyPrefix}...
                  </code>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.slice(0, 2).map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        {scope}
                      </span>
                    ))}
                    {key.scopes.length > 2 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#60606a]">
                        +{key.scopes.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      key.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        key.isActive ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                    {key.isActive ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#60606a]">
                  {formatDate(key.lastUsedAt)}
                </td>
                <td className="px-6 py-4 text-sm text-[#60606a]">
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
                            ? 'bg-blue-600 text-white'
                            : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
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
                            : 'border border-red-200 text-red-600 hover:bg-red-50'
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

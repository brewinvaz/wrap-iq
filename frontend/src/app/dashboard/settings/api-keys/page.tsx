'use client';

import { useState } from 'react';
import { APIKey } from '@/lib/types';
import {
  mockAPIKeys,
  availableScopes,
  mockUsageStats,
} from '@/lib/mock/api-key-data';
import APIKeyList from '@/components/api-keys/APIKeyList';
import CreateKeyModal from '@/components/api-keys/CreateKeyModal';
import KeyRevealBanner from '@/components/api-keys/KeyRevealBanner';
import UsageChart from '@/components/api-keys/UsageChart';

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>(mockAPIKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);

  function handleCreate(data: {
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
  }) {
    const fakeFullKey = `wiq_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const newKey: APIKey = {
      id: crypto.randomUUID(),
      name: data.name,
      keyPrefix: fakeFullKey.slice(0, 8),
      scopes: data.scopes,
      rateLimitPerMinute: data.rateLimitPerMinute,
      rateLimitPerDay: data.rateLimitPerDay,
      isActive: true,
      lastUsedAt: null,
      expiresAt: null,
      createdBy: '1',
      createdAt: new Date().toISOString(),
      revokedAt: null,
      usageCount: 0,
    };
    setKeys((prev) => [newKey, ...prev]);
    setRevealedKey(fakeFullKey);
  }

  function handleRevoke(id: string) {
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id
          ? { ...k, isActive: false, revokedAt: new Date().toISOString() }
          : k,
      ),
    );
    if (selectedKey?.id === id) {
      setSelectedKey(null);
    }
  }

  function handleRotate(id: string) {
    const oldKey = keys.find((k) => k.id === id);
    if (!oldKey) return;

    const fakeFullKey = `wiq_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const rotatedKey: APIKey = {
      ...oldKey,
      id: crypto.randomUUID(),
      keyPrefix: fakeFullKey.slice(0, 8),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      usageCount: 0,
    };

    setKeys((prev) =>
      prev
        .map((k) =>
          k.id === id
            ? { ...k, isActive: false, revokedAt: new Date().toISOString() }
            : k,
        )
        .concat([rotatedKey]),
    );
    setRevealedKey(fakeFullKey);
    setSelectedKey(rotatedKey);
  }

  const activeCount = keys.filter((k) => k.isActive).length;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">API Keys</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {activeCount} active
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Generate New Key
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {revealedKey && (
          <KeyRevealBanner
            fullKey={revealedKey}
            onDismiss={() => setRevealedKey(null)}
          />
        )}

        <APIKeyList
          keys={keys}
          onRevoke={handleRevoke}
          onRotate={handleRotate}
          onSelect={setSelectedKey}
        />

        {selectedKey && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e6e6eb] bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#18181b]">
                  {selectedKey.name}
                </h3>
                <button
                  onClick={() => setSelectedKey(null)}
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

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-[#60606a]">Key Prefix</p>
                  <code className="text-sm font-medium text-[#18181b]">
                    {selectedKey.keyPrefix}...
                  </code>
                </div>
                <div>
                  <p className="text-xs text-[#60606a]">Status</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      selectedKey.isActive
                        ? 'text-emerald-700'
                        : 'text-gray-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selectedKey.isActive
                          ? 'bg-emerald-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    {selectedKey.isActive ? 'Active' : 'Revoked'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-[#60606a]">Rate Limit</p>
                  <p className="text-sm font-medium text-[#18181b]">
                    {selectedKey.rateLimitPerMinute}/min,{' '}
                    {selectedKey.rateLimitPerDay.toLocaleString()}/day
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#60606a]">Expires</p>
                  <p className="text-sm font-medium text-[#18181b]">
                    {selectedKey.expiresAt
                      ? new Date(selectedKey.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs text-[#60606a]">Scopes</p>
                <div className="flex flex-wrap gap-2">
                  {selectedKey.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <UsageChart stats={mockUsageStats} />
          </div>
        )}
      </div>

      <CreateKeyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        availableScopes={availableScopes}
      />
    </div>
  );
}

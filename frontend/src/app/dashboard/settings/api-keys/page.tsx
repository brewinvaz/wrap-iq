'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIKey, APIKeyScope, APIKeyUsageStats } from '@/lib/types';
import {
  fetchApiKeys,
  fetchScopes,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
  fetchApiKeyUsage,
  ApiError,
} from '@/lib/api/settings';
import APIKeyList from '@/components/api-keys/APIKeyList';
import CreateKeyModal from '@/components/api-keys/CreateKeyModal';
import KeyRevealBanner from '@/components/api-keys/KeyRevealBanner';
import UsageChart from '@/components/api-keys/UsageChart';

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [scopes, setScopes] = useState<APIKeyScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [usageStats, setUsageStats] = useState<APIKeyUsageStats | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setError(null);
      const [keysData, scopesData] = await Promise.all([
        fetchApiKeys(),
        fetchScopes(),
      ]);
      setKeys(keysData);
      setScopes(scopesData);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load API keys';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // Load usage stats when a key is selected
  useEffect(() => {
    if (!selectedKey) {
      setUsageStats(null);
      return;
    }
    let cancelled = false;
    fetchApiKeyUsage(selectedKey.id)
      .then((stats) => {
        if (!cancelled) setUsageStats(stats);
      })
      .catch(() => {
        if (!cancelled) setUsageStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  async function handleCreate(data: {
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
  }) {
    try {
      setActionError(null);
      const { key, fullKey } = await createApiKey({
        name: data.name,
        scopes: data.scopes,
        rateLimitPerMinute: data.rateLimitPerMinute,
        rateLimitPerDay: data.rateLimitPerDay,
        expiresAt: null,
      });
      setKeys((prev) => [key, ...prev]);
      setRevealedKey(fullKey);
      setShowCreate(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to create API key';
      setActionError(message);
    }
  }

  async function handleRevoke(id: string) {
    try {
      setActionError(null);
      await revokeApiKey(id);
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
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to revoke API key';
      setActionError(message);
    }
  }

  async function handleRotate(id: string) {
    try {
      setActionError(null);
      const { key: newKey, fullKey } = await rotateApiKey(id);
      setKeys((prev) =>
        prev
          .map((k) =>
            k.id === id
              ? { ...k, isActive: false, revokedAt: new Date().toISOString() }
              : k,
          )
          .concat([newKey]),
      );
      setRevealedKey(fullKey);
      setSelectedKey(newKey);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to rotate API key';
      setActionError(message);
    }
  }

  const activeCount = keys.filter((k) => k.isActive).length;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">API Keys</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm text-[var(--text-secondary)]">Loading API keys...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">API Keys</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={loadKeys}
              className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">API Keys</h1>
            <span className="rounded-full bg-[var(--surface-app)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {activeCount} active
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Generate New Key
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
            <button
              onClick={() => setActionError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {selectedKey.name}
                </h3>
                <button
                  onClick={() => setSelectedKey(null)}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
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
                  <p className="text-xs text-[var(--text-secondary)]">Key Prefix</p>
                  <code className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedKey.keyPrefix}...
                  </code>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Status</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      selectedKey.isActive
                        ? 'text-emerald-700'
                        : 'text-[var(--text-secondary)]'
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
                  <p className="text-xs text-[var(--text-secondary)]">Rate Limit</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedKey.rateLimitPerMinute}/min,{' '}
                    {selectedKey.rateLimitPerDay.toLocaleString()}/day
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Expires</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedKey.expiresAt
                      ? new Date(selectedKey.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs text-[var(--text-secondary)]">Scopes</p>
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

            {usageStats && <UsageChart stats={usageStats} />}
          </div>
        )}
      </div>

      <CreateKeyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        availableScopes={scopes}
      />
    </div>
  );
}

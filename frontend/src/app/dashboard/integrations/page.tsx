'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <div className="mb-3 h-5 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--surface-app)]" />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 h-5 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--surface-app)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [webhooksData, apiKeysData] = await Promise.all([
          api.get<{ items: Webhook[]; total: number }>('/api/webhooks'),
          api.get<{ items: ApiKey[]; total: number }>('/api/api-keys'),
        ]);
        if (!cancelled) {
          setWebhooks(webhooksData?.items ?? []);
          setApiKeys(apiKeysData?.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load integrations');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeWebhooks = webhooks.filter((w) => w.is_active).length;
  const activeApiKeys = apiKeys.filter((k) => k.is_active).length;
  const totalActive = activeWebhooks + activeApiKeys;

  async function toggleWebhook(id: string, currentlyActive: boolean) {
    try {
      await api.patch<Webhook>(`/api/webhooks/${id}`, { is_active: !currentlyActive });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, is_active: !w.is_active } : w)),
      );
    } catch {
      // Silently fail — user can retry
    }
  }

  async function testWebhook(id: string) {
    try {
      await api.post(`/api/webhooks/${id}/test`);
    } catch {
      // Silently fail
    }
  }

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load integrations</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Integrations</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              {totalActive} active
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {/* Webhooks Section */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Webhooks</h2>
            <span className="rounded-full bg-[var(--surface-app)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              {webhooks.length}
            </span>
          </div>
          {webhooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-6 py-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No webhooks configured</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Webhooks let external services receive real-time updates from WrapFlow.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 transition-colors hover:border-blue-200"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-app)] text-xl">
                    <svg className="h-5 w-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{webhook.url}</h3>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Events: {webhook.events.join(', ') || 'None'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      Created {formatDate(webhook.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        webhook.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-[var(--surface-app)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
                      }`}
                    >
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testWebhook(webhook.id)}
                    >
                      Test
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Keys Section */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Keys</h2>
            <span className="rounded-full bg-[var(--surface-app)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              {apiKeys.length}
            </span>
          </div>
          {apiKeys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-6 py-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No API keys created</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                API keys allow external applications to authenticate with WrapFlow.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 transition-colors hover:border-blue-200"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-app)] text-xl">
                    <svg className="h-5 w-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{key.name}</h3>
                      <span className="rounded-full bg-[var(--surface-app)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-muted)]">
                        {key.prefix}...
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Scopes: {key.scopes.join(', ') || 'None'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      {key.last_used_at ? `Last used ${formatDate(key.last_used_at)}` : 'Never used'}
                      {key.expires_at ? ` · Expires ${formatDate(key.expires_at)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      key.is_active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-[var(--surface-app)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {key.is_active ? 'Active' : 'Revoked'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

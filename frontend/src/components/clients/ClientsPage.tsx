'use client';

import { useState, useEffect, useCallback } from 'react';
import { Client } from '@/lib/types';
import { api, ApiError } from '@/lib/api-client';
import ClientList from './ClientList';
import ClientDetail from './ClientDetail';
import CreateClientModal from './CreateClientModal';

// --- API response types ---

interface ApiClientResponse {
  id: string;
  name: string;
  client_type: 'personal' | 'business';
  email: string | null;
  phone: string | null;
  address: string | null;
  tags: string[];
  referral_source: string | null;
  notes: string | null;
  is_active: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiClientListItemResponse extends ApiClientResponse {
  project_count: number;
  total_revenue: number;
}

interface ApiClientListResponse {
  items: ApiClientListItemResponse[];
  total: number;
}

interface ApiClientDetailResponse extends ApiClientResponse {
  sub_clients: ApiClientResponse[];
  project_count: number;
  total_revenue: number;
}

// --- Transform API response to UI Client type ---

function transformApiClient(apiClient: ApiClientListItemResponse | ApiClientDetailResponse): Client {
  return {
    id: apiClient.id,
    name: apiClient.name,
    type: apiClient.client_type,
    email: apiClient.email ?? '',
    phone: apiClient.phone ?? '',
    address: apiClient.address ?? undefined,
    tags: apiClient.tags,
    referralSource: apiClient.referral_source ?? undefined,
    notes: apiClient.notes ?? undefined,
    vehicles: [],
    projects: [],
    projectCount: apiClient.project_count ?? 0,
    totalSpent: apiClient.total_revenue ?? 0,
    joinedDate: apiClient.created_at.split('T')[0],
  };
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full">
      {/* List skeleton */}
      <div className="w-80 shrink-0 border-r border-[var(--border)] bg-[var(--surface-card)] p-4">
        <div className="mb-4 h-10 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[var(--border)] p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
      {/* Detail skeleton */}
      <div className="flex-1 bg-[var(--surface-app)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--surface-raised)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-raised)]" />
          <div className="mt-6 grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-[var(--surface-raised)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Error state ---

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--surface-app)]">
      <div className="rounded-full bg-red-500/10 p-3">
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load clients</p>
      <p className="text-xs text-[var(--text-secondary)]">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
      >
        Retry
      </button>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiClientListResponse>('/api/clients?limit=100');
      const transformed = response.items.map((item) => transformApiClient(item));

      setClients(transformed);
      if (transformed.length > 0) {
        setSelectedClient(transformed[0]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchClients} />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">Clients</h1>
          <span className="rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {clients.length} total
          </span>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
        >
          + New Client
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <ClientList
          clients={clients}
          selectedId={selectedClient?.id ?? null}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={setSelectedClient}
        />
        {selectedClient ? (
          <ClientDetail client={selectedClient} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[var(--surface-app)]">
            <p className="text-sm text-[var(--text-muted)]">
              {clients.length === 0
                ? 'No clients found. Create your first client to get started.'
                : 'Select a client to view details'}
            </p>
          </div>
        )}
      </div>

      <CreateClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreate={() => {
          fetchClients();
        }}
      />
    </div>
  );
}

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

interface ApiClientListResponse {
  items: ApiClientResponse[];
  total: number;
}

interface ApiClientDetailResponse extends ApiClientResponse {
  sub_clients: ApiClientResponse[];
  project_count: number;
  total_revenue: number;
}

// --- Transform API response to UI Client type ---

function transformApiClient(apiClient: ApiClientResponse, detail?: ApiClientDetailResponse): Client {
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
    projectCount: detail?.project_count ?? 0,
    totalSpent: detail?.total_revenue ?? 0,
    joinedDate: apiClient.created_at.split('T')[0],
  };
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full">
      {/* List skeleton */}
      <div className="w-80 shrink-0 border-r border-[#e6e6eb] bg-white p-4">
        <div className="mb-4 h-10 animate-pulse rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[#e6e6eb] p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      {/* Detail skeleton */}
      <div className="flex-1 bg-[#f4f4f6] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="mt-6 grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-200" />
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
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#f4f4f6]">
      <div className="rounded-full bg-red-100 p-3">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#18181b]">Failed to load clients</p>
      <p className="text-xs text-[#60606a]">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiClientListResponse>('/api/clients?limit=100');
      const transformed = response.items.map((item) => transformApiClient(item));

      // Fetch detail for each client to get project_count and total_revenue
      const detailedClients = await Promise.all(
        transformed.map(async (client, index) => {
          try {
            const detail = await api.get<ApiClientDetailResponse>(`/api/clients/${response.items[index].id}`);
            return transformApiClient(response.items[index], detail);
          } catch {
            return client;
          }
        }),
      );

      setClients(detailedClients);
      if (detailedClients.length > 0) {
        setSelectedClient(detailedClients[0]);
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
      <header className="flex shrink-0 items-center justify-between border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#18181b]">Clients</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
            {clients.length} total
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
          <div className="flex flex-1 items-center justify-center bg-[#f4f4f6]">
            <p className="text-sm text-gray-400">
              {clients.length === 0
                ? 'No clients found. Create your first client to get started.'
                : 'Select a client to view details'}
            </p>
          </div>
        )}
      </div>

      <CreateClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={() => { fetchClients(); }}
      />
    </div>
  );
}

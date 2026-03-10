'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { mockClients } from '@/lib/mock-clients';
import ClientList from './ClientList';
import ClientDetail from './ClientDetail';

export default function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    mockClients[0] ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex h-full">
      <ClientList
        clients={mockClients}
        selectedId={selectedClient?.id ?? null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={setSelectedClient}
      />
      {selectedClient ? (
        <ClientDetail client={selectedClient} />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[#f4f4f6]">
          <p className="text-sm text-gray-400">Select a client to view details</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: string;
}

const initialIntegrations: Integration[] = [
  { id: '1', name: 'QuickBooks', description: 'Sync invoices and payments automatically', icon: '💳', connected: true, category: 'Accounting' },
  { id: '2', name: 'Google Drive', description: 'Store and share design files', icon: '📁', connected: true, category: 'Storage' },
  { id: '3', name: 'Twilio', description: 'Send SMS notifications to clients', icon: '📱', connected: false, category: 'Communication' },
  { id: '4', name: 'Gmail', description: 'Log email communications per job', icon: '✉️', connected: false, category: 'Communication' },
  { id: '5', name: 'GoHighLevel', description: 'CRM and marketing automation', icon: '📊', connected: false, category: 'CRM' },
  { id: '6', name: 'Make.com', description: 'Custom workflow automations via webhooks', icon: '⚡', connected: true, category: 'Automation' },
  { id: '7', name: 'Dropbox', description: 'Alternative file storage and sharing', icon: '📦', connected: false, category: 'Storage' },
  { id: '8', name: 'n8n', description: 'Self-hosted workflow automation', icon: '🔗', connected: false, category: 'Automation' },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(initialIntegrations);

  function toggleConnection(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)),
    );
  }

  const connected = integrations.filter((i) => i.connected).length;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Integrations</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {connected} connected
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-start gap-4 rounded-xl border border-[#e6e6eb] bg-white p-5 transition-colors hover:border-blue-200"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f4f4f6] text-xl">
                {integration.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#18181b]">{integration.name}</h3>
                  <span className="rounded-full bg-[#f4f4f6] px-2 py-0.5 text-[10px] text-[#a8a8b4]">
                    {integration.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#60606a]">{integration.description}</p>
              </div>
              <button
                onClick={() => toggleConnection(integration.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  integration.connected
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-gray-100 text-[#60606a] hover:bg-gray-200'
                }`}
              >
                {integration.connected ? 'Connected' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

const availableIntegrations: Integration[] = [
  { id: '1', name: 'QuickBooks', description: 'Sync invoices and payments automatically', icon: '\ud83d\udcb3', category: 'Accounting' },
  { id: '2', name: 'Google Drive', description: 'Store and share design files', icon: '\ud83d\udcc1', category: 'Storage' },
  { id: '3', name: 'Twilio', description: 'Send SMS notifications to clients', icon: '\ud83d\udcf1', category: 'Communication' },
  { id: '4', name: 'Gmail', description: 'Log email communications per job', icon: '\u2709\ufe0f', category: 'Communication' },
  { id: '5', name: 'GoHighLevel', description: 'CRM and marketing automation', icon: '\ud83d\udcca', category: 'CRM' },
  { id: '6', name: 'Make.com', description: 'Custom workflow automations via webhooks', icon: '\u26a1', category: 'Automation' },
  { id: '7', name: 'Dropbox', description: 'Alternative file storage and sharing', icon: '\ud83d\udce6', category: 'Storage' },
  { id: '8', name: 'n8n', description: 'Self-hosted workflow automation', icon: '\ud83d\udd17', category: 'Automation' },
];

export default function IntegrationsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Integrations</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              0 connected
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#60606a]">
          No integrations configured. Connect your tools to streamline your workflow.
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {availableIntegrations.map((integration) => (
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
              <span className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-[#a8a8b4]">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

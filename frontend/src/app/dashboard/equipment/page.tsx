'use client';

import { useState, useEffect } from 'react';

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  status: string;
  lastService: string;
  assignedTo: string;
  notes: string;
}

const STATUS_STYLES: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700',
  'In Use': 'bg-blue-100 text-blue-700',
  Maintenance: 'bg-amber-100 text-amber-700',
};

const STATUS_DOT: Record<string, string> = {
  Available: 'bg-emerald-500',
  'In Use': 'bg-blue-500',
  Maintenance: 'bg-amber-500',
};

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
      </header>
      <div className="shrink-0 flex gap-4 border-b border-[#e6e6eb] bg-white px-6 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-[#e6e6eb] bg-white p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with api.get<EquipmentItem[]>('/api/equipment') when backend endpoint exists
    const timer = setTimeout(() => {
      setEquipment([]);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [setEquipment]);

  const statusCounts = equipment.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">My Equipment</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {equipment.length} items
            </span>
          </div>
        </div>
      </header>

      {/* Status summary */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="shrink-0 flex gap-4 border-b border-[#e6e6eb] bg-white px-6 py-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
              <span className="text-sm text-[#60606a]">
                {count} {status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Equipment Cards or Empty State */}
      <div className="flex-1 overflow-auto p-6">
        {equipment.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-8 w-8 text-[#a8a8b4]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743"
                  />
                </svg>
              </div>
              <h2 className="text-sm font-medium text-[#18181b]">No equipment tracked yet</h2>
              <p className="mt-1 text-sm text-[#60606a]">
                Add equipment to monitor usage and maintenance schedules.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {equipment.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#e6e6eb] bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#18181b]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[#a8a8b4]">{item.category}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                      Location
                    </span>
                    <span className="text-xs text-[#60606a]">{item.assignedTo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                      Last Service
                    </span>
                    <span className="font-mono text-xs text-[#60606a]">{item.lastService}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-[#e6e6eb] pt-3">
                  <p className="text-xs leading-relaxed text-[#60606a]">{item.notes}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

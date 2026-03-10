'use client';

import { useState } from 'react';

type ProofStatus = 'all' | 'pending' | 'approved' | 'revision';

interface Proof {
  id: string;
  designName: string;
  client: string;
  vehicle: string;
  status: 'pending' | 'approved' | 'revision';
  submittedDate: string;
  designer: string;
}

const proofs: Proof[] = [
  { id: '1', designName: 'Fleet Branding v2', client: 'Metro Plumbing', vehicle: '2024 Ford Transit', status: 'approved', submittedDate: '2026-03-08', designer: 'Sarah Chen' },
  { id: '2', designName: 'Box Truck — Side Panels', client: 'FastFreight Inc.', vehicle: '2025 RAM ProMaster', status: 'pending', submittedDate: '2026-03-09', designer: 'Jordan Lee' },
  { id: '3', designName: 'Matte Blue Color Change', client: 'CleanCo Services', vehicle: '2024 Mercedes Sprinter', status: 'revision', submittedDate: '2026-03-07', designer: 'Sarah Chen' },
  { id: '4', designName: 'Accent Kit — Gold Stripe', client: 'Elite Auto Group', vehicle: '2024 BMW 3 Series', status: 'pending', submittedDate: '2026-03-10', designer: 'Jordan Lee' },
  { id: '5', designName: 'Full Trailer Wrap', client: 'Skyline Moving', vehicle: '2024 Utility Trailer', status: 'approved', submittedDate: '2026-03-05', designer: 'Sarah Chen' },
  { id: '6', designName: 'Hood & Roof Accent', client: 'Greenfield Lawn Care', vehicle: '2025 Toyota Tacoma', status: 'pending', submittedDate: '2026-03-10', designer: 'Jordan Lee' },
];

const statusStyles: Record<Proof['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Review' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
  revision: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Revision Requested' },
};

export default function ProofsPage() {
  const [filter, setFilter] = useState<ProofStatus>('all');
  const filtered = filter === 'all' ? proofs : proofs.filter((p) => p.status === filter);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Proof Approvals</h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {proofs.filter((p) => p.status === 'pending').length} pending
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {([
            { key: 'all' as ProofStatus, label: 'All' },
            { key: 'pending' as ProofStatus, label: 'Pending' },
            { key: 'approved' as ProofStatus, label: 'Approved' },
            { key: 'revision' as ProofStatus, label: 'Revision' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key ? 'bg-blue-50 text-blue-700' : 'text-[#60606a] hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((proof) => {
            const style = statusStyles[proof.status];
            return (
              <div key={proof.id} className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-[#f4f4f6] to-[#e6e6eb]">
                  <div className="text-center">
                    <span className="text-2xl">🎨</span>
                    <p className="mt-1 text-[10px] text-[#a8a8b4]">Design Proof</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#18181b]">{proof.designName}</h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#60606a]">{proof.client} — {proof.vehicle}</p>
                  <p className="text-xs text-[#a8a8b4]">By {proof.designer} · {proof.submittedDate}</p>

                  {proof.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                        Approve
                      </button>
                      <button className="flex-1 rounded-lg border border-[#e6e6eb] px-3 py-1.5 text-xs font-medium text-[#60606a] hover:bg-gray-50">
                        Request Revision
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

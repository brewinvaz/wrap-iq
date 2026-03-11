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

const statusStyles: Record<Proof['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Review' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
  revision: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Revision Requested' },
};

export default function ProofsPage() {
  const [filter, setFilter] = useState<ProofStatus>('all');

  // TODO: Replace with API call once backend proof approval endpoint exists
  const proofs: Proof[] = [];
  const filtered = filter === 'all' ? proofs : proofs.filter((p) => p.status === filter);
  const pendingCount = proofs.filter((p) => p.status === 'pending').length;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Proof Approvals</h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {pendingCount} pending
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
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="text-4xl">🎨</span>
            <h2 className="mt-3 text-sm font-semibold text-[#18181b]">No proofs pending</h2>
            <p className="mt-1 max-w-sm text-xs text-[#60606a]">
              Design proofs requiring approval will appear here.
            </p>
          </div>
        ) : (
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

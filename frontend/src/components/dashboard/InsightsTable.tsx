'use client';

import { useState } from 'react';
import { InstallerInsight } from '@/lib/types';

interface InsightsTableProps {
  data: InstallerInsight[];
}

type SortKey = 'name' | 'installs' | 'avgTime' | 'rating';

export default function InsightsTable({ data }: InsightsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('installs');
  const [sortAsc, setSortAsc] = useState(false);

  const maxInstalls = Math.max(...data.map((d) => d.installs));

  const sorted = [...data].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'name') return dir * a.name.localeCompare(b.name);
    if (sortKey === 'installs') return dir * (a.installs - b.installs);
    if (sortKey === 'avgTime') return dir * (parseFloat(a.avgTime) - parseFloat(b.avgTime));
    if (sortKey === 'rating') return dir * (a.rating - b.rating);
    return 0;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortIcon = (col: SortKey) => {
    if (sortKey !== col) return <span className="ml-1 text-gray-300">{'\u2195'}</span>;
    return <span className="ml-1">{sortAsc ? '\u2191' : '\u2193'}</span>;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#e6e6eb] bg-white">
      <div className="px-5 py-4 border-b border-[#e6e6eb]">
        <h3 className="text-sm font-semibold text-[#18181b]">Installer Performance</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e6e6eb] bg-gray-50/50">
            <th
              className="cursor-pointer px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-gray-400"
              onClick={() => handleSort('name')}
            >
              Name {sortIcon("name")}
            </th>
            <th
              className="cursor-pointer px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-gray-400"
              onClick={() => handleSort('installs')}
            >
              Installs {sortIcon("installs")}
            </th>
            <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-gray-400">
              Performance
            </th>
            <th
              className="cursor-pointer px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-gray-400"
              onClick={() => handleSort('avgTime')}
            >
              Avg Time {sortIcon("avgTime")}
            </th>
            <th
              className="cursor-pointer px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-gray-400"
              onClick={() => handleSort('rating')}
            >
              Rating {sortIcon("rating")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((installer, i) => (
            <tr
              key={installer.name}
              className={`border-b border-[#e6e6eb] last:border-b-0 ${
                i % 2 === 1 ? 'bg-gray-50/30' : ''
              }`}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: installer.color }}
                  >
                    {installer.initials}
                  </div>
                  <span className="font-medium text-[#18181b]">{installer.name}</span>
                </div>
              </td>
              <td className="px-5 py-3 font-semibold text-[#18181b]">{installer.installs}</td>
              <td className="px-5 py-3">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(installer.installs / maxInstalls) * 100}%` }}
                  />
                </div>
              </td>
              <td className="px-5 py-3 text-[#60606a]">{installer.avgTime}</td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1 text-[#18181b]">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-medium">{installer.rating}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

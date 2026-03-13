'use client';

import type { EquipmentStats as EquipmentStatsType } from '@/lib/api/equipment';

interface Props {
  stats: EquipmentStatsType;
}

const CARDS = [
  { key: 'total' as const, label: 'Total Equipment', icon: '\u2699\uFE0F' },
  { key: 'active' as const, label: 'Active Equipment', icon: '\u2713' },
  { key: 'printers' as const, label: 'Printers', icon: '\uD83D\uDDA8' },
  { key: 'other' as const, label: 'Other Equipment', icon: '\uD83D\uDCE6' },
];

export default function EquipmentStatsBar({ stats }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3 border-t border-[var(--border)] px-6 py-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
        >
          <span className="text-lg">{card.icon}</span>
          <div>
            <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {stats[card.key]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { api } from './api-client';
import { getAccessToken } from './auth';
import type { BadgeKey } from './roles';

export type BadgeCounts = Record<BadgeKey, number>;

const EMPTY: BadgeCounts = {
  work_orders: 0,
  unread_notifications: 0,
  design_queue: 0,
};

/** Poll interval for refreshing badge counts (60 seconds). */
const POLL_INTERVAL_MS = 60_000;

/**
 * Fetches sidebar badge counts from the backend and re-fetches periodically.
 * Returns an object keyed by BadgeKey with numeric counts.
 */
export function useBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;

    async function fetchCounts() {
      try {
        const data = await api.get<BadgeCounts>('/api/sidebar/badges');
        if (!cancelled) {
          setCounts(data);
        }
      } catch {
        // API unavailable — keep previous counts
      }
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return counts;
}

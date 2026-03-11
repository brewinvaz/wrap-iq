'use client';

import { useEffect } from 'react';
import { clearExpiredTokens } from '@/lib/auth';

/**
 * Runs once on app mount to clear any expired tokens from localStorage.
 */
export default function AuthInit() {
  useEffect(() => {
    clearExpiredTokens();
  }, []);

  return null;
}

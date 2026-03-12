'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface SharedRender {
  design_name: string;
  result_image_url: string;
  created_at: string;
}

export default function SharedRenderPage() {
  const params = useParams();
  const token = params.token as string;
  const [render, setRender] = useState<SharedRender | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use raw fetch() instead of apiFetch — this is a public page.
  // apiFetch would inject Authorization headers and trigger redirect-to-login
  // on 401 if a logged-in user's token has expired.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/renders/shared/${token}`);
        if (!res.ok) throw new Error('Render not found');
        const data: SharedRender = await res.json();
        setRender(data);
      } catch {
        setError('Render not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !render) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-app)]">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
          <span className="font-mono text-sm font-bold text-white">W</span>
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Render Not Found</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{error || 'This render may have been deleted.'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--surface-app)] px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
          <span className="font-mono text-xs font-bold text-white">W</span>
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          Wrap<span className="text-[var(--accent-primary)]">Flow</span>
        </span>
      </div>

      <div className="w-full max-w-3xl overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-card)] shadow-sm">
        <img
          src={render.result_image_url}
          alt={render.design_name}
          className="w-full object-contain"
        />
        <div className="border-t border-[var(--border)] px-6 py-4">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{render.design_name}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Created {new Date(render.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

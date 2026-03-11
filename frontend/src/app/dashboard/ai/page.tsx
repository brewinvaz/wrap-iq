'use client';

import { useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface AIActivity {
  id: string;
  type: 'detection' | 'discrepancy' | 'insight' | 'chat-update';
  message: string;
  timestamp: string;
  confidence?: number;
}

interface QueryResponse {
  answer: string;
  sources?: string[];
}

const typeStyles: Record<AIActivity['type'], { bg: string; text: string; label: string }> = {
  detection: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Detection' },
  discrepancy: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Discrepancy' },
  insight: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Insight' },
  'chat-update': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Auto-Update' },
};

export default function AIPage() {
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState<AIActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.post<QueryResponse>('/api/ai/query', { query: trimmed });

      const newActivity: AIActivity = {
        id: `ai-${Date.now()}`,
        type: 'insight',
        message: data.answer,
        timestamp: 'Just now',
      };
      setActivity((prev) => [newActivity, ...prev]);
      setQuery('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to get AI response. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Shop Intelligence</h1>
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              AI Powered
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* AI Query Input */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white p-5">
          <label htmlFor="ai-query" className="mb-2 block text-sm font-semibold text-[#18181b]">
            Ask AI
          </label>
          <div className="flex gap-3">
            <input
              id="ai-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAsk();
              }}
              placeholder="Ask a question about your shop data..."
              className="flex-1 rounded-lg border border-[#e6e6eb] px-3 py-2 text-sm text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-400"
            />
            <button
              onClick={handleAsk}
              disabled={isLoading || !query.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Activity Feed or Empty State */}
        <div className="rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">Recent AI Activity</h2>
          </div>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
                <svg className="h-6 w-6 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#18181b]">No AI insights yet</p>
              <p className="mt-1 text-xs text-[#60606a]">
                Ask questions about your shop data using the AI assistant.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#e6e6eb]">
              {activity.map((a) => {
                const style = typeStyles[a.type];
                return (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-[#18181b]">{a.message}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs text-[#a8a8b4]">{a.timestamp}</span>
                        {a.confidence && (
                          <span className="text-xs text-[#a8a8b4]">{a.confidence}% confidence</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface AIQueryResponse {
  answer: string;
  query_executed: string | null;
  data: Record<string, unknown>[] | null;
  conversation_id: string;
}

interface ApiKanbanStage {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface ApiVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface ApiWorkOrder {
  id: string;
  job_number: string;
  job_type: string;
  job_value: number;
  priority: string;
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  status: ApiKanbanStage | null;
  vehicles: ApiVehicle[];
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiWorkOrderListResponse {
  items: ApiWorkOrder[];
  total: number;
}

interface AIStat {
  label: string;
  value: string;
  sub: string;
  icon: string;
}

interface AIActivity {
  id: string;
  type: 'new-lead' | 'high-priority' | 'completed' | 'status-update';
  message: string;
  timestamp: string;
  confidence?: number;
}

const typeStyles: Record<AIActivity['type'], { bg: string; text: string; label: string }> = {
  'new-lead': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New Lead' },
  'high-priority': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'High Priority' },
  completed: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Completed' },
  'status-update': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Status Update' },
};

function vehicleLabel(vehicles: ApiVehicle[]): string {
  if (!vehicles.length) return '';
  const v = vehicles[0];
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(' ') : '';
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function deriveStats(workOrders: ApiWorkOrder[]): AIStat[] {
  const total = workOrders.length;
  const active = workOrders.filter((wo) => {
    const s = wo.status?.system_status?.toLowerCase() ?? '';
    return s !== 'completed' && s !== 'cancelled';
  }).length;
  const completed = workOrders.filter(
    (wo) => wo.status?.system_status?.toLowerCase() === 'completed',
  ).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalRevenue = workOrders.reduce((sum, wo) => sum + (wo.job_value || 0), 0);
  const revenueStr =
    totalRevenue >= 1000
      ? `$${(totalRevenue / 1000).toFixed(totalRevenue >= 10000 ? 0 : 1)}K`
      : `$${totalRevenue.toLocaleString()}`;

  return [
    { label: 'Total Work Orders', value: total.toLocaleString(), sub: 'All time', icon: '\uD83D\uDCCB' },
    { label: 'Active Jobs', value: active.toLocaleString(), sub: 'In progress', icon: '\uD83D\uDD27' },
    { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completed} completed`, icon: '\u2705' },
    { label: 'Pipeline Value', value: revenueStr, sub: 'Total job value', icon: '\uD83D\uDCB0' },
  ];
}

function deriveActivity(workOrders: ApiWorkOrder[]): AIActivity[] {
  // Sort by updated_at descending and take the 10 most recent
  const sorted = [...workOrders]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return sorted.map((wo) => {
    const vehicle = vehicleLabel(wo.vehicles);
    const vehiclePart = vehicle ? ` — ${vehicle}` : '';
    const clientPart = wo.client_name ? ` for ${wo.client_name}` : '';
    const statusName = wo.status?.name ?? 'Unknown';
    const systemStatus = wo.status?.system_status?.toLowerCase() ?? '';

    let type: AIActivity['type'];
    let message: string;

    if (systemStatus === 'completed') {
      type = 'completed';
      message = `Job #${wo.job_number} completed${clientPart}${vehiclePart}`;
    } else if (wo.priority === 'high') {
      type = 'high-priority';
      message = `High priority: Job #${wo.job_number} (${statusName})${clientPart}${vehiclePart}`;
    } else if (systemStatus === 'lead') {
      type = 'new-lead';
      message = `New job #${wo.job_number} received${clientPart}${vehiclePart}`;
    } else {
      type = 'status-update';
      message = `Job #${wo.job_number} updated to "${statusName}"${clientPart}${vehiclePart}`;
    }

    return {
      id: wo.id,
      type,
      message,
      timestamp: timeAgo(wo.updated_at),
    };
  });
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function AskAIModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modalRef = useModalAccessibility(isOpen, onClose);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError('');
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setIsLoading(true);

    try {
      const payload: { question: string; conversation_id?: string } = {
        question: trimmed,
      };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await api.post<AIQueryResponse>('/api/ai/query', payload);
      setConversationId(response.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to get a response. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setMessages([]);
    setQuestion('');
    setError('');
    setConversationId(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-title"
        className="relative flex h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface-card)] shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 id="ask-ai-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Ask AI
            </h3>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              Shop Intelligence
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-4xl">{'\uD83E\uDDE0'}</span>
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
                Ask anything about your shop
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Get insights about work orders, clients, revenue, and more.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
                    : 'bg-[var(--surface-app)] text-[var(--text-primary)]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div className="rounded-xl bg-[var(--surface-app)] px-4 py-3 text-sm text-[var(--text-muted)]">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--border)] px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your shop..."
              className="flex-1 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-app)]" />
          </div>
          <div className="h-9 w-20 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        </div>
      </header>
      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-[var(--surface-raised)]" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[var(--surface-app)]" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--surface-raised)]" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-raised)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-app)]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-app)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIPage() {
  const [showAskAI, setShowAskAI] = useState(false);
  const [workOrders, setWorkOrders] = useState<ApiWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<ApiWorkOrderListResponse>('/api/work-orders?limit=100');
        if (!cancelled) {
          setWorkOrders(resp?.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load shop intelligence data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const aiStats = useMemo(() => deriveStats(workOrders), [workOrders]);
  const recentActivity = useMemo(() => deriveActivity(workOrders), [workOrders]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load shop intelligence</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Shop Intelligence</h1>
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              AI Powered
            </span>
          </div>
          <button
            onClick={() => setShowAskAI(true)}
            className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Ask AI
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {aiStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent AI Activity</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">No recent activity to display.</p>
              </div>
            ) : (
              recentActivity.map((a) => {
                const style = typeStyles[a.type];
                return (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)]">{a.message}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)]">{a.timestamp}</span>
                        {a.confidence && (
                          <span className="text-xs text-[var(--text-muted)]">{a.confidence}% confidence</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AskAIModal isOpen={showAskAI} onClose={() => setShowAskAI(false)} />
    </div>
  );
}

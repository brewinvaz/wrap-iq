'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface AIQueryResponse {
  answer: string;
  query_executed: string | null;
  data: Record<string, unknown>[] | null;
  conversation_id: string;
}

const aiStats = [
  { label: 'Insights Generated', value: '1,247', sub: 'Last 30 days', icon: '🧠' },
  { label: 'Vehicle Detections', value: '98.2%', sub: 'Accuracy rate', icon: '📸' },
  { label: 'Discrepancies Found', value: '23', sub: 'This month', icon: '⚠️' },
  { label: 'Chat Auto-Updates', value: '156', sub: 'Cards updated', icon: '💬' },
];

interface AIActivity {
  id: string;
  type: 'detection' | 'discrepancy' | 'insight' | 'chat-update';
  message: string;
  timestamp: string;
  confidence?: number;
}

const recentActivity: AIActivity[] = [
  { id: '1', type: 'detection', message: 'Vehicle detected: 2024 Ford Transit — VIN matched to Metro Plumbing fleet order', timestamp: '2 min ago', confidence: 99 },
  { id: '2', type: 'discrepancy', message: 'Color mismatch: Client specified "Matte Black" but uploaded photo shows "Gloss Black" on FastFreight truck', timestamp: '18 min ago', confidence: 94 },
  { id: '3', type: 'chat-update', message: 'Job card #1042 updated: Install date moved to March 12 based on team chat discussion', timestamp: '45 min ago' },
  { id: '4', type: 'insight', message: 'Trend: Average install time decreased 12% over last 4 weeks — recommend reviewing crew scheduling', timestamp: '1 hr ago' },
  { id: '5', type: 'detection', message: 'Vehicle detected: 2025 RAM ProMaster — new work order auto-created for CleanCo Services', timestamp: '2 hrs ago', confidence: 97 },
  { id: '6', type: 'discrepancy', message: 'Dimension mismatch: Submitted measurements don\'t match standard 2024 Sprinter specs', timestamp: '3 hrs ago', confidence: 88 },
  { id: '7', type: 'chat-update', message: 'Job card #1039 updated: Material changed to 3M IJ180Cv3 per designer recommendation in chat', timestamp: '4 hrs ago' },
  { id: '8', type: 'insight', message: 'Revenue forecast: March projected at $52K based on current pipeline velocity', timestamp: '5 hrs ago' },
];

const typeStyles: Record<AIActivity['type'], { bg: string; text: string; label: string }> = {
  detection: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Detection' },
  discrepancy: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Discrepancy' },
  insight: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Insight' },
  'chat-update': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Auto-Update' },
};

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
        className="relative flex h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6e6eb] px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 id="ask-ai-title" className="text-lg font-semibold text-[#18181b]">
              Ask AI
            </h3>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              Shop Intelligence
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
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
              <span className="text-4xl">🧠</span>
              <p className="mt-3 text-sm font-medium text-[#18181b]">
                Ask anything about your shop
              </p>
              <p className="mt-1 text-xs text-[#a8a8b4]">
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-[#18181b]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-[#a8a8b4]">
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
        <form onSubmit={handleSubmit} className="border-t border-[#e6e6eb] px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your shop..."
              className="flex-1 rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AIPage() {
  const [showAskAI, setShowAskAI] = useState(false);

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
          <button
            onClick={() => setShowAskAI(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Ask AI
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {aiStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-[#a8a8b4]">{s.label}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#18181b]">{s.value}</p>
              <p className="mt-1 text-xs text-[#60606a]">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">Recent AI Activity</h2>
          </div>
          <div className="divide-y divide-[#e6e6eb]">
            {recentActivity.map((a) => {
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
        </div>
      </div>

      <AskAIModal isOpen={showAskAI} onClose={() => setShowAskAI(false)} />
    </div>
  );
}

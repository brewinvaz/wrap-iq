'use client';

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

export default function AIPage() {
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
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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
    </div>
  );
}

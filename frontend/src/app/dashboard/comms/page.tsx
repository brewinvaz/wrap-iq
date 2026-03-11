'use client';

import { useState } from 'react';

interface Conversation {
  id: string;
  client: string;
  initials: string;
  color: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isMe: boolean;
}

const conversations: Conversation[] = [
  { id: '1', client: 'Metro Plumbing', initials: 'MP', color: 'bg-blue-500', lastMessage: 'Install is confirmed for Tuesday 7 AM. We\'ll have 2 installers on site.', timestamp: '10 min ago', unread: 2 },
  { id: '2', client: 'FastFreight Inc.', initials: 'FF', color: 'bg-violet-500', lastMessage: 'Can we see a proof before printing? Want to check the logo placement.', timestamp: '1 hr ago', unread: 1 },
  { id: '3', client: 'CleanCo Services', initials: 'CC', color: 'bg-emerald-500', lastMessage: 'Thanks for the update! Matte blue looks great.', timestamp: '3 hrs ago', unread: 0 },
  { id: '4', client: 'Elite Auto Group', initials: 'EA', color: 'bg-amber-500', lastMessage: 'We approved the proof. Please proceed with production.', timestamp: 'Yesterday', unread: 0 },
  { id: '5', client: 'Skyline Moving', initials: 'SM', color: 'bg-rose-500', lastMessage: 'The trailer wrap looks amazing! Sending more trucks your way.', timestamp: '2 days ago', unread: 0 },
];

const messagesByConvo: Record<string, Message[]> = {
  '1': [
    { id: 'm1', sender: 'Metro Plumbing', content: 'Hi, when is the install scheduled for Van #12?', timestamp: '9:30 AM', isMe: false },
    { id: 'm2', sender: 'You', content: 'Install is confirmed for Tuesday 7 AM. We\'ll have 2 installers on site.', timestamp: '9:45 AM', isMe: true },
    { id: 'm3', sender: 'Metro Plumbing', content: 'Perfect. Will the van need to stay overnight?', timestamp: '9:50 AM', isMe: false },
    { id: 'm4', sender: 'You', content: 'Plan for a full day — should be done by 3 PM. We\'ll call when it\'s ready for pickup.', timestamp: '10:02 AM', isMe: true },
  ],
};

export default function CommsPage() {
  const [selected, setSelected] = useState(conversations[0].id);
  const [messageText, setMessageText] = useState('');
  const messages = messagesByConvo[selected] ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#18181b]">Client Communications</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
            {conversations.filter((c) => c.unread > 0).length} unread
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-[#e6e6eb] bg-white">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`flex w-full items-start gap-3 border-b border-[#e6e6eb] px-4 py-3 text-left transition-colors ${
                selected === c.id ? 'bg-blue-50/50' : 'hover:bg-[#f4f4f6]'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${c.color}`}>
                {c.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#18181b]">{c.client}</span>
                  <span className="text-[10px] text-[#a8a8b4]">{c.timestamp}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#60606a]">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Message Area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-md rounded-xl px-4 py-2.5 ${
                      m.isMe ? 'bg-blue-600 text-white' : 'bg-[#f4f4f6] text-[#18181b]'
                    }`}>
                      <p className="text-sm">{m.content}</p>
                      <p className={`mt-1 text-[10px] ${m.isMe ? 'text-blue-200' : 'text-[#a8a8b4]'}`}>
                        {m.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#a8a8b4]">
                Select a conversation to view messages
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[#e6e6eb] bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-[#e6e6eb] px-3 py-2 text-sm outline-none focus:border-blue-300"
              />
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

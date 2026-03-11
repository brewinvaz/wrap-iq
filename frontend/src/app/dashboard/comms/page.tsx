'use client';

import { useState } from 'react';

export default function CommsPage() {
  const [messageText, setMessageText] = useState('');

  function handleSend() {
    if (!messageText.trim()) return;
    alert(
      'Messaging is not available yet. This feature will be enabled once the messaging backend is configured.',
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#18181b]">Client Communications</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-[#e6e6eb] bg-white">
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#a8a8b4]">
            No conversations yet. Conversations will appear here once the messaging system is
            configured.
          </div>
        </div>

        {/* Message Area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex h-full items-center justify-center text-sm text-[#a8a8b4]">
              No messages yet. Messages will appear here once the messaging system is configured.
            </div>
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
              <button
                onClick={handleSend}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

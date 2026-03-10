'use client';

import { useState } from 'react';

interface Message {
  id: string;
  sender: string;
  initials: string;
  color: string;
  text: string;
  time: string;
  isMe: boolean;
}

interface Conversation {
  id: string;
  jobName: string;
  vehicle: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv1',
    jobName: 'Marcus Rivera — Full Body PPF',
    vehicle: '2024 BMW M4',
    lastMessage: 'Film is in, starting tomorrow AM',
    lastTime: '2:15 PM',
    unread: 2,
    messages: [
      {
        id: 'm1',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'Hey, the XPEL Ultimate Plus rolls just arrived for the M4 job. All 5 rolls accounted for.',
        time: '9:30 AM',
        isMe: false,
      },
      {
        id: 'm2',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Perfect, I\'ll start prep work this afternoon. Is Bay 1 open tomorrow?',
        time: '10:15 AM',
        isMe: true,
      },
      {
        id: 'm3',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'Bay 1 is reserved for you all day tomorrow. Client is dropping off at 7:30 AM.',
        time: '10:22 AM',
        isMe: false,
      },
      {
        id: 'm4',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Great, I\'ll be there at 7. Need to clay bar and IPA the whole car first.',
        time: '11:00 AM',
        isMe: true,
      },
      {
        id: 'm5',
        sender: 'Tony Reeves',
        initials: 'TR',
        color: 'bg-emerald-500',
        text: 'Heads up — the plotter patterns are loaded for this one. I adjusted the hood template for the M4 vents.',
        time: '1:45 PM',
        isMe: false,
      },
      {
        id: 'm6',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'Film is in, starting tomorrow AM',
        time: '2:15 PM',
        isMe: false,
      },
    ],
  },
  {
    id: 'conv2',
    jobName: 'David Park — Full Body PPF',
    vehicle: '2024 Porsche 911 GT3',
    lastMessage: 'Client wants to add ceramic coating on top',
    lastTime: '11:40 AM',
    unread: 1,
    messages: [
      {
        id: 'm7',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'David Park just called — he wants to add ceramic coating on top of the PPF. Can we accommodate?',
        time: '11:30 AM',
        isMe: false,
      },
      {
        id: 'm8',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Yes, but we\'ll need an extra day for cure time. The PPF needs 24 hours before we coat.',
        time: '11:35 AM',
        isMe: true,
      },
      {
        id: 'm9',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'Client wants to add ceramic coating on top',
        time: '11:40 AM',
        isMe: false,
      },
    ],
  },
  {
    id: 'conv3',
    jobName: 'Aisha Patel — Partial Wrap',
    vehicle: '2025 Rivian R1S',
    lastMessage: 'Rescheduled to next Friday',
    lastTime: 'Yesterday',
    unread: 0,
    messages: [
      {
        id: 'm10',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Aisha\'s R1S appointment was cancelled for Friday. Any update?',
        time: '3:00 PM',
        isMe: true,
      },
      {
        id: 'm11',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'She had a conflict. Rescheduled to next Friday same time slot.',
        time: '3:20 PM',
        isMe: false,
      },
      {
        id: 'm12',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Rescheduled to next Friday',
        time: '3:25 PM',
        isMe: true,
      },
    ],
  },
  {
    id: 'conv4',
    jobName: 'James Whitfield — Full Body PPF',
    vehicle: '2024 Audi RS6',
    lastMessage: 'Quote approved, scheduling install',
    lastTime: 'Mar 6',
    unread: 0,
    messages: [
      {
        id: 'm13',
        sender: 'Tony Reeves',
        initials: 'TR',
        color: 'bg-emerald-500',
        text: 'Whitfield quote was approved. Full body XPEL Stealth on the RS6. $7,200.',
        time: '4:10 PM',
        isMe: false,
      },
      {
        id: 'm14',
        sender: 'You',
        initials: 'ME',
        color: 'bg-blue-500',
        text: 'Nice. That RS6 is going to look incredible in matte. I\'ll need 2 full days for this one.',
        time: '4:30 PM',
        isMe: true,
      },
      {
        id: 'm15',
        sender: 'Sarah Kim',
        initials: 'SK',
        color: 'bg-violet-500',
        text: 'Quote approved, scheduling install',
        time: '4:45 PM',
        isMe: false,
      },
    ],
  },
];

export default function ChatPage() {
  const [selectedConv, setSelectedConv] = useState(MOCK_CONVERSATIONS[0].id);
  const [messageInput, setMessageInput] = useState('');

  const activeConversation = MOCK_CONVERSATIONS.find(
    (c) => c.id === selectedConv,
  )!;

  const totalUnread = MOCK_CONVERSATIONS.reduce(
    (sum, c) => sum + c.unread,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#18181b]">Job Chat</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
              {totalUnread} new
            </span>
          )}
        </div>
      </header>

      {/* Chat layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-80 shrink-0 overflow-auto border-r border-[#e6e6eb] bg-white">
          <div className="p-3">
            <p className="px-2 font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
              Conversations
            </p>
          </div>
          <div>
            {MOCK_CONVERSATIONS.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv.id)}
                className={`flex w-full flex-col gap-1 border-b border-[#e6e6eb] px-4 py-3 text-left transition-colors ${
                  selectedConv === conv.id
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`truncate text-sm font-semibold ${
                      selectedConv === conv.id
                        ? 'text-blue-700'
                        : 'text-[#18181b]'
                    }`}
                  >
                    {conv.jobName}
                  </p>
                  {conv.unread > 0 && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[#60606a]">
                  {conv.vehicle}
                </p>
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs text-[#a8a8b4]">
                    {conv.lastMessage}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-[#a8a8b4]">
                    {conv.lastTime}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message panel */}
        <div className="flex flex-1 flex-col bg-gray-50">
          {/* Conversation header */}
          <div className="shrink-0 border-b border-[#e6e6eb] bg-white px-5 py-3">
            <p className="text-sm font-semibold text-[#18181b]">
              {activeConversation.jobName}
            </p>
            <p className="text-xs text-[#60606a]">
              {activeConversation.vehicle}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-5">
            <div className="space-y-4">
              {activeConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.isMe ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${msg.color}`}
                  >
                    {msg.initials}
                  </div>
                  {/* Bubble */}
                  <div
                    className={`max-w-md rounded-lg px-4 py-2.5 ${
                      msg.isMe
                        ? 'bg-blue-600 text-white'
                        : 'border border-[#e6e6eb] bg-white text-[#18181b]'
                    }`}
                  >
                    {!msg.isMe && (
                      <p className="mb-1 text-[10px] font-semibold text-[#60606a]">
                        {msg.sender}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p
                      className={`mt-1.5 text-right font-mono text-[10px] ${
                        msg.isMe ? 'text-blue-200' : 'text-[#a8a8b4]'
                      }`}
                    >
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-[#e6e6eb] bg-white p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

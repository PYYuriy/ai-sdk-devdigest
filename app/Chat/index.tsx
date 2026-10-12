'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useLayoutEffect, useEffect } from 'react';

// Max number of visible rows before the textarea starts scrolling.
const MAX_ROWS = 8;

type AgentOption = { id: string; label: string; description: string };

// Metadata the server attaches to each assistant message (see the chat route's
// `messageMetadata` callback).
type ChatMetadata = { agentId?: string; agentLabel?: string };

export default function Chat() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [agentId, setAgentId] = useState("general");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // Load the selectable agents from the server once on mount.
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((list: AgentOption[]) => setAgents(list))
      .catch(() => setAgents([]));
  }, []);

  // Grow the textarea with its content, up to MAX_ROWS, then scroll.
  // Runs whenever `input` changes (including the reset to '' after send).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset height so scrollHeight reflects the true content height.
    el.style.height = 'auto';

    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingY =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const borderY =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const maxHeight = lineHeight * MAX_ROWS + paddingY + borderY;

    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !files) return;

    // Send the text + any attached files, and tell the server which agent
    // (system prompt + tool set) to use via extra request body.
    sendMessage(
      { text: input, files },
      { body: { agentId } }
    );

    // Reset input and file state
    setInput('');
    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Enter submits; Shift+Enter inserts a newline.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl pt-10 pb-34 mx-auto stretch">
      {messages.map(message => {
        const isUser = message.role === 'user';
        const agentLabel = (message.metadata as ChatMetadata | undefined)
          ?.agentLabel;
        const sender = isUser
          ? 'User'
          : `AI${agentLabel ? ` (${agentLabel})` : ''}`;

        return (
          <div
            key={message.id}
            className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}
          >
            {/* Sender label above the bubble */}
            <span className="mb-1 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {sender}
            </span>

            {/* Message bubble */}
            <div
              className={`whitespace-pre-wrap max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                isUser
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-sm'
              }`}
            >
              {/* Render message text parts */}
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return <div key={`${message.id}-${i}`}>{part.text}</div>;
                  case 'file':
                    return part.mediaType?.startsWith('image/') ? (
                      <img
                        key={`${message.id}-${i}`}
                        src={part.url}
                        alt={part.filename ?? 'attachment'}
                        className="mt-2 w-40 h-auto rounded border border-zinc-200 dark:border-zinc-800"
                      />
                    ) : (
                      <span
                        key={`${message.id}-${i}`}
                        className={`mt-2 inline-block text-xs px-2 py-1 rounded ${
                          isUser
                            ? 'bg-blue-500/40'
                            : 'bg-zinc-200 dark:bg-zinc-700'
                        }`}
                      >
                        📎 {part.filename ?? 'Attached File'}
                      </span>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        );
      })}

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 w-full max-w-2xl p-2 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
      >
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="mb-2 w-full text-xs p-1 border border-zinc-300 dark:border-zinc-800 rounded dark:bg-zinc-900"
        >
          {agents.length === 0 && <option value="general">General Assistant</option>}
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => setFiles(e.target.files ?? undefined)}
          className="mb-2 text-xs text-zinc-500 block"
        />
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full resize-none p-2 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl dark:bg-zinc-900"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </form>
    </div>
  );
}
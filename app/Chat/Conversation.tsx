'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useRef, useLayoutEffect, useEffect } from 'react';

// Max number of visible rows before the textarea starts scrolling.
const MAX_ROWS = 8;

type AgentOption = { id: string; label: string; description: string };

// Metadata the server attaches to each assistant message (see the chat route's
// `messageMetadata` callback).
type ChatMetadata = { agentId?: string; agentLabel?: string };

// A message is "visible" if it has any non-empty text or any file part. While
// streaming, the assistant message can exist with no renderable content yet
// (empty/whitespace text), which would otherwise show as an empty bubble.
function hasVisibleContent(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === 'text') return part.text.trim().length > 0;
    if (part.type === 'file') return true;
    return false;
  });
}

type Props = {
  // The active chat session id. Used as the useChat `id` so switching sessions
  // reinitializes the hook with that session's history.
  sessionId: string;
  initialMessages: UIMessage[];
  onPersist: (messages: UIMessage[]) => void;
};

export default function Conversation({
  sessionId,
  initialMessages,
  onPersist,
}: Props) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [agentId, setAgentId] = useState('general');
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isStreaming = status === 'submitted' || status === 'streaming';

  // Load the selectable agents from the server once on mount.
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((list: AgentOption[]) => setAgents(list))
      .catch(() => setAgents([]));
  }, []);

  // Persist the conversation whenever a turn settles (status back to 'ready')
  // and there is at least one message. Keeps the SQLite snapshot in sync.
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      persistRef.current(messages);
    }
  }, [status, messages]);

  // Auto-scroll to the newest message as the conversation grows / streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  // Grow the textarea with its content, up to MAX_ROWS, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

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
    if ((!input.trim() && !files) || isStreaming) return;

    sendMessage({ text: input, files }, { body: { agentId, sessionId } });

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

  const fileCount = files?.length ?? 0;

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pt-8 pb-48">
          {messages.length === 0 && (
            <div className="mt-24 flex flex-col items-center text-center text-zinc-500">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
                💬
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Start the conversation
              </p>
              <p className="mt-1 text-xs">
                Ask anything, or pick an assistant below.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === 'user';
            const agentLabel = (message.metadata as ChatMetadata | undefined)
              ?.agentLabel;
            const sender = isUser
              ? 'You'
              : `AI${agentLabel ? ` · ${agentLabel}` : ''}`;

            // Assistant message added but still empty while the model works:
            // show the typing indicator in place of an empty bubble.
            const showTyping =
              !isUser && isStreaming && !hasVisibleContent(message);

            return (
              <div
                key={message.id}
                className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="mb-1 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {sender}
                </span>

                <div
                  className={`whitespace-pre-wrap max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-md'
                  }`}
                >
                  {showTyping ? (
                    <span className="flex items-center gap-1.5 py-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400" />
                    </span>
                  ) : (
                    message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return <div key={`${message.id}-${i}`}>{part.text}</div>;
                      case 'file':
                        return part.mediaType?.startsWith('image/') ? (
                          <img
                            key={`${message.id}-${i}`}
                            src={part.url}
                            alt={part.filename ?? 'attachment'}
                            className="mt-2 w-40 h-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
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
                  })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/90 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90"
      >
        <div className="mx-auto w-full max-w-2xl">
          {/* Toolbar: agent picker + attach */}
          <div className="mb-2 flex items-center gap-2">
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {agents.length === 0 && (
                <option value="general">General Assistant</option>
              )}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Attach files"
            >
              📎 {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? 's' : ''}` : 'Attach'}
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => setFiles(e.target.files ?? undefined)}
              className="hidden"
            />
          </div>

          {/* Composer: textarea + send */}
          <div className="flex items-end gap-2 rounded-xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              ref={textareaRef}
              rows={1}
              className="w-full resize-none bg-transparent px-1 py-1 text-sm outline-none"
              value={input}
              placeholder="Say something…  (Enter to send, Shift+Enter for newline)"
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              disabled={isStreaming || (!input.trim() && !files)}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isStreaming ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

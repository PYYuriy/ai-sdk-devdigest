'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useLayoutEffect } from 'react';

// Max number of visible rows before the textarea starts scrolling.
const MAX_ROWS = 8;

export default function Chat() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage } = useChat();

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

    // Pass attached files alongside the text prompt
    sendMessage(
      { text: input },
      { experimental_attachments: files }
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
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-semibold">
            {message.role === 'user' ? 'User: ' : 'AI: '}
          </div>

          {/* Render message text parts */}
          {message.parts.map((part, i) => {
            switch (part.type) {
              case 'text':
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
              default:
                return null;
            }
          })}

          {/* Render sent or received attachments */}
          {message?.experimental_attachments?.map((attachment, index) => (
            <div key={index} className="mt-2">
              {attachment.contentType?.startsWith('image/') ? (
                <img
                  src={attachment.url}
                  alt={attachment.name ?? 'attachment'}
                  className="w-40 h-auto rounded border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                  📎 {attachment.name ?? 'Attached File'}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 w-full max-w-md p-2 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
      >
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
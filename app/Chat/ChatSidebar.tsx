'use client';

import { useState } from 'react';
import type { ChatSession } from './useChatHistory';

type Props = {
  sessions: ChatSession[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

/** Format "2026-10-12 12:27:35" (UTC) as a short relative time like "2h ago". */
function relativeTime(stamp: string): string {
  // SQLite datetime('now') is UTC without a timezone marker; treat it as UTC.
  const then = new Date(stamp.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function ChatSidebar({
  sessions,
  activeId,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEditing = (session: ChatSession) => {
    setEditingId(session.id);
    setDraft(session.title);
  };

  const commitEditing = () => {
    if (editingId) {
      const trimmed = draft.trim();
      if (trimmed) onRename(editingId, trimmed);
    }
    setEditingId(null);
    setDraft('');
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Header + New chat */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Chats
        </h2>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {sessions.length}
        </span>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[.99]"
        >
          <span className="text-base leading-none">+</span>
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            No chats yet. Start a new one above.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map((session) => {
            const active = session.id === activeId;
            const isEditing = editingId === session.id;
            return (
              <li key={session.id}>
                <div
                  className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditing();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setDraft('');
                        }
                      }}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelect(session.id)}
                        onDoubleClick={() => startEditing(session)}
                        className="flex min-w-0 flex-1 flex-col items-start text-left"
                        title={session.title}
                      >
                        <span className="w-full truncate font-medium">
                          {session.title}
                        </span>
                        <span
                          className={`text-[11px] ${
                            active
                              ? 'text-blue-100'
                              : 'text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {relativeTime(session.updatedAt)}
                        </span>
                      </button>

                      {/* Actions: visible on hover (pointer) and always on focus. */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEditing(session)}
                          aria-label="Rename chat"
                          title="Rename"
                          className={`rounded-md p-1 text-xs ${
                            active
                              ? 'hover:bg-blue-500'
                              : 'hover:bg-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${session.title}"?`)) {
                              onDelete(session.id);
                            }
                          }}
                          aria-label="Delete chat"
                          title="Delete"
                          className={`rounded-md p-1 text-xs ${
                            active
                              ? 'hover:bg-blue-500'
                              : 'hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400'
                          }`}
                        >
                          🗑
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

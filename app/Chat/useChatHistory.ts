'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';

export interface ChatSession {
  id: string;
  title: string;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Owns the list of chat sessions and which one is active. All persistence goes
 * through the /api/chats endpoints (SQLite-backed). The active session's
 * messages are fetched on demand via `loadMessages`.
 */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Guard so the initial bootstrap only runs once (even under StrictMode).
  const bootstrapped = useRef(false);

  const refresh = useCallback(async (): Promise<ChatSession[]> => {
    const res = await fetch('/api/chats');
    if (!res.ok) return [];
    const list = (await res.json()) as ChatSession[];
    setSessions(list);
    return list;
  }, []);

  const createSession = useCallback(async (): Promise<ChatSession | null> => {
    const res = await fetch('/api/chats', { method: 'POST' });
    if (!res.ok) return null;
    const session = (await res.json()) as ChatSession;
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    return session;
  }, []);

  // Load the session list on mount; create a first session if none exist.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      const list = await refresh();
      if (list.length > 0) {
        setActiveId(list[0].id);
      } else {
        await createSession();
      }
      setLoading(false);
    })();
  }, [refresh, createSession]);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const loadMessages = useCallback(
    async (id: string): Promise<UIMessage[]> => {
      const res = await fetch(`/api/chats/${id}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { messages: UIMessage[] };
      return data.messages ?? [];
    },
    [],
  );

  const saveMessages = useCallback(
    async (id: string, messages: UIMessage[]): Promise<void> => {
      await fetch(`/api/chats/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      // Title may have been derived server-side; refresh the list to reflect it.
      await refresh();
    },
    [refresh],
  );

  const renameSession = useCallback(
    async (id: string, title: string): Promise<void> => {
      const res = await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ChatSession;
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? updated : s)),
        );
      }
    },
    [],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) return;

      // Compute the next list and active id synchronously from current state.
      let nextActive: string | null = null;
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (activeId === id) {
          nextActive = remaining[0]?.id ?? null;
        }
        return remaining;
      });

      if (activeId === id) {
        if (nextActive) {
          setActiveId(nextActive);
        } else {
          // No sessions left — create a fresh one.
          await createSession();
        }
      }
    },
    [activeId, createSession],
  );

  return {
    sessions,
    activeId,
    loading,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    loadMessages,
    saveMessages,
  };
}

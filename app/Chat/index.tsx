'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';
import ChatSidebar from './ChatSidebar';
import Conversation from './Conversation';
import { useChatHistory } from './useChatHistory';

export default function Chat() {
  const {
    sessions,
    activeId,
    loading,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    loadMessages,
    saveMessages,
  } = useChatHistory();

  // Messages for the active session, loaded from the API. `null` means "still
  // loading"; an array (possibly empty) means loaded and ready to render.
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );

  // Load the active session's messages whenever the selection changes.
  useEffect(() => {
    if (!activeId) {
      setInitialMessages(null);
      return;
    }
    let cancelled = false;
    setInitialMessages(null);
    loadMessages(activeId).then((msgs) => {
      if (!cancelled) setInitialMessages(msgs);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, loadMessages]);

  const handlePersist = useCallback(
    (messages: UIMessage[]) => {
      if (activeId) void saveMessages(activeId, messages);
    },
    [activeId, saveMessages],
  );

  return (
    <div className="flex h-full w-full">
      <ChatSidebar
        sessions={sessions}
        activeId={activeId}
        onNew={() => void createSession()}
        onSelect={selectSession}
        onRename={(id, title) => void renameSession(id, title)}
        onDelete={(id) => void deleteSession(id)}
      />

      <div className="flex-1 overflow-hidden">
        {loading || !activeId || initialMessages === null ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Loading…
          </div>
        ) : (
          // Key by session id so useChat reinitializes with the right history
          // when switching between sessions.
          <Conversation
            key={activeId}
            sessionId={activeId}
            initialMessages={initialMessages}
            onPersist={handlePersist}
          />
        )}
      </div>
    </div>
  );
}

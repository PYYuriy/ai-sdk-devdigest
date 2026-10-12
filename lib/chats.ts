import type { Database } from 'better-sqlite3';
import type { UIMessage } from 'ai';

/** A chat session as stored in the DB / returned to the client. */
export interface ChatSession {
  id: string;
  title: string;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
}

type SessionRow = {
  id: string;
  title: string;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  message: string;
};

function rowToSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Generate a stable unique id (uuid when available, else a random fallback). */
function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** List sessions, most recently updated first. */
export function listSessions(db: Database): ChatSession[] {
  const rows = db
    .prepare(
      `SELECT id, title, agent_id, created_at, updated_at
       FROM chat_sessions
       ORDER BY datetime(updated_at) DESC, rowid DESC`,
    )
    .all() as SessionRow[];
  return rows.map(rowToSession);
}

/** Fetch a single session, or null if it doesn't exist. */
export function getSession(db: Database, id: string): ChatSession | null {
  const row = db
    .prepare(
      `SELECT id, title, agent_id, created_at, updated_at
       FROM chat_sessions WHERE id = ?`,
    )
    .get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

/** Create a new, empty session. */
export function createSession(
  db: Database,
  opts: { title?: string; agentId?: string | null } = {},
): ChatSession {
  const id = newId();
  const title = opts.title?.trim() || 'New chat';
  db.prepare(
    `INSERT INTO chat_sessions (id, title, agent_id) VALUES (?, ?, ?)`,
  ).run(id, title, opts.agentId ?? null);
  // Non-null: we just inserted it.
  return getSession(db, id) as ChatSession;
}

/** Rename a session. Returns the updated session, or null if not found. */
export function renameSession(
  db: Database,
  id: string,
  title: string,
): ChatSession | null {
  const trimmed = title.trim();
  if (!trimmed) return getSession(db, id);
  const result = db
    .prepare(
      `UPDATE chat_sessions
       SET title = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(trimmed, id);
  if (result.changes === 0) return null;
  return getSession(db, id);
}

/** Delete a session and (via cascade) its messages. Returns true if deleted. */
export function deleteSession(db: Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM chat_sessions WHERE id = ?`).run(id);
  return result.changes > 0;
}

/** Return a session's messages in order. */
export function getMessages(db: Database, sessionId: string): UIMessage[] {
  const rows = db
    .prepare(
      `SELECT message FROM chat_messages
       WHERE session_id = ?
       ORDER BY position ASC`,
    )
    .all(sessionId) as MessageRow[];
  return rows.map((r) => JSON.parse(r.message) as UIMessage);
}

/**
 * Replace all of a session's messages with the provided list (full-snapshot
 * persistence — the client sends the whole conversation after each turn). Also
 * bumps `updated_at` and derives a title from the first user message when the
 * session is still called "New chat".
 */
export function replaceMessages(
  db: Database,
  sessionId: string,
  messages: UIMessage[],
): void {
  const tx = db.transaction((msgs: UIMessage[]) => {
    db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).run(sessionId);

    const insert = db.prepare(
      `INSERT INTO chat_messages (id, session_id, position, role, message)
       VALUES (?, ?, ?, ?, ?)`,
    );
    msgs.forEach((m, i) => {
      const id = m.id || `${sessionId}-${i}`;
      insert.run(id, sessionId, i, m.role, JSON.stringify(m));
    });

    const derived = deriveTitle(msgs);
    if (derived) {
      db.prepare(
        `UPDATE chat_sessions
         SET updated_at = datetime('now'),
             title = CASE WHEN title = 'New chat' THEN ? ELSE title END
         WHERE id = ?`,
      ).run(derived, sessionId);
    } else {
      db.prepare(
        `UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`,
      ).run(sessionId);
    }
  });
  tx(messages);
}

/** Build a short title from the first user message's text parts. */
function deriveTitle(messages: UIMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return null;
  const text = firstUser.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join(' ')
    .trim();
  if (!text) return null;
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

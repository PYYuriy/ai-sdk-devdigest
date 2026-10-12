import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Define path: inside Docker, it reads from /app/data/sqlite.db
// Locally outside Docker, it falls back to ./sqlite_data/sqlite.db
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'sqlite_data', 'sqlite.db');

// better-sqlite3 creates the database file but NOT its parent directory.
// Ensure the directory exists so opening the connection doesn't throw.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

// Enforce foreign keys so chat_messages are cascade-deleted with their session.
db.pragma('foreign_keys = ON');

// Initial setup: create a sample table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`);

// Products table populated by the /products form.
// `category` and `rating` are kept nullable so the existing searchTool
// (which reads name/price/category/rating) continues to work.
// `min_temp` / `max_temp` define the suitable temperature range (°C) used by
// the product/temperature association tool.
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    price REAL NOT NULL,
    size TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT,
    rating REAL,
    min_temp REAL,
    max_temp REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration: add min_temp / max_temp to pre-existing databases that were
// created before these columns existed. SQLite has no "ADD COLUMN IF NOT
// EXISTS", so we check the table info first.
const productColumns = db
  .prepare(`PRAGMA table_info(products)`)
  .all() as Array<{ name: string }>;
const columnNames = new Set(productColumns.map((c) => c.name));

if (!columnNames.has('min_temp')) {
  db.exec(`ALTER TABLE products ADD COLUMN min_temp REAL`);
}
if (!columnNames.has('max_temp')) {
  db.exec(`ALTER TABLE products ADD COLUMN max_temp REAL`);
}

// Embeddings table for RAG (Phase 2).
// - `source`      : which document the chunk came from (e.g. file name).
// - `chunk_index` : position of the chunk within its source (0-based).
// - `chunk_text`  : the raw text that was embedded (returned as context).
// - `vector`      : the embedding as a JSON array of floats. JSON (not BLOB)
//                   keeps the store portable and trivially inspectable for a
//                   small corpus; cosine similarity is computed in JS.
// - `dim`         : vector dimension, stored so retrieval can sanity-check
//                   that the query embedding matches stored vectors.
db.exec(`
  CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    vector TEXT NOT NULL,
    dim INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Index to make per-source deletion (idempotent re-ingestion) fast.
db.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source)`);

// Chat history: a session groups a conversation; messages belong to a session.
// - `title`      : human-friendly label shown in the sidebar (derived from the
//                  first user message, or "New chat" until one is sent).
// - `agent_id`   : the agent profile the session was last using (optional).
// Timestamps are ISO-ish strings via SQLite's datetime('now') for easy sorting.
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    agent_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Messages are stored as the raw AI SDK UIMessage JSON. The `parts` array of a
// UIMessage has a flexible shape (text, file, tool calls…), so persisting the
// whole message as JSON avoids a brittle relational mapping. `position` keeps
// the original ordering stable regardless of insertion timing.
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  )
`);

// Fast lookup/ordering of a session's messages.
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, position)`,
);

export function checkpoint() {
  db.pragma('wal_checkpoint(TRUNCATE)');
}
export default db;
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

export function checkpoint() {
  db.pragma('wal_checkpoint(TRUNCATE)');
}
export default db;
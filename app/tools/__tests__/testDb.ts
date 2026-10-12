import Database from 'better-sqlite3';

/**
 * Build a fresh in-memory SQLite database with the same `products` schema the
 * app uses, so tool logic can be unit-tested without touching the real file
 * (lib/db.ts) or the network. Each call returns an isolated database.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE products (
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
  return db;
}

type SeedProduct = {
  name: string;
  country: string;
  price: number;
  size: string;
  amount: number;
  min_temp?: number | null;
  max_temp?: number | null;
};

/** Insert a batch of products; returns the db for chaining. */
export function seedProducts(
  db: Database.Database,
  products: SeedProduct[],
): Database.Database {
  const insert = db.prepare(
    `INSERT INTO products (name, country, price, size, amount, min_temp, max_temp)
     VALUES (@name, @country, @price, @size, @amount, @min_temp, @max_temp)`,
  );
  for (const p of products) {
    insert.run({
      min_temp: null,
      max_temp: null,
      ...p,
    });
  }
  return db;
}

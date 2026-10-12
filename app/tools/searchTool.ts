import { tool } from 'ai';
import { z } from 'zod';
import type { Database } from 'better-sqlite3';
import defaultDb from '@/lib/db';

// Input shape shared by the schema and the pure logic function.
export type SearchProductsArgs = {
  query?: string;
  country?: string;
  maxResults: number;
  sortBy: 'newest' | 'price' | 'name';
};

export type SearchProductsResult = {
  resultsCount: number;
  products: unknown[];
};

// Allowlist of sort options -> safe column clauses.
// Keeping this as an exported constant lets tests assert the mapping directly
// and guarantees no user-supplied string reaches the SQL ORDER BY clause.
export const SORT_COLUMNS: Record<SearchProductsArgs['sortBy'], string> = {
  price: 'price ASC',
  name: 'name ASC',
  newest: 'id DESC',
};

/**
 * Search logic with the database injected. Extracted from the tool so it can
 * be unit-tested against an in-memory DB without the AI SDK or the real file.
 */
export function searchProducts(
  db: Database,
  { query, country, maxResults, sortBy }: SearchProductsArgs,
): SearchProductsResult {
  const orderBy = SORT_COLUMNS[sortBy] ?? SORT_COLUMNS.newest;

  // Parameterised query. With no filters this returns all rows.
  let sql = 'SELECT id, name, country, price, size, amount FROM products WHERE 1=1';
  const params: (string | number)[] = [];

  if (query && query.trim()) {
    sql += ' AND name LIKE ?';
    params.push(`%${query.trim()}%`);
  }

  if (country && country.trim()) {
    sql += ' AND country = ?';
    params.push(country.trim());
  }

  sql += ` ORDER BY ${orderBy} LIMIT ?`;
  params.push(maxResults);

  const products = db.prepare(sql).all(...params);

  return {
    resultsCount: products.length,
    products,
  };
}

export const searchProductsTool = tool({
  description:
    'Search or list products stored in the database. ' +
    'Call this whenever the user asks what products exist/are known, ' +
    'or asks to find products by name or country. ' +
    'Omit "query" to return all products.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Optional search keywords matched against the product name. Omit to list everything.'),
    country: z.string().optional().describe('Filter by country'),
    maxResults: z
      .number()
      .min(1)
      .max(100)
      .default(50)
      .describe('Maximum number of results to return'),
    sortBy: z
      .enum(['newest', 'price', 'name'])
      .default('newest')
      .describe('Sort order for results'),
  }),
  execute: async (args) => searchProducts(defaultDb, args),
});

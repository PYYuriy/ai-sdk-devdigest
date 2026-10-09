import { tool } from 'ai';
import { z } from 'zod';
import db from '@/lib/db';

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
  execute: async ({ query, country, maxResults, sortBy }) => {
    // Map sort option to a safe column clause (prevents SQL injection).
    const sortColumns: Record<string, string> = {
      price: 'price ASC',
      name: 'name ASC',
      newest: 'id DESC',
    };
    const orderBy = sortColumns[sortBy] ?? 'id DESC';

    // Build a parameterized query. With no filters this returns all rows.
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
  },
});

import { tool } from 'ai';
import { z } from 'zod';
import type { Database } from 'better-sqlite3';
import defaultDb from '@/lib/db';

export type AddProductArgs = {
  name: string;
  country: string;
  price: number;
  size: string;
  amount: number;
  minTemp?: number;
  maxTemp?: number;
};

export type AddProductResult =
  | {
      success: true;
      id: number;
      product: AddProductArgs;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Insert logic with the database injected. Extracted from the tool so it can
 * be unit-tested against an in-memory DB. Optional temps default to NULL.
 */
export function addProduct(db: Database, args: AddProductArgs): AddProductResult {
  const { name, country, price, size, amount, minTemp, maxTemp } = args;
  try {
    const result = db
      .prepare(
        `INSERT INTO products (name, country, price, size, amount, min_temp, max_temp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(name, country, price, size, amount, minTemp ?? null, maxTemp ?? null);

    return {
      success: true,
      id: Number(result.lastInsertRowid),
      product: args,
      message: `Added "${name}" (${amount} × ${size}) from ${country} at ${price}.`,
    };
  } catch (err) {
    console.error('addProduct insert failed', err);
    return {
      success: false,
      error: 'Failed to save the product to the database.',
    };
  }
}

export const addProductTool = tool({
  description:
    'Add (insert) a new product into the database. ' +
    'Call this when the user asks to add, create, save, or store a product. ' +
    'All of name, country, price, size and amount are required — if any are ' +
    'missing from the request, ask the user for them before calling.',
  inputSchema: z.object({
    name: z.string().min(1).describe('Product name'),
    country: z.string().min(1).describe('Country of origin'),
    price: z.number().nonnegative().describe('Price (0 or greater)'),
    size: z.string().min(1).describe('Size, e.g. "M", "42", "small"'),
    amount: z
      .number()
      .int()
      .nonnegative()
      .describe('Quantity in stock (whole number, 0 or greater)'),
    minTemp: z
      .number()
      .optional()
      .describe('Lowest suitable temperature in °C (optional)'),
    maxTemp: z
      .number()
      .optional()
      .describe('Highest suitable temperature in °C (optional)'),
  }),
  execute: async (args) => addProduct(defaultDb, args),
});

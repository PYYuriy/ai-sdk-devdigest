import { tool } from 'ai';
import { z } from 'zod';
import db from '@/lib/db';

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
  execute: async ({ name, country, price, size, amount, minTemp, maxTemp }) => {
    console.log('[addProductTool] execute called with', {
      name,
      country,
      price,
      size,
      amount,
      minTemp,
      maxTemp,
    });
    try {
      const result = db
        .prepare(
          `INSERT INTO products (name, country, price, size, amount, min_temp, max_temp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(name, country, price, size, amount, minTemp ?? null, maxTemp ?? null);

      console.log('[addProductTool] inserted id', Number(result.lastInsertRowid));
      return {
        success: true,
        id: Number(result.lastInsertRowid),
        product: { name, country, price, size, amount, minTemp, maxTemp },
        message: `Added "${name}" (${amount} × ${size}) from ${country} at ${price}.`,
      };
    } catch (err) {
      console.error('addProductTool insert failed', err);
      return {
        success: false,
        error: 'Failed to save the product to the database.',
      };
    }
  },
});

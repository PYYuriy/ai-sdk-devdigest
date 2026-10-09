'use server';

import { z } from 'zod';
import db from '@/lib/db';

// Validation schema for the product form. Numbers arrive as strings from
// FormData, so we coerce them before validating ranges.
const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  country: z.string().trim().min(1, 'Country is required'),
  price: z.coerce.number().nonnegative('Price must be 0 or greater'),
  size: z.string().trim().min(1, 'Size is required'),
  amount: z.coerce
    .number()
    .int('Amount must be a whole number')
    .nonnegative('Amount must be 0 or greater'),
});

export type AddProductState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  errors?: Record<string, string[]>;
};

export async function addProduct(
  _prevState: AddProductState,
  formData: FormData,
): Promise<AddProductState> {
  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    country: formData.get('country'),
    price: formData.get('price'),
    size: formData.get('size'),
    amount: formData.get('amount'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please fix the highlighted fields.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, country, price, size, amount } = parsed.data;

  try {
    db.prepare(
      `INSERT INTO products (name, country, price, size, amount)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(name, country, price, size, amount);
  } catch (err) {
    console.error('Failed to insert product', err);
    return {
      status: 'error',
      message: 'Could not save the product. Please try again.',
    };
  }

  return {
    status: 'success',
    message: `Saved "${name}" (${amount} × ${size}) from ${country}.`,
  };
}

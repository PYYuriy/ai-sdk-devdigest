import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { addProduct } from '@/app/tools/databaseWriteTool';

describe('addProduct', () => {
  let db: ReturnType<typeof createTestDb>;

  const BASE_PRODUCT = {
    name: 'Sunglasses',
    country: 'Italy',
    price: 60,
    size: 'M',
    amount: 30,
  };

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts a product and returns success with the new id', () => {
    const res = addProduct(db, BASE_PRODUCT);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error('unreachable');
    expect(res.id).toBe(1);
    expect(res.message).toContain('Sunglasses');
  });

  it('stores all required fields correctly', () => {
    addProduct(db, BASE_PRODUCT);
    const row: any = db.prepare('SELECT * FROM products WHERE id = 1').get();
    expect(row).toMatchObject({
      name: 'Sunglasses',
      country: 'Italy',
      price: 60,
      size: 'M',
      amount: 30,
    });
  });

  it('stores optional temperature range', () => {
    addProduct(db, { ...BASE_PRODUCT, minTemp: 15, maxTemp: 35 });
    const row: any = db.prepare('SELECT min_temp, max_temp FROM products WHERE id = 1').get();
    expect(row.min_temp).toBe(15);
    expect(row.max_temp).toBe(35);
  });

  it('stores NULLs when temperature range is omitted', () => {
    addProduct(db, BASE_PRODUCT);
    const row: any = db.prepare('SELECT min_temp, max_temp FROM products WHERE id = 1').get();
    expect(row.min_temp).toBeNull();
    expect(row.max_temp).toBeNull();
  });

  it('auto-increments ids across multiple inserts', () => {
    const res1 = addProduct(db, BASE_PRODUCT);
    const res2 = addProduct(db, { ...BASE_PRODUCT, name: 'Hat' });
    if (!res1.success || !res2.success) throw new Error('unreachable');
    expect(res2.id).toBe(res1.id + 1);
  });

  it('returns a human-readable message with product details', () => {
    const res = addProduct(db, BASE_PRODUCT);
    if (!res.success) throw new Error('unreachable');
    expect(res.message).toMatch(/Sunglasses/);
    expect(res.message).toMatch(/Italy/);
  });
});

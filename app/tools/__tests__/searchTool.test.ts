import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedProducts } from './testDb';
import { searchProducts, SORT_COLUMNS } from '@/app/tools/searchTool';

describe('searchProducts', () => {
  let db: ReturnType<typeof createTestDb>;

  const SEED = [
    { name: 'Winter Jacket', country: 'Ukraine', price: 120, size: 'L', amount: 5 },
    { name: 'Summer T-Shirt', country: 'Spain', price: 25, size: 'M', amount: 50 },
    { name: 'Rain Coat', country: 'Ukraine', price: 80, size: 'L', amount: 12 },
    { name: 'Flip Flops', country: 'Spain', price: 10, size: '42', amount: 200 },
  ];

  beforeEach(() => {
    db = createTestDb();
    seedProducts(db, SEED);
  });

  // --- No filters ---

  it('returns all products when no filters are set', () => {
    const res = searchProducts(db, { maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(4);
    expect(res.products).toHaveLength(4);
  });

  // --- Name search ---

  it('filters products by name (LIKE, case-insensitive)', () => {
    const res = searchProducts(db, { query: 'jacket', maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(1);
    expect(res.products[0]).toMatchObject({ name: 'Winter Jacket' });
  });

  it('returns empty when name filter matches nothing', () => {
    const res = searchProducts(db, { query: 'sandals', maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(0);
  });

  // --- Country filter ---

  it('filters by country', () => {
    const res = searchProducts(db, { country: 'Spain', maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(2);
    expect(res.products.every((p: any) => p.country === 'Spain')).toBe(true);
  });

  // --- Combined filters ---

  it('combines name + country filters', () => {
    const res = searchProducts(db, {
      query: 'coat',
      country: 'Ukraine',
      maxResults: 50,
      sortBy: 'newest',
    });
    expect(res.resultsCount).toBe(1);
    expect(res.products[0]).toMatchObject({ name: 'Rain Coat', country: 'Ukraine' });
  });

  // --- maxResults ---

  it('respects maxResults limit', () => {
    const res = searchProducts(db, { maxResults: 2, sortBy: 'newest' });
    expect(res.resultsCount).toBe(2);
  });

  // --- Sorting ---

  it('sorts by price ascending', () => {
    const res = searchProducts(db, { maxResults: 50, sortBy: 'price' });
    const prices = res.products.map((p: any) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('sorts by name ascending', () => {
    const res = searchProducts(db, { maxResults: 50, sortBy: 'name' });
    const names = res.products.map((p: any) => p.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts newest first (id DESC) by default', () => {
    const res = searchProducts(db, { maxResults: 50, sortBy: 'newest' });
    const ids = res.products.map((p: any) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  // --- SORT_COLUMNS mapping ---

  it('SORT_COLUMNS covers all valid enum values', () => {
    expect(Object.keys(SORT_COLUMNS)).toEqual(
      expect.arrayContaining(['price', 'name', 'newest']),
    );
  });

  // --- Edge cases ---

  it('ignores whitespace-only query', () => {
    const res = searchProducts(db, { query: '   ', maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(4);
  });

  it('trims whitespace around country', () => {
    const res = searchProducts(db, { country: '  Spain  ', maxResults: 50, sortBy: 'newest' });
    expect(res.resultsCount).toBe(2);
  });
});

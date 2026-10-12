import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedProducts } from './testDb';
import { matchProductsForTemperature } from '@/app/tools/productTemperatureTool';

describe('matchProductsForTemperature', () => {
  let db: ReturnType<typeof createTestDb>;

  // Products with explicit temperature ranges.
  const SEED = [
    { name: 'Winter Jacket', country: 'UA', price: 120, size: 'L', amount: 5, min_temp: -20, max_temp: 5 },
    { name: 'Hoodie', country: 'UA', price: 60, size: 'M', amount: 20, min_temp: 0, max_temp: 15 },
    { name: 'T-Shirt', country: 'ES', price: 25, size: 'M', amount: 50, min_temp: 15, max_temp: 35 },
    { name: 'Shorts', country: 'ES', price: 20, size: 'L', amount: 30, min_temp: 25, max_temp: 45 },
    // No temperature range set — should never appear in results.
    { name: 'Mystery Item', country: 'XX', price: 1, size: 'S', amount: 1 },
  ];

  beforeEach(() => {
    db = createTestDb();
    seedProducts(db, SEED);
  });

  it('returns products whose range covers the given temperature', () => {
    // 10 °C -> Hoodie (0..15)
    const products = matchProductsForTemperature(db, 10);
    expect(products.map((p) => p.name)).toEqual(['Hoodie']);
  });

  it('includes a product when temperature is exactly min_temp (boundary)', () => {
    // 0 °C is Hoodie's min_temp
    const products = matchProductsForTemperature(db, 0);
    expect(products.map((p) => p.name)).toContain('Hoodie');
  });

  it('includes a product when temperature is exactly max_temp (boundary)', () => {
    // 5 °C is Winter Jacket's max_temp
    const products = matchProductsForTemperature(db, 5);
    expect(products.map((p) => p.name)).toContain('Winter Jacket');
  });

  it('returns multiple products when ranges overlap', () => {
    // 15 °C -> Hoodie (0..15) AND T-Shirt (15..35)
    const products = matchProductsForTemperature(db, 15);
    expect(products.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Hoodie', 'T-Shirt']),
    );
    expect(products).toHaveLength(2);
  });

  it('returns empty when no range covers the temperature', () => {
    // -30 °C is below every range
    const products = matchProductsForTemperature(db, -30);
    expect(products).toHaveLength(0);
  });

  it('excludes products with NULL temperature range', () => {
    // 10 °C matches Hoodie — Mystery Item must NOT appear
    const products = matchProductsForTemperature(db, 10);
    const names = products.map((p) => p.name);
    expect(names).not.toContain('Mystery Item');
  });

  it('sorts results by name ascending', () => {
    // 30 °C -> T-Shirt (15..35) and Shorts (25..45) – alphabetically Shorts < T-Shirt
    const products = matchProductsForTemperature(db, 30);
    expect(products.map((p) => p.name)).toEqual(['Shorts', 'T-Shirt']);
  });
});

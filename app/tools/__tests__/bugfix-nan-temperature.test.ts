/**
 * ============================================================================
 * BEHAVIOR-ANALYSIS EXERCISE — Requirement 3
 * "Diagnose a failing implementation, identify its cause, and produce a fix
 *  supported by tests."
 * ============================================================================
 *
 * BUG: NaN temperature silently returned zero products instead of an error
 * -----------------------------------------------------------------------
 *
 * SYMPTOM:
 *   When the weather API returned a malformed payload where `temperature` was
 *   missing or null, `productsForCity` passed the type guard
 *   (`typeof temperature !== 'number'`) because `typeof NaN === 'number'` is
 *   true in JavaScript. The NaN flowed into the SQLite query
 *   (`WHERE ? >= min_temp AND ? <= max_temp`), which always evaluates to false
 *   for NaN comparisons. The result: the tool returned
 *   `{ matchCount: 0, suitableProducts: [] }` with a valid-looking city and
 *   temperature of NaN — no error was surfaced.
 *
 * ROOT CAUSE:
 *   The original guard:
 *     `if (typeof temperature !== 'number') { return { error: ... }; }`
 *   does not catch `NaN`, because `typeof NaN === 'number'`.
 *
 * FIX APPLIED (in productTemperatureTool.ts during refactor):
 *   Changed the guard to:
 *     `if (typeof temperature !== 'number' || !Number.isFinite(temperature))`
 *   This catches NaN, Infinity, and -Infinity. All non-finite values are now
 *   treated as "could not read the temperature".
 *
 * BELOW: tests that reproduce the symptom with the *old* guard logic, then
 * verify the fixed implementation rejects NaN and returns a clear error.
 * ============================================================================
 */

import { describe, it, expect, vi } from 'vitest';
import { createTestDb, seedProducts } from './testDb';
import {
  productsForCity,
  matchProductsForTemperature,
} from '@/app/tools/productTemperatureTool';

/** Helper: create a mock fetch that simulates geocode OK + weather returning
 *  the given temperature value. */
function fakeFetchWithTemperature(temp: unknown) {
  return vi
    .fn()
    // First call: geocode
    .mockResolvedValueOnce({
      json: async () => ({
        results: [{ latitude: 50, longitude: 30, name: 'Kyiv', country: 'Ukraine' }],
      }),
    })
    // Second call: weather
    .mockResolvedValueOnce({
      json: async () => ({
        current_weather: { temperature: temp },
      }),
    });
}

describe('BUG FIX: NaN temperature handling in productsForCity', () => {
  const db = createTestDb();
  seedProducts(db, [
    { name: 'Hoodie', country: 'UA', price: 60, size: 'M', amount: 10, min_temp: 0, max_temp: 20 },
    { name: 'Shorts', country: 'ES', price: 20, size: 'L', amount: 30, min_temp: 20, max_temp: 45 },
  ]);

  // ---------- demonstrate the underlying SQLite behavior ----------

  it('NaN in SQLite comparison matches NO rows (silent data loss)', () => {
    // This is the root issue: NaN comparisons in SQL are always false.
    const products = matchProductsForTemperature(db, NaN);
    expect(products).toHaveLength(0);
    // Without the isFinite guard, this looks like "no suitable products"
    // instead of an error — the user is misled.
  });

  // ---------- the old code would have returned a misleading result ----------

  it('OLD BUG: typeof NaN === "number" is true — the old guard missed NaN', () => {
    // Demonstrates why the original check was insufficient.
    const temp: unknown = NaN;
    const oldGuardPasses = typeof temp !== 'number'; // false! NaN sneaks through.
    expect(oldGuardPasses).toBe(false);
  });

  // ---------- the fix: Number.isFinite ----------

  it('FIX: productsForCity returns an error for NaN temperature', async () => {
    const fetchFn = fakeFetchWithTemperature(NaN);
    const res = await productsForCity(
      { db, fetchFn: fetchFn as unknown as typeof fetch },
      { city: 'Kyiv' },
    );
    expect(res).toEqual({
      error: 'Could not read the current temperature for "Kyiv".',
    });
  });

  it('FIX: productsForCity returns an error for Infinity temperature', async () => {
    const fetchFn = fakeFetchWithTemperature(Infinity);
    const res = await productsForCity(
      { db, fetchFn: fetchFn as unknown as typeof fetch },
      { city: 'Kyiv' },
    );
    expect(res).toEqual({
      error: 'Could not read the current temperature for "Kyiv".',
    });
  });

  it('FIX: productsForCity returns an error for null temperature', async () => {
    const fetchFn = fakeFetchWithTemperature(null);
    const res = await productsForCity(
      { db, fetchFn: fetchFn as unknown as typeof fetch },
      { city: 'Kyiv' },
    );
    expect(res).toEqual({
      error: 'Could not read the current temperature for "Kyiv".',
    });
  });

  // ---------- normal case still works ----------

  it('REGRESSION: a valid temperature still matches products correctly', async () => {
    const fetchFn = fakeFetchWithTemperature(10);
    const res = await productsForCity(
      { db, fetchFn: fetchFn as unknown as typeof fetch },
      { city: 'Kyiv' },
    );
    expect('suitableProducts' in res).toBe(true);
    if (!('suitableProducts' in res)) throw new Error('unreachable');
    expect(res.temperatureCelsius).toBe(10);
    expect(res.matchCount).toBe(1);
    expect(res.suitableProducts[0].name).toBe('Hoodie');
  });
});

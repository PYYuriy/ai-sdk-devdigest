import { describe, it, expect, vi } from 'vitest';
import {
  withToolErrorHandling,
  isToolErrorResult,
} from '@/app/tools/withToolErrorHandling';
import { getWeather } from '@/app/tools/weatherTool';
import { productsForCity } from '@/app/tools/productTemperatureTool';
import { createTestDb, seedProducts } from './testDb';

describe('withToolErrorHandling', () => {
  it('passes through a successful result unchanged', async () => {
    const wrapped = withToolErrorHandling('ok', async () => ({ value: 42 }));
    const res = await wrapped({});
    expect(res).toEqual({ value: 42 });
  });

  it('converts a thrown Error into a structured error result', async () => {
    const wrapped = withToolErrorHandling('boom', async () => {
      throw new Error('network down');
    });
    const res = await wrapped({});
    expect(isToolErrorResult(res)).toBe(true);
    if (!isToolErrorResult(res)) throw new Error('unreachable');
    expect(res.success).toBe(false);
    expect(res.cause).toBe('exception');
    expect(res.error).toContain('network down');
    expect(res.error).toContain('boom');
  });

  it('does not throw even when the executor rejects', async () => {
    const wrapped = withToolErrorHandling('reject', async () => {
      throw 'string failure';
    });
    await expect(wrapped({})).resolves.toBeDefined();
  });
});

describe('weather tool fetch failures (via injected fetch)', () => {
  it('wrapper returns structured error when the weather API is unreachable', async () => {
    // Simulate the external service being down: fetch rejects.
    const failingFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const wrapped = withToolErrorHandling('weather', async (args: any) =>
      getWeather(failingFetch as unknown as typeof fetch, args),
    );

    const res = await wrapped({ city: 'Kyiv', unit: 'celsius' });

    expect(isToolErrorResult(res)).toBe(true);
    if (!isToolErrorResult(res)) throw new Error('unreachable');
    expect(res.error).toContain('ECONNREFUSED');
  });

  it('returns a soft error (not an exception) when the city is not found', async () => {
    const okButEmpty = vi.fn().mockResolvedValue({
      json: async () => ({ results: [] }),
    });
    const res = await getWeather(okButEmpty as unknown as typeof fetch, {
      city: 'Nowhereville',
      unit: 'celsius',
    });
    expect(res).toEqual({ error: 'City Nowhereville not found' });
  });
});

describe('productsForCity fetch failures (via injected fetch)', () => {
  it('wrapper returns structured error when geocoding throws', async () => {
    const db = createTestDb();
    const failingFetch = vi.fn().mockRejectedValue(new Error('DNS failure'));
    const wrapped = withToolErrorHandling('productsForCity', async (args: any) =>
      productsForCity({ db, fetchFn: failingFetch as unknown as typeof fetch }, args),
    );

    const res = await wrapped({ city: 'Kyiv' });

    expect(isToolErrorResult(res)).toBe(true);
    if (!isToolErrorResult(res)) throw new Error('unreachable');
    expect(res.error).toContain('DNS failure');
  });

  it('returns a soft error when the temperature is missing', async () => {
    const db = createTestDb();
    seedProducts(db, [
      { name: 'Hoodie', country: 'UA', price: 60, size: 'M', amount: 10, min_temp: 0, max_temp: 15 },
    ]);

    // Geocode succeeds, but the weather payload has no temperature.
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ results: [{ latitude: 50, longitude: 30, name: 'Kyiv', country: 'Ukraine' }] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ current_weather: {} }),
      });

    const res = await productsForCity(
      { db, fetchFn: fetchFn as unknown as typeof fetch },
      { city: 'Kyiv' },
    );
    expect(res).toEqual({ error: 'Could not read the current temperature for "Kyiv".' });
  });
});

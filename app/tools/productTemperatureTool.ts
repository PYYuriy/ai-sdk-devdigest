import { tool } from 'ai';
import { z } from 'zod';
import type { Database } from 'better-sqlite3';
import defaultDb from '@/lib/db';
import { withToolErrorHandling } from '@/app/tools/withToolErrorHandling';

export type ProductRow = {
  id: number;
  name: string;
  country: string;
  price: number;
  size: string;
  amount: number;
  min_temp: number | null;
  max_temp: number | null;
};

export type ProductsForCityArgs = { city: string };

export type ProductsForCityResult =
  | { error: string }
  | {
      city: string;
      country: string;
      temperatureCelsius: number;
      matchCount: number;
      suitableProducts: ProductRow[];
    };

// Dependencies injected into the logic so tests can supply an in-memory DB and
// a fake fetch instead of hitting the network.
export type ProductsForCityDeps = {
  db: Database;
  fetchFn: typeof fetch;
};

/**
 * Query products from the DB whose suitable temperature range covers the
 * given temperature. Rows with a NULL range are excluded. Pure DB logic,
 * separated so the range-matching can be tested without any network calls.
 */
export function matchProductsForTemperature(
  db: Database,
  temperature: number,
): ProductRow[] {
  return db
    .prepare(
      `SELECT id, name, country, price, size, amount, min_temp, max_temp
       FROM products
       WHERE min_temp IS NOT NULL
         AND max_temp IS NOT NULL
         AND ? >= min_temp
         AND ? <= max_temp
       ORDER BY name ASC`,
    )
    .all(temperature, temperature) as ProductRow[];
}

/**
 * Full "products for a city" logic: geocode the city, read its current
 * temperature, then match products. `db` and `fetchFn` are injected.
 */
export async function productsForCity(
  { db, fetchFn }: ProductsForCityDeps,
  { city }: ProductsForCityArgs,
): Promise<ProductsForCityResult> {
  // 1. Geocode the city -> coordinates (Open-Meteo, same as weatherTool).
  const geoRes = await fetchFn(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
  );
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    return { error: `City "${city}" not found.` };
  }

  const { latitude, longitude, name, country } = geoData.results[0];

  // 2. Fetch the current temperature in Celsius.
  const weatherRes = await fetchFn(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
  );
  const weatherData = await weatherRes.json();
  const temperature: number | undefined = weatherData.current_weather?.temperature;

  // Guard against both a missing value AND NaN (JSON null parses to a number
  // in some upstream shapes; NaN would silently match no rows and hide the
  // real failure). Treat anything non-finite as "could not read".
  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
    return { error: `Could not read the current temperature for "${name}".` };
  }

  // 3. Match products whose suitable range covers the current temperature.
  const products = matchProductsForTemperature(db, temperature);

  return {
    city: name,
    country,
    temperatureCelsius: temperature,
    matchCount: products.length,
    suitableProducts: products,
  };
}

export const productsForCityTool = tool({
  description:
    'Given a CITY, find which products are suitable for its current weather. ' +
    'Call this when the user asks which products can be used/worn for a city ' +
    'or country based on temperature. If the user names a country, ask them ' +
    'for a specific city first. Returns products whose suitable temperature ' +
    'range (min_temp..max_temp, in °C) covers the current temperature.',
  inputSchema: z.object({
    city: z.string().min(1).describe('City name to look up the current temperature for'),
  }),
  execute: withToolErrorHandling('productsForCity', async ({ city }) =>
    productsForCity({ db: defaultDb, fetchFn: fetch }, { city }),
  ),
});

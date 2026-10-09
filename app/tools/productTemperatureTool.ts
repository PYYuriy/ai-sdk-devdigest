import { tool } from 'ai';
import { z } from 'zod';
import db from '@/lib/db';

type ProductRow = {
  id: number;
  name: string;
  country: string;
  price: number;
  size: string;
  amount: number;
  min_temp: number | null;
  max_temp: number | null;
};

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
  execute: async ({ city }) => {
    // 1. Geocode the city -> coordinates (Open-Meteo, same as weatherTool).
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return { error: `City "${city}" not found.` };
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    // 2. Fetch the current temperature in Celsius.
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
    );
    const weatherData = await weatherRes.json();
    const temperature: number | undefined = weatherData.current_weather?.temperature;

    if (typeof temperature !== 'number') {
      return { error: `Could not read the current temperature for "${name}".` };
    }

    // 3. Match products whose suitable range covers the current temperature.
    //    Rows missing a range (NULL) are excluded from matching.
    const products = db
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

    return {
      city: name,
      country,
      temperatureCelsius: temperature,
      matchCount: products.length,
      suitableProducts: products,
    };
  },
});

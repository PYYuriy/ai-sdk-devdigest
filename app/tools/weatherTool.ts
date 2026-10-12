import { tool } from 'ai';
import { z } from 'zod';
import { withToolErrorHandling } from '@/app/tools/withToolErrorHandling';

export type WeatherArgs = {
  city: string;
  unit: 'celsius' | 'fahrenheit';
};

export type WeatherResult =
  | { error: string }
  | {
      city: string;
      temperature: number | undefined;
      windspeed: number | undefined;
      unit: 'celsius' | 'fahrenheit';
    };

/**
 * Weather lookup logic with `fetchFn` injected so tests can simulate the
 * external API being down (reject) or returning unexpected shapes.
 */
export async function getWeather(
  fetchFn: typeof fetch,
  { city, unit }: WeatherArgs,
): Promise<WeatherResult> {
  // 1. Resolve city name -> coordinates.
  const geoRes = await fetchFn(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
  );
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    return { error: `City ${city} not found` };
  }

  const { latitude, longitude, name } = geoData.results[0];

  // 2. Fetch current weather for those coordinates.
  const tempUnitParam = unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
  const weatherRes = await fetchFn(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true${tempUnitParam}`,
  );
  const weatherData = await weatherRes.json();

  return {
    city: name,
    temperature: weatherData.current_weather?.temperature,
    windspeed: weatherData.current_weather?.windspeed,
    unit,
  };
}

export const weatherTool = tool({
  description: 'Get current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
      .describe('Temperature unit'),
  }),
  execute: withToolErrorHandling('weather', async (args) => getWeather(fetch, args)),
});
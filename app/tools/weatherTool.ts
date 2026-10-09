import { tool } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
      .describe('Temperature unit'),
  }),
  execute: async ({ city, unit }) => {
    // 1. Отримуємо координати міста
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return { error: `City ${city} not found` };
    }

    const { latitude, longitude, name } = geoData.results[0];

    // 2. Запитуємо погоду за координатами
    const tempUnitParam = unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true${tempUnitParam}`
    );
    const weatherData = await weatherRes.json();
    console.log('weatherData', weatherData)
    return {
      city: name,
      temperature: weatherData.current_weather?.temperature,
      windspeed: weatherData.current_weather?.windspeed,
      unit,
    };
  },
});
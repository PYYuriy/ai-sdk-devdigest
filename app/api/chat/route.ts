import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
} from 'ai';
import { ollama, QWEN_3_5_35B } from "@/app/ollama";
import { weatherTool } from "@/app/tools/weatherTool";
import { searchProductsTool } from "@/app/tools/searchTool";
import { addProductTool } from "@/app/tools/databaseWriteTool";
import { productsForCityTool } from "@/app/tools/productTemperatureTool";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: ollama.chat(QWEN_3_5_35B),
    system:
      'You are a helpful assistant. Use the provided tools when asked for real-time information. ' +
      'When the user asks what products you know, which products exist, or to find/list products, ' +
      'call the searchProducts tool (omit its query to list all products) and summarise the returned products. ' +
      'When the user asks to add, create, save or store a product, call the addProduct tool. ' +
      'If any of name, country, price, size or amount is missing, ask the user for it before calling addProduct. ' +
      'When the user asks which products suit a city or country based on temperature/weather, call the ' +
      'productsForCity tool with a city. If the user gives only a country, ask them for a specific city first. ' +
      'Provide a friendly conversational answer once tool results are received.',
    messages: await convertToModelMessages(messages),
    tools: {
      weather: weatherTool,
      searchProducts: searchProductsTool,
      addProduct: addProductTool,
      productsForCity: productsForCityTool,
    },
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
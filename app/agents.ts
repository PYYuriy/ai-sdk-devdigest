import { ollama, QWEN_3_5_35B } from "@/app/ollama";
import { weatherTool } from "@/app/tools/weatherTool";
import { searchProductsTool } from "@/app/tools/searchTool";
import { addProductTool } from "@/app/tools/databaseWriteTool";
import { productsForCityTool } from "@/app/tools/productTemperatureTool";
import { ragSearchTool } from "@/app/tools/ragSearchTool";
import { chaosTool } from "@/app/tools/chaosTool";

// The full registry of tools the app knows about.
const ALL_TOOLS = {
  weather: weatherTool,
  searchProducts: searchProductsTool,
  addProduct: addProductTool,
  productsForCity: productsForCityTool,
  chaos: chaosTool,
  ragSearch: ragSearchTool,
} as const;

export type ToolName = keyof typeof ALL_TOOLS;

export interface AgentProfile {
  id: string;
  label: string;
  description: string;
  model: Parameters<typeof ollama.chat>[0];
  system: string;
  toolNames: ToolName[];
}

export const AGENTS = {
  general: {
    id: "general",
    label: "General Assistant",
    description: "All tools available.",
    model: QWEN_3_5_35B,
    system:
      "You are a helpful assistant. Use the provided tools when asked for real-time information. " +
      "Provide a friendly conversational answer once tool results are received.",
    toolNames: ["weather", "searchProducts", "addProduct", "productsForCity", "chaos", "ragSearch"],
  },
  catalog: {
    id: "catalog",
    label: "Product Catalog",
    description: "Search, add, and recommend products.",
    model: QWEN_3_5_35B,
    system:
      "You manage the product catalog. " +
      "Call searchProducts to list/find products (omit query to list all). " +
      "Call addProduct to create a product; if name, country, price, size or amount is missing, ask first. " +
      "Call productsForCity to recommend products for a city by temperature.",
    toolNames: ["searchProducts", "addProduct", "productsForCity", "weather"],
  },
  docs: {
    id: "docs",
    label: "Docs / RAG",
    description: "Answers from the DevDigest corpus only.",
    model: QWEN_3_5_35B,
    system:
      "You answer questions about the DevDigest project using the ragSearch tool. " +
      "Always base answers on retrieved chunks and cite the source file names. " +
      "If retrieval returns nothing relevant, say so instead of guessing.",
    toolNames: ["ragSearch"],
  },
} satisfies Record<string, AgentProfile>;

export type AgentId = keyof typeof AGENTS;

export const DEFAULT_AGENT: AgentId = "general";

/** Build the tool object for an agent from its allow-list. */
export function toolsForAgent(agent: AgentProfile) {
  return Object.fromEntries(
    agent.toolNames.map((name) => [name, ALL_TOOLS[name]]),
  );
}

export function resolveAgent(id: string | undefined): AgentProfile {
  if (id && id in AGENTS) return AGENTS[id as AgentId];
  return AGENTS[DEFAULT_AGENT];
}
// app/api/agents/route.ts
import { AGENTS } from "@/app/agents";

export function GET() {
  const list = Object.values(AGENTS).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
  return Response.json(list);
}
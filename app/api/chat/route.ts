import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
} from "ai";
import { ollama } from "@/app/ollama";
import { resolveAgent, toolsForAgent } from "@/app/agents";

export async function POST(req: Request) {
  const { messages, agentId }: { messages: UIMessage[]; agentId?: string } =
    await req.json();

  const agent = resolveAgent(agentId);

  const result = streamText({
    model: ollama.chat(agent.model),
    system: agent.system,
    messages: await convertToModelMessages(messages),
    tools: toolsForAgent(agent),
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // Tag the assistant message with the agent that produced it, so the UI
      // can show which agent answered. Emitted on the `start` part so the
      // label is available before any text streams in.
      messageMetadata: ({ part }) =>
        part.type === 'start'
          ? { agentId: agent.id, agentLabel: agent.label }
          : undefined,
    }),
  });
}
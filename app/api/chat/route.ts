import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
} from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { ollama } from "@/app/ollama";
import { resolveAgent, toolsForAgent } from "@/app/agents";

export async function POST(req: Request) {
  const {
    messages,
    agentId,
    sessionId,
  }: { messages: UIMessage[]; agentId?: string; sessionId?: string } =
    await req.json();

  const agent = resolveAgent(agentId);

  const modelMessages = await convertToModelMessages(messages);

  // Wrap the model call in a Langfuse trace so the resulting observations are
  // grouped and labelled (Langfuse best-practices: descriptive, low-cardinality
  // names; dynamic values go in metadata/tags, not names).
  //
  //  - `traceName`/`functionId` are static ("chat-turn") so dashboards,
  //    evaluators, and saved filters that target the name keep matching even as
  //    the agent/model change.
  //  - `sessionId` groups each turn into one conversation in the Sessions view
  //    (the chat endpoint receives a message array → best-practices says add it).
  //  - the dynamic agent id/label live in a `feature` tag + metadata.
  //  - `environment` keeps dev traces out of production dashboards.
  //
  // These attributes are what let the dashboards answer "which model is
  // fastest?", "which prompts cost the most?" (tokens/latency for a local
  // model), and "where is latency coming from?" — model vs. tool/retriever
  // observations nested under this trace.
  const result = propagateAttributes(
    {
      traceName: "chat-turn",
      ...(sessionId ? { sessionId } : {}),
      tags: ["chat", `agent:${agent.id}`],
      metadata: {
        agentId: agent.id,
        agentLabel: agent.label,
      },
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    },
    () =>
      streamText({
        model: ollama.chat(agent.model),
        system: agent.system,
        messages: modelMessages,
        tools: toolsForAgent(agent),
        stopWhen: isStepCount(5),
        telemetry: {
          functionId: "chat-turn",
        },
      }),
  );

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
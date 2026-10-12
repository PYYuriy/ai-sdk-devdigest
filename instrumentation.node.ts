/**
 * Node-runtime OpenTelemetry bootstrap for Langfuse.
 *
 * This file is imported only from `instrumentation.ts` when
 * `process.env.NEXT_RUNTIME === 'nodejs'`, because `@opentelemetry/sdk-node`
 * and the Langfuse span processor are not Edge-compatible.
 *
 * What it does:
 *  1. Starts a `NodeSDK` whose only span processor is the `LangfuseSpanProcessor`,
 *     which ships spans to Langfuse (self-hosted or cloud, via LANGFUSE_* env vars).
 *  2. Registers the AI SDK 7 telemetry integration so every `streamText` /
 *     `generateText` call emits model/token/latency spans automatically — no
 *     per-call flag required. Tool calls (including `ragSearch`) are nested
 *     under the model span, which is what makes "where is latency coming from"
 *     answerable.
 *  3. Flushes pending spans on shutdown so nothing is lost on exit.
 *
 * Credentials and endpoint are read from the environment by the Langfuse
 * span processor (see `.env.example`): LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
 * LANGFUSE_BASE_URL.
 */
import { registerTelemetry } from 'ai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Keep a reference so we can force-flush on shutdown.
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

sdk.start();

// AI SDK 7 uses a callback-based telemetry system: once the Langfuse
// integration is registered, AI SDK operations are traced by default.
registerTelemetry(new LangfuseVercelAiSdkIntegration());

// Best-effort flush so in-flight spans are exported before the process exits
// (important for short-lived/serverless-style invocations).
const shutdown = async () => {
  try {
    await langfuseSpanProcessor.forceFlush();
    await sdk.shutdown();
  } catch (err) {
    console.error('[instrumentation] error during OTel shutdown:', err);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

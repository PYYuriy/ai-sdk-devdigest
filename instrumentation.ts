/**
 * Next.js instrumentation entrypoint.
 *
 * Next.js calls the exported `register()` once per server instance, before any
 * request is handled. We use it to start OpenTelemetry tracing and wire the
 * Langfuse exporter + the AI SDK 7 telemetry integration.
 *
 * The OpenTelemetry NodeSDK is NOT compatible with the Edge runtime, so the
 * actual SDK bootstrap lives in `instrumentation.node.ts` and is imported only
 * when running under the Node.js runtime (`NEXT_RUNTIME === 'nodejs'`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}

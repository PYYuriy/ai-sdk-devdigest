/**
 * Shared error-handling wrapper for AI SDK tool `execute` functions.
 *
 * Why this exists:
 * A tool's `execute` runs inside the model's tool-call loop. If it *throws*
 * (e.g. an external `fetch` rejects, or the DB is unavailable), the thrown
 * error propagates up and aborts the whole streamed response — the user just
 * sees the stream die. By catching here and returning a *structured* error
 * object instead, the model receives a normal tool result it can read and
 * explain ("I couldn't reach the weather service"), and the stream survives.
 *
 * It deliberately preserves "soft" errors: tools that already return
 * `{ error: '...' }` for expected cases (city not found) are passed through
 * untouched — we only convert *thrown* exceptions.
 */

export type ToolErrorResult = {
  success: false;
  error: string;
  /** Short machine-readable cause, useful in tests and logs. */
  cause: 'exception';
};

export function isToolErrorResult(value: unknown): value is ToolErrorResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ToolErrorResult).success === false &&
    (value as ToolErrorResult).cause === 'exception'
  );
}

/**
 * Wrap an async tool executor so thrown errors become a structured result.
 *
 * @param label        Human-readable tool name, used in the error message.
 * @param execute      The original tool execute function.
 */
export function withToolErrorHandling<TArgs, TResult>(
  label: string,
  execute: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult | ToolErrorResult> {
  return async (args: TArgs) => {
    try {
      return await execute(args);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Logged server-side for debugging; the model only sees the clean message.
      console.error(`[tool:${label}] execution failed:`, err);
      return {
        success: false,
        error: `The "${label}" tool failed: ${detail}`,
        cause: 'exception',
      };
    }
  };
}

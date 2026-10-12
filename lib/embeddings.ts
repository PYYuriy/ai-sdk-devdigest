/**
 * Embedding client backed by Ollama's `nomic-embed-text` model.
 *
 * Uses the native Ollama HTTP API (`/api/embeddings`) directly rather than the
 * AI SDK provider, because we only need raw vectors here and want the ingestion
 * script + retrieval to share one small, dependency-light function.
 */

export const EMBEDDING_MODEL = 'nomic-embed-text';

// nomic-embed-text produces 768-dimensional vectors. Stored alongside each
// vector so retrieval can detect a model/dimension mismatch early.
export const EMBEDDING_DIM = 768;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Embed a single piece of text into a vector.
 * `fetchFn` is injectable so tests can run without a live Ollama server.
 */
export async function embedText(
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<number[]> {
  const res = await fetchFn(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(
      `Embedding request failed: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding response did not contain a vector.');
  }
  return data.embedding;
}

/**
 * Embed many texts sequentially. Kept sequential on purpose: a local Ollama
 * instance serialises these anyway, and sequential calls keep memory and load
 * predictable for a small corpus. Returns vectors in input order.
 */
export async function embedBatch(
  texts: string[],
  fetchFn: typeof fetch = fetch,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const text of texts) {
    vectors.push(await embedText(text, fetchFn));
  }
  return vectors;
}

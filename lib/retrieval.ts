/**
 * Retrieval for RAG: cosine-similarity search over stored embeddings.
 *
 * The cosine math is a pure function (easy to unit-test with fixed vectors).
 * `retrieve` wires it to the SQLite embeddings table and the Ollama embedder,
 * both injectable so the ranking can be tested without a live model/server.
 */

import type { Database } from 'better-sqlite3';
import { embedText, EMBEDDING_DIM } from '@/lib/embeddings';
import { startActiveObservation } from '@langfuse/tracing';

/**
 * Cosine similarity of two equal-length vectors.
 * Returns a value in [-1, 1]; 1 = identical direction, 0 = orthogonal,
 * -1 = opposite. Returns 0 if either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export type StoredEmbedding = {
  id: number;
  source: string;
  chunk_index: number;
  chunk_text: string;
  vector: string; // JSON array
  dim: number;
};

export type RetrievedChunk = {
  id: number;
  source: string;
  chunkIndex: number;
  text: string;
  score: number;
};

export type RetrieveOptions = {
  /** Maximum number of chunks to return. Default 4. */
  topK?: number;
  /**
   * Context-limit guard: maximum total characters across returned chunks.
   * Chunks are added in score order until this budget is exhausted. Default 2000.
   */
  maxContextChars?: number;
  /** Minimum similarity score to include a chunk. Default 0 (no floor). */
  minScore?: number;
};

const RETRIEVE_DEFAULTS: Required<RetrieveOptions> = {
  topK: 4,
  maxContextChars: 2000,
  minScore: 0,
};

/**
 * Rank already-embedded candidates against a query vector, then apply the
 * topK + character-budget caps. Pure (no DB/network), so ranking is testable.
 */
export function rankByCosine(
  queryVector: number[],
  candidates: StoredEmbedding[],
  options: RetrieveOptions = {},
): RetrievedChunk[] {
  const { topK, maxContextChars, minScore } = { ...RETRIEVE_DEFAULTS, ...options };

  const scored = candidates
    .map((row) => ({
      id: row.id,
      source: row.source,
      chunkIndex: row.chunk_index,
      text: row.chunk_text,
      score: cosineSimilarity(queryVector, JSON.parse(row.vector) as number[]),
    }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score);

  // Apply topK first, then the character budget (context-limit handling):
  // keep adding the highest-scoring chunks until the budget would overflow.
  const selected: RetrievedChunk[] = [];
  let usedChars = 0;
  for (const chunk of scored.slice(0, topK)) {
    if (usedChars + chunk.text.length > maxContextChars && selected.length > 0) {
      break;
    }
    selected.push(chunk);
    usedChars += chunk.text.length;
  }
  return selected;
}

/**
 * Full retrieval: embed the query, load candidate vectors from the DB, rank
 * and cap them. `db` and `fetchFn` are injected for testability.
 */
export async function retrieve(
  db: Database,
  query: string,
  options: RetrieveOptions = {},
  fetchFn: typeof fetch = fetch,
): Promise<RetrievedChunk[]> {
  // Trace retrieval as a Langfuse `retriever`-typed observation (not a generic
  // span) so it is correctly classified in the trace tree and Agent Graph, and
  // RAG latency is separable from the model/tool spans. Per Langfuse
  // best-practices, the observation carries meaningful input (the query) and
  // output (the retrieved chunks), with run-specific counts in metadata.
  //
  // When no Langfuse/OTel SDK is registered (e.g. unit tests), the tracing API
  // is a no-op, so this adds no behavioural change — the observation simply
  // isn't exported.
  return startActiveObservation(
    'retrieve-context',
    async (retriever) => {
      const { topK = RETRIEVE_DEFAULTS.topK } = options;
      retriever.update({ input: query });

      const queryVector = await embedText(query, fetchFn);

      if (queryVector.length !== EMBEDDING_DIM) {
        throw new Error(
          `Query embedding dimension ${queryVector.length} != expected ${EMBEDDING_DIM}`,
        );
      }

      const candidates = db
        .prepare(
          `SELECT id, source, chunk_index, chunk_text, vector, dim FROM embeddings`,
        )
        .all() as StoredEmbedding[];

      const results = rankByCosine(queryVector, candidates, options);

      retriever.update({
        // Output: what the retriever returned — source + score per chunk,
        // readable at a glance in the UI (full text stays in the tool result).
        output: results.map((c) => ({ source: c.source, score: c.score })),
        metadata: {
          topK,
          candidateCount: candidates.length,
          resultCount: results.length,
        },
      });

      return results;
    },
    { asType: 'retriever' },
  );
}

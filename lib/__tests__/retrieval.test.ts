import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  cosineSimilarity,
  rankByCosine,
  retrieve,
  type StoredEmbedding,
} from '@/lib/retrieval';
import { EMBEDDING_DIM } from '@/lib/embeddings';

describe('cosineSimilarity (fixed vectors)', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('is 1 for same-direction scaled vectors', () => {
    expect(cosineSimilarity([1, 0], [5, 0])).toBeCloseTo(1, 10);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 10);
  });

  it('returns 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});

// Helper to build a StoredEmbedding row with a given vector.
function row(id: number, text: string, vector: number[]): StoredEmbedding {
  return {
    id,
    source: 'test.md',
    chunk_index: id,
    chunk_text: text,
    vector: JSON.stringify(vector),
    dim: vector.length,
  };
}

describe('rankByCosine (ranking + caps)', () => {
  const candidates: StoredEmbedding[] = [
    row(1, 'exact match', [1, 0, 0]),
    row(2, 'orthogonal', [0, 1, 0]),
    row(3, 'near match', [0.9, 0.1, 0]),
    row(4, 'opposite', [-1, 0, 0]),
  ];

  it('ranks the most similar chunk first', () => {
    const result = rankByCosine([1, 0, 0], candidates, { topK: 4, maxContextChars: 10000 });
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3); // near match second
  });

  it('respects topK', () => {
    const result = rankByCosine([1, 0, 0], candidates, { topK: 2, maxContextChars: 10000 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it('applies minScore floor', () => {
    const result = rankByCosine([1, 0, 0], candidates, {
      topK: 4,
      maxContextChars: 10000,
      minScore: 0.5,
    });
    // Only exact (1.0) and near (~0.994) pass the 0.5 floor.
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it('caps total context by maxContextChars (context-limit handling)', () => {
    const big = [
      row(1, 'A'.repeat(100), [1, 0, 0]),
      row(2, 'B'.repeat(100), [0.9, 0.1, 0]),
      row(3, 'C'.repeat(100), [0.8, 0.2, 0]),
    ];
    // Budget fits ~1.5 chunks -> only the top chunk should be kept
    // (second would overflow 120 and at least one is already selected).
    const result = rankByCosine([1, 0, 0], big, { topK: 3, maxContextChars: 120 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('always returns at least the top chunk even if it exceeds the budget', () => {
    const big = [row(1, 'Z'.repeat(500), [1, 0, 0])];
    const result = rankByCosine([1, 0, 0], big, { topK: 3, maxContextChars: 100 });
    expect(result).toHaveLength(1);
  });
});

describe('retrieve (DB + injected embedder)', () => {
  function makeDb() {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        vector TEXT NOT NULL,
        dim INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    return db;
  }

  // Build a padded vector of EMBEDDING_DIM so the dimension check passes.
  function padVec(lead: number[]): number[] {
    const v = new Array(EMBEDDING_DIM).fill(0);
    for (let i = 0; i < lead.length; i++) v[i] = lead[i];
    return v;
  }

  it('embeds the query and returns the best-matching chunk', async () => {
    const db = makeDb();
    const insert = db.prepare(
      `INSERT INTO embeddings (source, chunk_index, chunk_text, vector, dim)
       VALUES (?, ?, ?, ?, ?)`,
    );
    insert.run('a.md', 0, 'about cats', JSON.stringify(padVec([1, 0, 0])), EMBEDDING_DIM);
    insert.run('a.md', 1, 'about dogs', JSON.stringify(padVec([0, 1, 0])), EMBEDDING_DIM);

    // Fake embedder: query vector points at the "cats" chunk.
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: padVec([1, 0, 0]) }),
    });

    const result = await retrieve(
      db,
      'tell me about cats',
      { topK: 1 },
      fakeFetch as unknown as typeof fetch,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('about cats');
    expect(result[0].score).toBeCloseTo(1, 6);
  });

  it('throws if the query embedding has the wrong dimension', async () => {
    const db = makeDb();
    const badFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }), // wrong dim
    });
    await expect(
      retrieve(db, 'q', {}, badFetch as unknown as typeof fetch),
    ).rejects.toThrow(/dimension/);
  });
});

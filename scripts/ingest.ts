/**
 * Corpus ingestion script.
 *
 * Reads every markdown file under `corpus/`, splits each into overlapping
 * chunks, embeds every chunk with Ollama's nomic-embed-text, and stores the
 * vectors in the SQLite `embeddings` table.
 *
 * Idempotent: for each source file it deletes existing rows before inserting
 * fresh ones, so re-running never creates duplicates.
 *
 * Run with: npm run ingest
 */

import fs from 'fs';
import path from 'path';
import db, { checkpoint } from '@/lib/db';
import { chunkText } from '@/lib/chunk';
import { embedText, EMBEDDING_DIM } from '@/lib/embeddings';

const CORPUS_DIR = path.join(process.cwd(), 'corpus');

async function ingestFile(fileName: string): Promise<number> {
  const fullPath = path.join(CORPUS_DIR, fileName);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const chunks = chunkText(raw, { maxChars: 800, overlap: 100 });

  // Idempotent: clear any previous rows for this source first.
  db.prepare('DELETE FROM embeddings WHERE source = ?').run(fileName);

  const insert = db.prepare(
    `INSERT INTO embeddings (source, chunk_index, chunk_text, vector, dim)
     VALUES (?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const vector = await embedText(chunks[i]);
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `Unexpected embedding dimension ${vector.length} for ${fileName} chunk ${i}`,
      );
    }
    insert.run(fileName, i, chunks[i], JSON.stringify(vector), vector.length);
    inserted++;
  }

  console.log(`  ${fileName}: ${inserted} chunk(s) embedded`);
  return inserted;
}

async function main() {
  if (!fs.existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.error('No .md files found in corpus/.');
    process.exit(1);
  }

  console.log(`Ingesting ${files.length} file(s) from corpus/ ...`);
  let total = 0;
  for (const file of files) {
    total += await ingestFile(file);
  }

  checkpoint();
  const count = db.prepare('SELECT COUNT(*) AS n FROM embeddings').get() as {
    n: number;
  };
  console.log(`Done. ${total} chunk(s) ingested; ${count.n} total in store.`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});

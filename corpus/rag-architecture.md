# Retrieval-Augmented Generation in DevDigest

DevDigest uses retrieval-augmented generation (RAG) to answer questions from a
small document corpus. The corpus lives as markdown files under the `corpus/`
directory.

## Ingestion

The ingestion script reads each markdown file, splits it into overlapping text
chunks, and computes an embedding vector for every chunk using the
`nomic-embed-text` model running in Ollama. Each vector has 768 dimensions.
Vectors are stored in the `embeddings` table in SQLite as JSON arrays, together
with the source file name, the chunk index, and the original chunk text.

Ingestion is idempotent: re-running it deletes the existing rows for a source
before inserting fresh ones, so the store never accumulates duplicates.

## Retrieval

At query time, the user's question is embedded with the same model. The system
computes cosine similarity between the query vector and every stored chunk
vector, sorts the chunks by score, and keeps the top matches.

## Context-limit handling

Because a language model has a finite context window, retrieval caps how much
text it injects. It first limits results to the top K chunks, then enforces a
maximum total character budget across those chunks. Lower-scoring chunks are
dropped once the budget is exhausted. This keeps the injected context small and
relevant.

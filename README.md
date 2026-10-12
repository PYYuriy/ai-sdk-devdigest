This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## What this is

DevDigest is a streaming chat application built on the [Vercel AI SDK](https://sdk.vercel.ai)
with a locally hosted LLM served by [Ollama](https://ollama.com). The model can
call tools (weather, product search/insert, product-for-city) and answer
questions from a small document corpus using retrieval-augmented generation
(RAG).

See [`DECISIONS.md`](./DECISIONS.md) for the reasoning and trade-offs behind the
main technical choices.

## Architecture

```
Browser (app/Chat) ──> POST /api/chat ──> streamText(model, tools)
                                              │
                                              ├─ weather / searchProducts / addProduct / productsForCity
                                              └─ ragSearch ──> retrieve() ──> cosine rank + cap ──> chunks
                                                                   │
                                              SQLite (better-sqlite3) <── embeddings table
```

- **`app/api/chat/route.ts`** — the chat endpoint. Streams the model response
  and exposes the tool set.
- **`app/tools/*`** — tools. Each tool's logic is an exported, dependency-injected
  function (so it is unit-testable); the `tool({...})` wrapper is thin.
  Side-effecting tools are wrapped with `withToolErrorHandling` so a thrown
  error becomes a structured result instead of crashing the stream.
- **`lib/db.ts`** — SQLite setup (`products` and `embeddings` tables).
- **`lib/embeddings.ts`** — Ollama embedding client (`nomic-embed-text`, 768-dim).
- **`lib/chunk.ts`** — pure text chunker (paragraph-packing + overlap).
- **`lib/retrieval.ts`** — pure cosine similarity + ranking with top-K and a
  character budget (context-limit handling), plus `retrieve()` that ties it to
  the DB and embedder.
- **`scripts/ingest.ts`** — offline ingestion: chunk → embed → store.
- **`corpus/*.md`** — the RAG knowledge base.

## Prerequisites

- [Ollama](https://ollama.com) running locally, with both models pulled:

  ```bash
  ollama pull qwen3.5:35b          # chat / tool-calling model
  ollama pull nomic-embed-text     # embedding model (768-dim)
  ```

- Node.js 20+.

Install dependencies:

```bash
npm install
```

## RAG: ingesting the corpus

Embed the markdown documents under `corpus/` into the SQLite `embeddings` table.
Run this once, and again whenever the corpus changes (it is idempotent — it
replaces a file's chunks rather than duplicating them):

```bash
npm run ingest
```

Then ask the chat about the project (e.g. *"How does context-limit handling
work?"* or *"Why was qwen2.5-coder replaced?"*). The model calls the `ragSearch`
tool, which retrieves the most relevant chunks and answers from them.

## Testing

Unit tests use [Vitest](https://vitest.dev). Tool/retrieval logic is tested
against an in-memory SQLite database and a fake `fetch`, so tests need neither a
live model nor the real database file.

```bash
npm test        # watch mode
npm run test:run  # single run (CI-style)
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

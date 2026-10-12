# Design Decisions & Trade-offs

This document records the main engineering decisions in DevDigest, the
alternatives considered, and the reasoning. It also notes where AI-generated
suggestions were accepted or rejected, since this is a learning project focused
on taking ownership of the resulting code.

---

## 1. Test runner: Vitest (not Jest)

**Decision:** Use Vitest for unit tests.

**Why:**
- The project is TypeScript + ESM + Vite-adjacent tooling. Vitest runs native
  ESM and TypeScript out of the box with almost no config, whereas Jest needs
  extra transform/ESM configuration to do the same.
- `vite-tsconfig-paths` lets tests resolve the same `@/*` alias the app uses,
  so test imports look identical to app imports (`@/lib/retrieval`).
- Vitest's API is Jest-compatible (`describe/it/expect/vi`), so there is no new
  mental model to learn and examples transfer directly.

**Trade-off:** Jest has a larger ecosystem and more Stack Overflow answers. For
a small project on modern TS/ESM, Vitest's zero-config fit outweighs that.

---

## 2. Storage: better-sqlite3 (not a dedicated vector DB)

**Decision:** Store both application data and embedding vectors in SQLite via
`better-sqlite3`, with vectors kept as JSON text and cosine similarity computed
in JavaScript.

**Why:**
- The corpus is tiny (a handful of documents, single-digit chunks). A brute-force
  cosine scan over a few dozen vectors is effectively instant — an approximate
  nearest-neighbour index would add complexity for no measurable benefit.
- `better-sqlite3` is synchronous and in-process: no server to run, no network
  hop, trivial to use in both the app and a one-off ingestion script.
- Storing vectors as JSON keeps them human-inspectable and dependency-free. The
  whole store is one file you can open and read.

**Trade-off:** This does **not** scale. At thousands+ of chunks, the linear scan
and JSON parsing become slow, and you would move to pgvector, SQLite's
`sqlite-vec` extension, or a managed vector DB (Pinecone, Qdrant). The design
deliberately isolates this behind `lib/retrieval.ts` so that swap is localized:
only `rankByCosine`/`retrieve` and the storage format would change, not the
ingestion or tool code.

---

## 3. Model host: local Ollama (not a hosted API)

**Decision:** Run both the chat model (`qwen3.5:35b`) and the embedding model
(`nomic-embed-text`) locally via Ollama.

**Why:**
- No API keys, no per-token cost, no data leaving the machine — ideal for a
  learning/pet project where you want to experiment freely.
- The AI SDK abstracts the provider, so the chat code would look almost the same
  against a hosted model; the learning value is in the SDK usage, not the vendor.

**Trade-off:** Local models are slower and weaker than frontier hosted models,
and depend on the machine having Ollama running with the models pulled. The
embedding client reads `OLLAMA_BASE_URL` from the environment so the host can be
pointed elsewhere without code changes.

---

## 4. Chat model: qwen3.5 (not qwen2.5-coder)

**Decision:** Use `qwen3.5:35b` as the chat/tool-calling model.

**Why (documented in `app/ollama.ts`):**
- `qwen2.5-coder:32b` is a code-focused model. In testing it tended to *print*
  tool calls as plain text in the message content instead of emitting a
  structured `tool_calls` entry. The AI SDK relies on the structured entry to
  actually run a tool, so with the coder model the tools never executed.
- `qwen3.5:35b` reliably emits structured `tool_calls` (verified: content empty,
  `tool_calls` populated), which is exactly what the SDK's tool loop needs.

**Trade-off:** The 35B model is larger and slower to load. Reliable tool calling
is non-negotiable for this app, so correctness wins over speed. Both model names
are kept as named constants so switching is a one-line change.

---

## 5. Chunking and top-K / context-budget trade-offs

**Decision:** Chunk documents into ~800-character paragraph-packed pieces with
~100 characters of overlap; at query time return the top K (default 4) chunks,
further capped by a total character budget (default 2000).

**Why:**
- **Chunk size (~800):** small enough that each vector represents a focused idea
  (sharper similarity), large enough to keep a coherent paragraph intact.
- **Overlap (~100):** prevents an idea that straddles a chunk boundary from being
  split across two chunks and lost from both. The cost is minor duplication.
- **top-K (4):** enough context to answer most questions without flooding the
  prompt with marginally-relevant text that dilutes the model's focus.
- **Character budget (2000):** the real context-limit guard. top-K bounds the
  *count* of chunks; the budget bounds the *total text*, because 4 short chunks
  and 4 long chunks are very different prompt sizes. Chunks are added highest-
  score-first until the budget is hit, and at least the single best chunk is
  always kept even if it alone exceeds the budget (so retrieval never returns
  nothing).

**Trade-off:** Larger chunks / higher K = more context (potentially better
answers) but more tokens, higher latency, and more risk of the model being
distracted by irrelevant text. The values are centralized defaults in
`lib/chunk.ts` and `lib/retrieval.ts` and are easy to tune.

---

## 6. Code structure: injectable pure logic behind thin tool wrappers

**Decision:** Each tool's real logic is an exported function that receives its
dependencies (`db`, `fetchFn`) as arguments; the AI SDK `tool({...})` wrapper is
a thin caller that passes the real singletons.

**Why:**
- The pure functions are unit-testable with an in-memory SQLite database and a
  fake `fetch`, with no AI SDK, no network, and no real DB file.
- It keeps side effects (DB, HTTP, model) at the edges and the logic in the
  middle, which is easier to reason about and change.

**Trade-off:** Slightly more boilerplate (a function plus a wrapper) than putting
everything inline in `execute`. The testability payoff is worth it.

---

## 7. Error handling: a shared wrapper that converts throws to results

**Decision:** Wrap side-effecting tools with `withToolErrorHandling`, which
catches thrown exceptions and returns a structured `{ success: false, error }`
object instead of letting the error abort the streamed response.

**Why:** If an external call (weather API, Ollama embedding) throws mid-stream,
an unhandled error kills the whole chat response. Converting it to a normal tool
result lets the model read the error and explain it to the user, and the stream
survives. Expected "soft" errors (city not found) are passed through untouched;
only unexpected throws are converted.

---

## 8. Where AI-generated suggestions were accepted vs. rejected

This project was built with AI assistance. Taking ownership means reviewing those
suggestions rather than accepting them blindly. Notable cases:

**Accepted (and why):**
- The injectable-dependency refactor and the error-handling wrapper — they
  directly improved testability and robustness.
- JSON-in-SQLite for vectors — appropriate for the corpus size; the simpler
  option was the correct one here.
- The `Number.isFinite` fix for the NaN-temperature bug — a real latent defect
  (`typeof NaN === 'number'` let NaN through the original guard); accepted and
  locked in with a regression test.

**Rejected / corrected (and why):**
- Any suggestion to store vectors in a heavyweight vector database was rejected
  as over-engineering for this scale.
- A sort clause built from user input was kept as a fixed allowlist
  (`SORT_COLUMNS`) rather than string interpolation, to avoid SQL injection.
- The ingestion embedding loop was kept **sequential** rather than parallelized:
  a local Ollama serializes requests anyway, and sequential calls keep memory
  and load predictable. Parallelism would add complexity for no real gain here.

**Known accepted limitation:**
- `app/Chat/index.tsx` uses `experimental_attachments`, which the installed AI
  SDK version no longer types. This produces type-check errors in `npm run build`
  but is pre-existing and outside the scope of the testing/RAG work. It is
  documented here rather than silently changed.

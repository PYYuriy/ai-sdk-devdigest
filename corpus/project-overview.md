# DevDigest Project Overview

DevDigest is a Next.js chat application that demonstrates practical use of the
Vercel AI SDK with a locally hosted large language model served by Ollama.

The application exposes a streaming chat endpoint at `/api/chat`. The model can
call a set of tools: a weather lookup, a product search over a SQLite database,
a product insert tool, and a product-for-city recommender that matches products
to the current temperature of a city.

The project runs entirely on a developer's machine. The chat model is
`qwen3.5:35b`, chosen because it reliably emits structured tool calls. An
earlier attempt used `qwen2.5-coder:32b`, but that code-focused model tended to
print tool calls as plain text instead of emitting a structured tool_calls
entry, so the SDK never executed the tools.

Data is stored in SQLite via the `better-sqlite3` driver, with WAL journaling
enabled for better concurrency during local development.

import { createOllama } from 'ollama-ai-provider-v2';

// qwen2.5-coder is a code model: its tool-calling is unreliable — it tends to
// print the tool call as plain text in `content` instead of emitting a
// structured `tool_calls` entry, so the AI SDK never runs the tool.
export const QWEN_2_5_CODER_32B = 'qwen2.5-coder:32b';

// qwen3.5 reliably emits structured tool_calls (verified: content is empty and
// tool_calls is populated), which is what the SDK needs to run the tool loop.
export const QWEN_3_5_35B = 'qwen3.5:35b';

export const ollama = createOllama({
  baseURL: 'http://localhost:11434/api', // note: native Ollama API, not /v1
});
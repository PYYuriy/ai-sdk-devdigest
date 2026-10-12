import { tool } from 'ai';
import { z } from 'zod';
import defaultDb from '@/lib/db';
import { retrieve } from '@/lib/retrieval';
import { withToolErrorHandling } from '@/app/tools/withToolErrorHandling';

/**
 * RAG search tool. Embeds the user's query, finds the most relevant chunks in
 * the ingested corpus (cosine similarity), and returns them so the model can
 * ground its answer in the documents.
 *
 * Context-limit handling is delegated to `retrieve`, which caps results by
 * both topK and a maximum total character budget before anything is returned
 * to the model — keeping the injected context small and within the window.
 */
export const ragSearchTool = tool({
  description:
    'Search the DevDigest documentation corpus for information relevant to a ' +
    'question, and return the most relevant text chunks. Call this whenever ' +
    'the user asks about the DevDigest project, its architecture, RAG, ' +
    'embeddings, tools, or testing conventions. Base your answer on the ' +
    'returned chunks and cite the source file names.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The question or topic to search for'),
    topK: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(4)
      .describe('How many chunks to retrieve (default 4)'),
  }),
  execute: withToolErrorHandling('ragSearch', async ({ query, topK }) => {
    const chunks = await retrieve(defaultDb, query, {
      topK,
      maxContextChars: 2000, // context-limit guard
    });

    return {
      query,
      resultsCount: chunks.length,
      // Return only what the model needs: source, score, and text.
      context: chunks.map((c) => ({
        source: c.source,
        score: Number(c.score.toFixed(4)),
        text: c.text,
      })),
    };
  }),
});

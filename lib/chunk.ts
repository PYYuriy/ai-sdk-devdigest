/**
 * Pure text chunking utilities for RAG ingestion.
 *
 * Design goals:
 * - Deterministic and side-effect free, so it is trivially unit-testable.
 * - Prefer splitting on paragraph boundaries (blank lines), then pack
 *   paragraphs into chunks up to `maxChars`, with a configurable character
 *   `overlap` between consecutive chunks so context isn't lost at the seams.
 * - A single oversized paragraph is hard-split so no chunk exceeds maxChars
 *   by more than one word.
 */

export type ChunkOptions = {
  /** Soft maximum characters per chunk. Default 800. */
  maxChars?: number;
  /** Characters of overlap carried from the end of one chunk into the next. Default 100. */
  overlap?: number;
};

const DEFAULTS: Required<ChunkOptions> = { maxChars: 800, overlap: 100 };

/** Split text into paragraphs on one-or-more blank lines, trimming each. */
function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Hard-split a single string that is longer than maxChars, on word boundaries. */
function hardSplit(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const parts: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      parts.push(current);
      current = word;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/**
 * Chunk `text` into overlapping pieces no larger than `maxChars`.
 * Returns an array of chunk strings in document order.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const { maxChars, overlap } = { ...DEFAULTS, ...options };

  if (maxChars <= 0) throw new Error('maxChars must be positive');
  if (overlap < 0 || overlap >= maxChars) {
    throw new Error('overlap must be >= 0 and < maxChars');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  // Break into paragraphs, then further hard-split any paragraph that alone
  // exceeds maxChars.
  const units = toParagraphs(trimmed).flatMap((p) =>
    p.length > maxChars ? hardSplit(p, maxChars) : [p],
  );

  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    if (current.length === 0) {
      current = unit;
      continue;
    }
    // +2 accounts for the "\n\n" joiner between paragraphs.
    if (current.length + 2 + unit.length <= maxChars) {
      current += `\n\n${unit}`;
    } else {
      chunks.push(current);
      // Start the next chunk with an overlapping tail of the previous one.
      const tail = overlap > 0 ? current.slice(-overlap) : '';
      current = tail ? `${tail}\n\n${unit}` : unit;
    }
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}

import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/chunk';

describe('chunkText', () => {
  it('returns an empty array for empty/whitespace input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const chunks = chunkText('Hello world.', { maxChars: 800, overlap: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world.');
  });

  it('packs multiple small paragraphs into one chunk when they fit', () => {
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    const chunks = chunkText(text, { maxChars: 800, overlap: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Para one.');
    expect(chunks[0]).toContain('Para three.');
  });

  it('splits into multiple chunks when exceeding maxChars', () => {
    const para = 'A'.repeat(50);
    const text = Array.from({ length: 10 }, () => para).join('\n\n');
    const chunks = chunkText(text, { maxChars: 120, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(120);
    }
  });

  it('hard-splits a single oversized paragraph on word boundaries', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(words, { maxChars: 40, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(40);
    }
    // No content lost: every word appears somewhere.
    const joined = chunks.join(' ');
    expect(joined).toContain('word0');
    expect(joined).toContain('word49');
  });

  it('carries an overlap tail into the next chunk', () => {
    const p1 = 'X'.repeat(80);
    const p2 = 'Y'.repeat(80);
    const chunks = chunkText(`${p1}\n\n${p2}`, { maxChars: 100, overlap: 20 });
    expect(chunks.length).toBe(2);
    // The second chunk should begin with the overlapping tail of the first.
    expect(chunks[1].startsWith('X'.repeat(20))).toBe(true);
  });

  it('throws on invalid options', () => {
    expect(() => chunkText('x', { maxChars: 0 })).toThrow();
    expect(() => chunkText('x', { maxChars: 100, overlap: 100 })).toThrow();
    expect(() => chunkText('x', { maxChars: 100, overlap: -1 })).toThrow();
  });
});

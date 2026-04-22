import type { ContentBlock } from "./types";

const FULLTEXT_MIN_CHARS = 1800;
const FULLTEXT_MIN_BODY_BLOCKS = 3;

/** Same heuristic as `apps/digest/src/digest.ts` fullTextLooksPartial. */
export function fullTextLooksPartial(blocks: ContentBlock[]): boolean {
  const bodyTypes = new Set(["p", "quote", "li"]);
  let bodyBlocks = 0;
  let chars = 0;
  for (const b of blocks) {
    chars += b.text.trim().length;
    if (bodyTypes.has(b.type)) bodyBlocks++;
  }
  return chars < FULLTEXT_MIN_CHARS || bodyBlocks < FULLTEXT_MIN_BODY_BLOCKS;
}

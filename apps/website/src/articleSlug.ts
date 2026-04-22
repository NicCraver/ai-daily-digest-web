import { sha1 } from "@noble/hashes/legacy.js";

/** Matches `apps/digest/src/digest.ts` urlHash (SHA-1 of URL UTF-8, first 16 hex chars). */
export function articleSlugFromLink(url: string): string {
  const bytes = sha1(new TextEncoder().encode(url));
  return Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export function articleSlug(article: { link: string; slug?: string }): string {
  return article.slug?.trim() || articleSlugFromLink(article.link);
}
